import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { useAuth } from '../context/AuthContext';
import { Button, StatusPill } from '../components/ui';
import { effectiveGrade, gradeColorClass, isApprovedStatus } from '../lib/periodGrades';
import { friendlyDbError } from '../lib/errors';
import type { AcademicYear, Period, SchoolClass, Subject, AssessmentType, Student, Grade, PeriodDirectGrade, GradeStatus } from '../types';

type CellState = 'idle' | 'saving' | 'saved' | 'error';
type BulkAction = 'idle' | 'submitting' | 'approving' | 'unlocking';

export default function Gradebook() {
  const { hasRole } = useAuth();
  const isApprover = hasRole('administrator', 'principal');

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [directGrades, setDirectGrades] = useState<PeriodDirectGrade[]>([]);

  const [yearId, setYearId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [cellState, setCellState] = useState<Record<string, CellState>>({});
  const [error, setError] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction>('idle');
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (classId) loadStudents(); }, [classId]);
  useEffect(() => { if (periodId && classId && subjectId) loadGrades(); }, [periodId, classId, subjectId]);
  useEffect(() => {
    if (!yearId) return;
    supabase.from('periods').select('*').eq('academic_year_id', yearId).order('sort_order').then(({ data }) => setPeriods((data as Period[]) ?? []));
  }, [yearId]);

  async function loadBase() {
    const [{ data: y }, { data: c }, { data: s }, { data: a }] = await Promise.all([
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('assessment_types').select('*').order('sort_order'),
    ]);
    setYears((y as AcademicYear[]) ?? []);
    setClasses((c as SchoolClass[]) ?? []);
    setSubjects((s as Subject[]) ?? []);
    setAssessmentTypes((a as AssessmentType[]) ?? []);
    const active = (y as AcademicYear[])?.find((yr) => yr.status === 'active');
    if (active) setYearId(active.id);
  }

  async function loadStudents() {
    const { data } = await supabase.from('students').select('*').eq('current_class_id', classId).eq('status', 'Active').order('last_name');
    setStudents((data as Student[]) ?? []);
  }

  async function loadGrades() {
    const [{ data: g }, { data: d }] = await Promise.all([
      supabase.from('grades').select('*').eq('period_id', periodId).eq('class_id', classId).eq('subject_id', subjectId),
      supabase.from('period_direct_grades').select('*').eq('period_id', periodId).eq('class_id', classId).eq('subject_id', subjectId),
    ]);
    setGrades((g as Grade[]) ?? []);
    setDirectGrades((d as PeriodDirectGrade[]) ?? []);
  }

  const ready = yearId && periodId && classId && subjectId;

  function gradeFor(studentId: string, assessmentTypeId: string) {
    return grades.find((g) => g.student_id === studentId && g.assessment_type_id === assessmentTypeId);
  }
  function directFor(studentId: string) {
    return directGrades.find((d) => d.student_id === studentId);
  }
  function studentHasDetailed(studentId: string) {
    return assessmentTypes.some((at) => {
      const g = gradeFor(studentId, at.id);
      return g && g.entry_status === 'entered' && g.score !== null;
    });
  }
  function total(studentId: string) {
    const scores = assessmentTypes.map((at) => gradeFor(studentId, at.id)).filter((g): g is Grade => !!g);
    return effectiveGrade(scores, directFor(studentId));
  }
  /** Combined status across all of a student's entries for this subject/period. */
  function periodStatus(studentId: string): 'none' | GradeStatus {
    const statuses: GradeStatus[] = [];
    assessmentTypes.forEach((at) => {
      const g = gradeFor(studentId, at.id);
      if (g && g.entry_status === 'entered') statuses.push(g.grade_status);
    });
    const d = directFor(studentId);
    if (d) statuses.push(d.status);
    if (statuses.length === 0) return 'none';
    if (statuses.some((s) => isApprovedStatus(s))) return 'reviewed';
    if (statuses.some((s) => s === 'submitted')) return 'submitted';
    return 'draft';
  }
  function isLockedForEditing(studentId: string) {
    if (isApprover) return false; // approvers can always edit/correct
    return periodStatus(studentId) !== 'draft' && periodStatus(studentId) !== 'none';
  }

  async function saveAssessment(student: Student, at: AssessmentType, rawValue: string) {
    setError(null);
    const key = `${student.id}-${at.id}`;
    const trimmed = rawValue.trim();

    if (trimmed === '') {
      await persistAssessment(student.id, at.id, key, null, 'not_entered');
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num) || num < 0) {
      setError(`Score must be a number of 0 or greater.`);
      return;
    }
    if (num > at.max_score) {
      setError(`${at.name} score cannot exceed its maximum of ${at.max_score}.`);
      return;
    }

    const otherSum = assessmentTypes
      .filter((a) => a.id !== at.id)
      .reduce((sum, a) => {
        const g = gradeFor(student.id, a.id);
        return g && g.entry_status === 'entered' && g.score !== null ? sum + g.score : sum;
      }, 0);
    const hypothetical = otherSum + num;

    if (hypothetical > 100) {
      setError(`${student.first_name} ${student.last_name}'s period total would exceed 100 (would be ${hypothetical}). Adjust the scores first.`);
      return;
    }
    const allOthersEntered = assessmentTypes.every((a) => a.id === at.id || gradeFor(student.id, a.id)?.entry_status === 'entered');
    if (allOthersEntered && hypothetical < 65) {
      setError(`${student.first_name} ${student.last_name}'s completed period total would be below the minimum of 65 (would be ${hypothetical}).`);
      return;
    }

    const direct = directFor(student.id);
    if (direct) {
      await supabase.from('period_direct_grades').delete().eq('id', direct.id);
    }
    await persistAssessment(student.id, at.id, key, num, 'entered');
  }

  async function persistAssessment(studentId: string, assessmentTypeId: string, key: string, score: number | null, status: Grade['entry_status']) {
    setCellState((prev) => ({ ...prev, [key]: 'saving' }));
    const existing = gradeFor(studentId, assessmentTypeId);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      student_id: studentId,
      class_id: classId,
      subject_id: subjectId,
      academic_year_id: yearId,
      period_id: periodId,
      assessment_type_id: assessmentTypeId,
      score,
      entry_status: status,
      grade_status: existing?.grade_status ?? 'draft',
      entered_at: new Date().toISOString(),
      entered_by: userData.user?.id ?? null,
    };
    const { error: err } = existing
      ? await supabase.from('grades').update(payload).eq('id', existing.id)
      : await supabase.from('grades').insert(payload);

    if (err) {
      setCellState((prev) => ({ ...prev, [key]: 'error' }));
      setError(friendlyDbError(err));
      return;
    }
    setCellState((prev) => ({ ...prev, [key]: 'saved' }));
    await loadGrades();
    setTimeout(() => setCellState((prev) => ({ ...prev, [key]: 'idle' })), 1200);
  }

  async function saveDirect(student: Student, rawValue: string) {
    setError(null);
    const key = `direct-${student.id}`;
    const trimmed = rawValue.trim();

    if (trimmed === '') {
      const existing = directFor(student.id);
      if (existing) await supabase.from('period_direct_grades').delete().eq('id', existing.id);
      loadGrades();
      return;
    }
    if (studentHasDetailed(student.id)) {
      setError(`${student.first_name} ${student.last_name} already has detailed assessment scores for this subject/period — clear those first to enter a direct grade instead.`);
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num) || num < 65 || num > 100) {
      setError('A direct final grade must be between 65 and 100.');
      return;
    }

    setCellState((prev) => ({ ...prev, [key]: 'saving' }));
    const existing = directFor(student.id);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      student_id: student.id,
      class_id: classId,
      subject_id: subjectId,
      academic_year_id: yearId,
      period_id: periodId,
      score: num,
      status: existing?.status ?? 'draft',
      entered_by: userData.user?.id ?? null,
      entered_at: new Date().toISOString(),
    };
    const { error: err } = existing
      ? await supabase.from('period_direct_grades').update(payload).eq('id', existing.id)
      : await supabase.from('period_direct_grades').insert(payload);

    if (err) {
      setCellState((prev) => ({ ...prev, [key]: 'error' }));
      setError(friendlyDbError(err));
      return;
    }
    setCellState((prev) => ({ ...prev, [key]: 'saved' }));
    await loadGrades();
    setTimeout(() => setCellState((prev) => ({ ...prev, [key]: 'idle' })), 1200);
  }

  async function submitForReview() {
    const draftGradeIds = grades.filter((g) => g.entry_status === 'entered' && g.grade_status === 'draft').map((g) => g.id);
    const draftDirectIds = directGrades.filter((d) => d.status === 'draft').map((d) => d.id);
    if (draftGradeIds.length === 0 && draftDirectIds.length === 0) {
      setBulkMessage('Nothing new to submit — everything here is already submitted or approved.');
      return;
    }
    if (!confirm(`Submit ${draftGradeIds.length + draftDirectIds.length} grade(s) for review? They'll be locked until an administrator or principal approves them.`)) return;
    setBulkAction('submitting');
    setBulkMessage('Submitting…');
    if (draftGradeIds.length) await supabase.from('grades').update({ grade_status: 'submitted' }).in('id', draftGradeIds);
    if (draftDirectIds.length) await supabase.from('period_direct_grades').update({ status: 'submitted' }).in('id', draftDirectIds);
    await logActivity('grades_submitted', { class_id: classId, subject_id: subjectId, period_id: periodId, count: draftGradeIds.length + draftDirectIds.length });
    setBulkAction('idle');
    setBulkMessage(`Submitted ${draftGradeIds.length + draftDirectIds.length} grade(s) for review.`);
    loadGrades();
  }

  async function approveSubmitted() {
    const submittedGradeIds = grades.filter((g) => g.grade_status === 'submitted').map((g) => g.id);
    const submittedDirectIds = directGrades.filter((d) => d.status === 'submitted').map((d) => d.id);
    if (submittedGradeIds.length === 0 && submittedDirectIds.length === 0) {
      setBulkMessage('Nothing is waiting for approval here.');
      return;
    }
    if (!confirm(`Approve ${submittedGradeIds.length + submittedDirectIds.length} grade(s)? They'll become visible on report cards and rankings.`)) return;
    setBulkAction('approving');
    setBulkMessage('Approving…');
    if (submittedGradeIds.length) await supabase.from('grades').update({ grade_status: 'reviewed' }).in('id', submittedGradeIds);
    if (submittedDirectIds.length) await supabase.from('period_direct_grades').update({ status: 'reviewed' }).in('id', submittedDirectIds);
    await logActivity('grades_approved', { class_id: classId, subject_id: subjectId, period_id: periodId, count: submittedGradeIds.length + submittedDirectIds.length });
    setBulkAction('idle');
    setBulkMessage(`Approved ${submittedGradeIds.length + submittedDirectIds.length} grade(s) — now visible on report cards.`);
    loadGrades();
  }

  async function unlockForEditing() {
    const lockedGradeIds = grades.filter((g) => g.grade_status === 'submitted' || isApprovedStatus(g.grade_status)).map((g) => g.id);
    const lockedDirectIds = directGrades.filter((d) => d.status === 'submitted' || isApprovedStatus(d.status)).map((d) => d.id);
    if (lockedGradeIds.length === 0 && lockedDirectIds.length === 0) {
      setBulkMessage('Nothing here is locked.');
      return;
    }
    if (!confirm(`Send ${lockedGradeIds.length + lockedDirectIds.length} grade(s) back to the teacher for editing?`)) return;
    setBulkAction('unlocking');
    setBulkMessage('Unlocking…');
    if (lockedGradeIds.length) await supabase.from('grades').update({ grade_status: 'draft' }).in('id', lockedGradeIds);
    if (lockedDirectIds.length) await supabase.from('period_direct_grades').update({ status: 'draft' }).in('id', lockedDirectIds);
    await logActivity('grades_unlocked', { class_id: classId, subject_id: subjectId, period_id: periodId, count: lockedGradeIds.length + lockedDirectIds.length });
    setBulkAction('idle');
    setBulkMessage(`Sent ${lockedGradeIds.length + lockedDirectIds.length} grade(s) back to draft for editing.`);
    loadGrades();
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Gradebook</h1>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Selector label="Academic Year" value={yearId} onChange={setYearId} options={years.map((y) => ({ value: y.id, label: y.name }))} />
        <Selector label="Period" value={periodId} onChange={setPeriodId} options={periods.map((p) => ({ value: p.id, label: p.name }))} />
        <Selector label="Class" value={classId} onChange={setClassId} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
        <Selector label="Subject" value={subjectId} onChange={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      {bulkMessage && <p className="mb-2 text-sm text-gold">{bulkMessage}</p>}

      {!ready ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select academic year, period, class and subject to begin.</p>
      ) : students.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">No active students in this class.</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-neutral-500">
            Enter detailed assessment scores OR a single Final Grade per student — not both. Detailed scores always override a Final Grade.
            {isApprover
              ? ' As an administrator/principal you can still edit locked cells directly.'
              : ' Once submitted, a grade is locked until an administrator or principal approves or unlocks it.'}
          </p>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="bg-ink-soft text-neutral-400">
                  <th className="sticky left-0 z-10 bg-ink-soft p-2 text-left">Student</th>
                  {assessmentTypes.map((at) => (
                    <th key={at.id} className="p-2 text-center font-normal">{at.name}<div className="text-[9px] text-neutral-600">/{at.max_score}</div></th>
                  ))}
                  <th className="p-2 text-center font-normal text-gold">Final Grade<div className="text-[9px] text-neutral-600">(direct)</div></th>
                  <th className="p-2 text-center font-normal">Total</th>
                  <th className="p-2 text-center font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const hasDetailed = studentHasDetailed(s.id);
                  const t = total(s.id);
                  const locked = isLockedForEditing(s.id);
                  const status = periodStatus(s.id);
                  return (
                    <tr key={s.id} className="border-t border-neutral-800">
                      <td className="sticky left-0 z-10 bg-ink p-2 font-medium">{s.first_name} {s.last_name}</td>
                      {assessmentTypes.map((at) => {
                        const g = gradeFor(s.id, at.id);
                        const key = `${s.id}-${at.id}`;
                        return (
                          <td key={at.id} className="p-1 text-center">
                            <input
                              type="number"
                              min={0}
                              max={at.max_score}
                              disabled={locked}
                              defaultValue={g?.score ?? ''}
                              onBlur={(e) => saveAssessment(s, at, e.target.value)}
                              className="w-14 rounded border border-neutral-700 bg-surface px-1 py-1 text-center disabled:opacity-40"
                            />
                            {cellState[key] === 'saving' && <div className="text-[9px] text-yellow-500">saving…</div>}
                          </td>
                        );
                      })}
                      <td className="p-1 text-center">
                        <input
                          type="number"
                          min={65}
                          max={100}
                          disabled={locked || hasDetailed}
                          defaultValue={directFor(s.id)?.score ?? ''}
                          onBlur={(e) => saveDirect(s, e.target.value)}
                          title={hasDetailed ? 'Locked — detailed assessment scores already entered' : locked ? 'Locked — submitted for review' : ''}
                          className="w-16 rounded border border-neutral-700 bg-surface px-1 py-1 text-center disabled:opacity-30"
                        />
                        {cellState[`direct-${s.id}`] === 'saving' && <div className="text-[9px] text-yellow-500">saving…</div>}
                      </td>
                      <td className={`p-2 text-center font-semibold ${gradeColorClass(t)}`}>{t ?? '—'}</td>
                      <td className="p-2 text-center">
                        {status === 'none' && <span className="text-[10px] text-neutral-600">—</span>}
                        {status === 'draft' && <StatusPill text="Draft" tone="neutral" />}
                        {status === 'submitted' && <StatusPill text="Pending" tone="warn" />}
                        {isApprovedStatus(status) && <StatusPill text="Approved" tone="good" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {isApprover && (
              <>
                <Button variant="ghost" disabled={bulkAction !== 'idle'} onClick={unlockForEditing}>
                  {bulkAction === 'unlocking' ? 'Unlocking…' : 'Send Back to Draft'}
                </Button>
                <Button disabled={bulkAction !== 'idle'} onClick={approveSubmitted}>
                  {bulkAction === 'approving' ? 'Approving…' : 'Approve Submitted'}
                </Button>
              </>
            )}
            <Button variant="ghost" disabled={bulkAction !== 'idle'} onClick={submitForReview}>
              {bulkAction === 'submitting' ? 'Submitting…' : 'Submit for Review'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Selector({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-xs text-neutral-100">
      <option value="">{label}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
