import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button, Input } from '../components/ui';
import { effectiveApprovedGrade, roundWhole, roundOneDecimal, gradeColorClassPrint } from '../lib/periodGrades';
import { computeRanks } from '../lib/grading';
import { exportElementAsPdf } from '../lib/pdf';
import type { SchoolClass, Student, Grade, PeriodDirectGrade, Period, Subject, SchoolSettings, AttendanceRecord } from '../types';

interface ConductRow { id: string; student_id: string; academic_year_id: string; conduct: string | null }

export default function ReportCards() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classGrades, setClassGrades] = useState<Grade[]>([]);
  const [classDirectGrades, setClassDirectGrades] = useState<PeriodDirectGrade[]>([]);
  const [classAttendance, setClassAttendance] = useState<AttendanceRecord[]>([]);
  const [conductRows, setConductRows] = useState<ConductRow[]>([]);
  const [conductDraft, setConductDraft] = useState('');
  const [savingConduct, setSavingConduct] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('school_settings').select('*').single(),
    ]).then(([{ data: c }, { data: s }, { data: set }]) => {
      setClasses((c as SchoolClass[]) ?? []);
      setSubjects((s as Subject[]) ?? []);
      setSettings(set as SchoolSettings);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    Promise.all([
      supabase.from('students').select('*').eq('current_class_id', classId).eq('status', 'Active').order('last_name'),
      supabase.from('periods').select('*').eq('academic_year_id', cls.academic_year_id).order('sort_order'),
      supabase.from('grades').select('*').eq('class_id', classId),
      supabase.from('period_direct_grades').select('*').eq('class_id', classId),
      supabase.from('attendance').select('*').eq('class_id', classId),
      supabase.from('student_conduct').select('*').eq('academic_year_id', cls.academic_year_id),
    ]).then(([{ data: s }, { data: p }, { data: g }, { data: d }, { data: att }, { data: cond }]) => {
      setStudents((s as Student[]) ?? []);
      setPeriods((p as Period[]) ?? []);
      setClassGrades((g as Grade[]) ?? []);
      setClassDirectGrades((d as PeriodDirectGrade[]) ?? []);
      setClassAttendance((att as AttendanceRecord[]) ?? []);
      setConductRows((cond as ConductRow[]) ?? []);
    });
  }, [classId, classes]);

  const semester1 = periods.slice(0, Math.ceil(periods.length / 2));
  const semester2 = periods.slice(Math.ceil(periods.length / 2));

  function gradeFor(forStudentId: string, subjectId: string, periodId: string): number | null {
    const scores = classGrades.filter((g) => g.student_id === forStudentId && g.subject_id === subjectId && g.period_id === periodId);
    const direct = classDirectGrades.find((d) => d.student_id === forStudentId && d.subject_id === subjectId && d.period_id === periodId);
    return effectiveApprovedGrade(scores, direct);
  }

  function attendanceFor(forStudentId: string, period: Period): number | null {
    if (!period.start_date || !period.end_date) return null;
    const records = classAttendance.filter((a) => a.student_id === forStudentId && a.date >= period.start_date! && a.date <= period.end_date!);
    if (records.length === 0) return null;
    const present = records.filter((a) => a.status === 'Present').length;
    return Math.round((present / records.length) * 100);
  }

  function buildStudentReport(forStudentId: string) {
    const rows = subjects.map((subj) => {
      const sem1Values = semester1.map((p) => gradeFor(forStudentId, subj.id, p.id));
      const sem2Values = semester2.map((p) => gradeFor(forStudentId, subj.id, p.id));
      const avg1 = roundWhole(sem1Values);
      const avg2 = roundWhole(sem2Values);
      const yearly = roundWhole([avg1, avg2]);
      return { subject: subj, sem1Values, sem2Values, avg1, avg2, yearly };
    }).filter((r) => r.sem1Values.some((v) => v !== null) || r.sem2Values.some((v) => v !== null));

    const bottomAverages = {
      sem1: semester1.map((_, i) => roundOneDecimal(rows.map((r) => r.sem1Values[i]))),
      avg1: roundOneDecimal(rows.map((r) => r.avg1)),
      sem2: semester2.map((_, i) => roundOneDecimal(rows.map((r) => r.sem2Values[i]))),
      avg2: roundOneDecimal(rows.map((r) => r.avg2)),
      yearly: roundOneDecimal(rows.map((r) => r.yearly)),
    };
    const attendance = {
      sem1: semester1.map((p) => attendanceFor(forStudentId, p)),
      sem2: semester2.map((p) => attendanceFor(forStudentId, p)),
    };
    return { rows, bottomAverages, attendance };
  }

  // Compute each student's cross-subject average for every column, once, for ranking.
  const allColumnAverages = useMemo(() => {
    return students.map((s) => {
      const rpt = buildStudentReport(s.id);
      return { id: s.id, ...rpt.bottomAverages };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, classGrades, classDirectGrades, subjects, periods]);

  const ranksByColumn = useMemo(() => {
    const tieRule = settings?.tie_rule ?? 'shared_rank';
    const rankFor = (getValue: (row: (typeof allColumnAverages)[number]) => number | null) =>
      computeRanks(allColumnAverages.map((r) => ({ id: r.id, average: getValue(r) })), tieRule);
    return {
      sem1: semester1.map((_, i) => rankFor((r) => r.sem1[i])),
      avg1: rankFor((r) => r.avg1),
      sem2: semester2.map((_, i) => rankFor((r) => r.sem2[i])),
      avg2: rankFor((r) => r.avg2),
      yearly: rankFor((r) => r.yearly),
    };
  }, [allColumnAverages, semester1, semester2, settings]);

  const student = students.find((s) => s.id === studentId);
  const cls = classes.find((c) => c.id === classId);
  const report = student ? buildStudentReport(student.id) : null;
  const studentRanks = student ? {
    sem1: ranksByColumn.sem1.map((m) => m.get(student.id) ?? null),
    avg1: ranksByColumn.avg1.get(student.id) ?? null,
    sem2: ranksByColumn.sem2.map((m) => m.get(student.id) ?? null),
    avg2: ranksByColumn.avg2.get(student.id) ?? null,
    yearly: ranksByColumn.yearly.get(student.id) ?? null,
  } : null;

  useEffect(() => {
    if (!student) { setConductDraft(''); return; }
    setConductDraft(conductRows.find((c) => c.student_id === student.id)?.conduct ?? '');
  }, [studentId, conductRows]);

  async function saveConduct() {
    if (!student || !cls) return;
    setSavingConduct(true);
    const existing = conductRows.find((c) => c.student_id === student.id);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      student_id: student.id,
      academic_year_id: cls.academic_year_id,
      conduct: conductDraft || null,
      updated_by: userData.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from('student_conduct').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('student_conduct').insert(payload);
    }
    setSavingConduct(false);
    const { data } = await supabase.from('student_conduct').select('*').eq('academic_year_id', cls.academic_year_id);
    setConductRows((data as ConductRow[]) ?? []);
  }

  const colCount = semester1.length + semester2.length + 3; // + avg1 + avg2 + yearly

  async function handleDownload() {
    if (!student) return;
    setExportError(null);
    setExporting(true);
    try {
      await exportElementAsPdf('report-card-print', `${student.first_name}-${student.last_name}-report-card`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not generate the PDF.');
    }
    setExporting(false);
  }

  return (
    <div className="p-4">
      <div className="no-print mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Report Cards</h1>
      </div>
      <div className="no-print mb-3 grid grid-cols-2 gap-2">
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); }} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </select>
      </div>

      {!student || !report || !studentRanks ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select a class and student to view their report card.</p>
      ) : (
        <>
          <div className="no-print mb-3 flex items-center gap-2">
            <Input placeholder="Conduct (e.g. Good, Excellent)" value={conductDraft} onChange={(e) => setConductDraft(e.target.value)} className="flex-1" />
            <Button onClick={saveConduct} disabled={savingConduct}>{savingConduct ? 'Saving…' : 'Save Conduct'}</Button>
          </div>

          <div id="report-card-print" className="rounded-xl border-2 border-gold/60 bg-white p-3 text-black">
            <div className="mb-2 border-b-2 border-blue-900 pb-2 text-center">
              <div className="text-base font-bold tracking-wide text-blue-900">{settings?.school_name ?? 'AJB LEADERS ACADEMY'}</div>
              <div className="text-[10px]">{settings?.address}</div>
              <div className="mt-1 text-[11px] font-semibold text-red-700">STUDENT PROGRESS REPORT CARD</div>
            </div>

            <div className="mb-2 grid grid-cols-3 gap-1 text-[10px]">
              <div><span className="text-neutral-500">STUDENT</span><br /><b>{student.first_name} {student.last_name}</b></div>
              <div><span className="text-neutral-500">CLASS</span><br /><b>{cls?.name}</b></div>
              <div><span className="text-neutral-500">SECTION</span><br /><b>{student.section ?? '—'}</b></div>
            </div>

            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-blue-50">
                  <th rowSpan={2} className="border border-blue-200 p-1 text-left">SUBJECTS</th>
                  <th colSpan={semester1.length + 1} className="border border-blue-200 p-1">FIRST SEMESTER</th>
                  <th colSpan={semester2.length + 1} className="border border-blue-200 p-1">SECOND SEMESTER</th>
                  <th rowSpan={2} className="border border-blue-200 p-1">YEARLY<br />AVG</th>
                </tr>
                <tr className="bg-blue-50">
                  {semester1.map((p) => <th key={p.id} className="border border-blue-200 p-1 font-normal">{p.name}</th>)}
                  <th className="border border-blue-200 p-1">AVG</th>
                  {semester2.map((p) => <th key={p.id} className="border border-blue-200 p-1 font-normal">{p.name}</th>)}
                  <th className="border border-blue-200 p-1">AVG</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.subject.id}>
                    <td className="border border-blue-100 p-1 font-medium text-red-800">{r.subject.name}</td>
                    {r.sem1Values.map((v, i) => <td key={i} className={`border border-blue-100 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                    <td className={`border border-blue-100 p-1 text-center font-semibold ${gradeColorClassPrint(r.avg1)}`}>{r.avg1 ?? ''}</td>
                    {r.sem2Values.map((v, i) => <td key={i} className={`border border-blue-100 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                    <td className={`border border-blue-100 p-1 text-center font-semibold ${gradeColorClassPrint(r.avg2)}`}>{r.avg2 ?? ''}</td>
                    <td className={`border border-blue-100 p-1 text-center font-semibold ${gradeColorClassPrint(r.yearly)}`}>{r.yearly ?? ''}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-semibold">
                  <td className="border border-blue-200 p-1">Average</td>
                  {report.bottomAverages.sem1.map((v, i) => <td key={i} className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                  <td className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(report.bottomAverages.avg1)}`}>{report.bottomAverages.avg1 ?? ''}</td>
                  {report.bottomAverages.sem2.map((v, i) => <td key={i} className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                  <td className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(report.bottomAverages.avg2)}`}>{report.bottomAverages.avg2 ?? ''}</td>
                  <td className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(report.bottomAverages.yearly)}`}>{report.bottomAverages.yearly ?? ''}</td>
                </tr>
                <tr className="bg-yellow-50">
                  <td className="border border-blue-200 p-1 font-semibold text-blue-900">Rank</td>
                  {studentRanks.sem1.map((r, i) => <td key={i} className="border border-blue-200 p-1 text-center">{r ?? ''}</td>)}
                  <td className="border border-blue-200 p-1 text-center">{studentRanks.avg1 ?? ''}</td>
                  {studentRanks.sem2.map((r, i) => <td key={i} className="border border-blue-200 p-1 text-center">{r ?? ''}</td>)}
                  <td className="border border-blue-200 p-1 text-center">{studentRanks.avg2 ?? ''}</td>
                  <td className="border border-blue-200 p-1 text-center">{studentRanks.yearly ?? ''}</td>
                </tr>
                <tr>
                  <td className="border border-blue-200 p-1 font-semibold text-blue-900">Attendance %</td>
                  {report.attendance.sem1.map((v, i) => <td key={i} className="border border-blue-200 p-1 text-center">{v ?? '—'}</td>)}
                  <td className="border border-blue-200 p-1 text-center">{roundWhole(report.attendance.sem1) ?? '—'}</td>
                  {report.attendance.sem2.map((v, i) => <td key={i} className="border border-blue-200 p-1 text-center">{v ?? '—'}</td>)}
                  <td className="border border-blue-200 p-1 text-center">{roundWhole(report.attendance.sem2) ?? '—'}</td>
                  <td className="border border-blue-200 p-1 text-center">{roundWhole([...report.attendance.sem1, ...report.attendance.sem2]) ?? '—'}</td>
                </tr>
                <tr>
                  <td className="border border-blue-200 p-1 font-semibold text-blue-900">Conduct</td>
                  <td colSpan={colCount - 1} className="border border-blue-200 p-1 text-center">{conductDraft || '—'}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-3 grid grid-cols-2 gap-3 text-[9px]">
              <div>
                <div className="font-semibold text-blue-900">GRADING METHOD</div>
                <div>A 95 – 100 = Excellent</div>
                <div>B 90 – 94 = Very Good</div>
                <div>C 80 – 89 = Good</div>
                <div>D 70 – 79 = Average</div>
                <div>E Below 70 = Poor</div>
              </div>
              <div>
                <div className="font-semibold text-blue-900">MOTTO</div>
                <div className="italic">{settings?.motto ?? '—'}</div>
              </div>
            </div>

            <div className="mt-3 text-[9px]">
              <div className="font-semibold text-blue-900">PROMOTION STATEMENT</div>
              <div>
                This certifies that <b>{student.first_name} {student.last_name}</b> has satisfactorily completed the work of Grade <b>{cls?.name}</b> and is:
              </div>
              <div className="mt-1 space-y-0.5">
                <div>☐ A. Promoted to Grade ____</div>
                <div>☐ B. Conditioned in ____</div>
                <div>☐ C. Required to repeat the grade.</div>
                <div>☐ D. Asked not to enroll next year.</div>
              </div>
            </div>

            <div className="mt-6 flex justify-between text-[9px]">
              <div>____________________<br />Class Teacher's Signature</div>
              <div>____________________<br />Principal's Signature</div>
              <div>____________________<br />Date</div>
            </div>
          </div>

          {exportError && <p className="no-print mt-2 text-sm text-red-400">{exportError}</p>}
          <Button className="no-print mt-3 w-full" onClick={handleDownload} disabled={exporting}>
            {exporting ? 'Generating PDF…' : 'Download / Share PDF'}
          </Button>
        </>
      )}
    </div>
  );
}
