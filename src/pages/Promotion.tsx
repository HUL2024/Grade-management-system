import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Card, EmptyState } from '../components/ui';
import type { SchoolClass, Student, AcademicYear } from '../types';

type Decision = 'Promoted' | 'Repeated' | 'Graduated' | 'Transferred' | 'Withdrawn';

export default function Promotion() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [nextYearId, setNextYearId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
    ]).then(([{ data: c }, { data: y }]) => {
      setClasses((c as SchoolClass[]) ?? []);
      setYears((y as AcademicYear[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (fromClassId) {
      supabase.from('students').select('*').eq('current_class_id', fromClassId).eq('status', 'Active').order('last_name')
        .then(({ data }) => {
          setStudents((data as Student[]) ?? []);
          const initial: Record<string, Decision> = {};
          (data as Student[] ?? []).forEach((s) => (initial[s.id] = 'Promoted'));
          setDecisions(initial);
        });
    }
  }, [fromClassId]);

  async function confirmPromotion() {
    if (!confirm(`Apply promotion decisions to ${students.length} students? Historical records will be preserved.`)) return;
    setSubmitting(true);
    for (const s of students) {
      const decision = decisions[s.id];
      // Preserve a permanent history snapshot before changing the student's current class/year.
      await supabase.from('academic_history').insert({
        student_id: s.id,
        academic_year_id: s.academic_year_id,
        class_id: fromClassId,
        promotion_status: decision,
      });

      const update: Partial<Student> = {};
      if (decision === 'Promoted') {
        update.current_class_id = toClassId || s.current_class_id;
        update.academic_year_id = nextYearId || s.academic_year_id;
      } else if (decision === 'Repeated') {
        update.academic_year_id = nextYearId || s.academic_year_id;
      } else {
        update.status = decision;
      }
      await supabase.from('students').update(update).eq('id', s.id);
    }
    await logActivity('promotion_run', { from_class: fromClassId, to_class: toClassId, count: students.length });
    setSubmitting(false);
    setDone(true);
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Promotion</h1>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select value={fromClassId} onChange={(e) => { setFromClassId(e.target.value); setDone(false); }} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">From class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={toClassId} onChange={(e) => setToClassId(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">To class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={nextYearId} onChange={(e) => setNextYearId(e.target.value)} className="col-span-2 rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Next academic year</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </div>

      {!fromClassId ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select a class to review promotion decisions.</p>
      ) : students.length === 0 ? (
        <EmptyState message="No active students found in this class." />
      ) : done ? (
        <p className="py-10 text-center text-sm text-green-400">Promotion applied to {students.length} students. Historical records were preserved.</p>
      ) : (
        <>
          <div className="space-y-2">
            {students.map((s) => (
              <Card key={s.id} className="flex items-center justify-between">
                <div className="text-sm font-medium">{s.first_name} {s.last_name}</div>
                <select
                  value={decisions[s.id] ?? 'Promoted'}
                  onChange={(e) => setDecisions({ ...decisions, [s.id]: e.target.value as Decision })}
                  className="rounded-lg border border-neutral-700 bg-surface px-2 py-1 text-xs"
                >
                  {(['Promoted', 'Repeated', 'Graduated', 'Transferred', 'Withdrawn'] as Decision[]).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Card>
            ))}
          </div>
          <Button className="mt-4 w-full" disabled={submitting} onClick={confirmPromotion}>
            {submitting ? 'Applying…' : `Apply Promotion to ${students.length} Students`}
          </Button>
        </>
      )}
    </div>
  );
}
