import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, EmptyState } from '../components/ui';
import type { Student } from '../types';

interface AcademicHistoryRow {
  id: string;
  academic_year_id: string;
  class_id: string;
  average_score: number | null;
  overall_position: number | null;
  attendance_percentage: number | null;
  promotion_status: string | null;
}

export default function AcademicHistoryPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState<AcademicHistoryRow[]>([]);
  const [years, setYears] = useState<Record<string, string>>({});
  const [classNames, setClassNames] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('students').select('*').order('last_name').then(({ data }) => setStudents((data as Student[]) ?? []));
    supabase.from('academic_years').select('id, name').then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((y: any) => (map[y.id] = y.name));
      setYears(map);
    });
    supabase.from('classes').select('id, name').then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((c: any) => (map[c.id] = c.name));
      setClassNames(map);
    });
  }, []);

  useEffect(() => {
    if (studentId) {
      supabase.from('academic_history').select('*').eq('student_id', studentId).order('recorded_at', { ascending: false })
        .then(({ data }) => setHistory((data as AcademicHistoryRow[]) ?? []));
    }
  }, [studentId]);

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Academic History</h1>
      <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mb-3 w-full rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
        <option value="">Select student</option>
        {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_code})</option>)}
      </select>

      {!studentId ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select a student to view their academic history.</p>
      ) : history.length === 0 ? (
        <EmptyState message="No historical records yet for this student. Records are created when an academic year is closed or a promotion is recorded." />
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <Card key={h.id}>
              <div className="flex items-center justify-between">
                <div className="font-medium">{years[h.academic_year_id] ?? 'Unknown year'}</div>
                <div className="text-xs text-neutral-400">{classNames[h.class_id]}</div>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-neutral-300">
                <div>Avg: {h.average_score?.toFixed(1) ?? '—'}</div>
                <div>Position: {h.overall_position ?? '—'}</div>
                <div>Attendance: {h.attendance_percentage ? `${h.attendance_percentage.toFixed(0)}%` : '—'}</div>
              </div>
              {h.promotion_status && <div className="mt-1 text-xs text-gold">{h.promotion_status}</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
