import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui';
import type { SchoolClass, Grade } from '../types';

export default function Reports() {
  const [, setClasses] = useState<SchoolClass[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [classStats, setClassStats] = useState<{ name: string; average: number | null; passRate: number | null }[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: c }, { data: allGrades }] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('grades').select('*'),
    ]);
    const classesList = (c as SchoolClass[]) ?? [];
    const grades = (allGrades as Grade[]) ?? [];

    setClasses(classesList);
    setMissingCount(grades.filter((g) => g.entry_status === 'missing' || g.entry_status === 'not_entered').length);
    setSubmittedCount(grades.filter((g) => g.grade_status === 'submitted').length);
    setLockedCount(grades.filter((g) => g.grade_status === 'locked').length);

    const stats = classesList.map((cl) => {
      const classGrades = grades.filter((g) => g.class_id === cl.id && g.score !== null);
      const average = classGrades.length ? classGrades.reduce((sum, g) => sum + (g.score ?? 0), 0) / classGrades.length : null;
      const passing = classGrades.filter((g) => (g.score ?? 0) >= 50).length;
      const passRate = classGrades.length ? Math.round((passing / classGrades.length) * 100) : null;
      return { name: cl.name, average, passRate };
    });
    setClassStats(stats);
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Reports Center</h1>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card className="text-center"><div className="text-xl font-semibold">{missingCount}</div><div className="text-[10px] text-neutral-400">Missing grades</div></Card>
        <Card className="text-center"><div className="text-xl font-semibold">{submittedCount}</div><div className="text-[10px] text-neutral-400">Submitted</div></Card>
        <Card className="text-center"><div className="text-xl font-semibold">{lockedCount}</div><div className="text-[10px] text-neutral-400">Locked</div></Card>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Class Performance</h2>
      <div className="space-y-2">
        {classStats.map((cs) => (
          <Card key={cs.name} className="flex items-center justify-between">
            <div className="text-sm font-medium">{cs.name}</div>
            <div className="text-xs text-neutral-400">
              Avg {cs.average !== null ? cs.average.toFixed(1) : '—'} · Pass rate {cs.passRate !== null ? `${cs.passRate}%` : '—'}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
