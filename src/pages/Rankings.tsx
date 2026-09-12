import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui';
import { computeRanks } from '../lib/grading';
import { effectiveApprovedGrade, roundOneDecimal } from '../lib/periodGrades';
import type { SchoolClass, Student, Grade, PeriodDirectGrade, Period, Subject, SchoolSettings } from '../types';

export default function Rankings() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [classId, setClassId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [directGrades, setDirectGrades] = useState<PeriodDirectGrade[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

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
    supabase.from('periods').select('*').eq('academic_year_id', cls.academic_year_id).order('sort_order')
      .then(({ data }) => setPeriods((data as Period[]) ?? []));
  }, [classId, classes]);

  useEffect(() => {
    if (!classId || !periodId) return;
    Promise.all([
      supabase.from('students').select('*').eq('current_class_id', classId).eq('status', 'Active'),
      supabase.from('grades').select('*').eq('class_id', classId).eq('period_id', periodId),
      supabase.from('period_direct_grades').select('*').eq('class_id', classId).eq('period_id', periodId),
    ]).then(([{ data: s }, { data: g }, { data: d }]) => {
      setStudents((s as Student[]) ?? []);
      setGrades((g as Grade[]) ?? []);
      setDirectGrades((d as PeriodDirectGrade[]) ?? []);
    });
  }, [classId, periodId]);

  const ranked = useMemo(() => {
    const rows = students.map((s) => {
      // Average across every subject's effective grade (detailed sum, or direct grade) for this period.
      const perSubject = subjects.map((subj) => {
        const scores = grades.filter((g) => g.student_id === s.id && g.subject_id === subj.id);
        const direct = directGrades.find((d) => d.student_id === s.id && d.subject_id === subj.id);
        return effectiveApprovedGrade(scores, direct);
      });
      const average = roundOneDecimal(perSubject);
      return { id: s.id, student: s, average };
    });
    const positions = computeRanks(rows, settings?.tie_rule ?? 'shared_rank');
    return rows
      .map((r) => ({ ...r, position: positions.get(r.id) ?? null }))
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  }, [students, subjects, grades, directGrades, settings]);

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Rankings</h1>
      <div className="mb-3 flex gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="flex-1 rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Select class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="flex-1 rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Select period</option>
          {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!classId || !periodId ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select a class and period to view rankings.</p>
      ) : ranked.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">No entered grades yet for this class and period.</p>
      ) : (
        <div className="space-y-2">
          {ranked.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-black">
                  {r.position ?? '—'}
                </div>
                <div className="text-sm font-medium">{r.student.first_name} {r.student.last_name}</div>
              </div>
              <div className="text-sm text-neutral-300">{r.average !== null ? r.average.toFixed(1) : '—'}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
