import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Card, SavingIndicator } from '../components/ui';
import type { SchoolClass, Student, AttendanceRecord, AttendanceStatus, AcademicYear } from '../types';

const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];

export default function Attendance() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rowState, setRowState] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('academic_years').select('*').eq('status', 'active'),
    ]).then(([{ data: c }, { data: y }]) => {
      setClasses((c as SchoolClass[]) ?? []);
      setYears((y as AcademicYear[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (classId) {
      supabase.from('students').select('*').eq('current_class_id', classId).eq('status', 'Active').order('last_name')
        .then(({ data }) => setStudents((data as Student[]) ?? []));
    }
  }, [classId]);

  useEffect(() => {
    if (classId && date) {
      supabase.from('attendance').select('*').eq('class_id', classId).eq('date', date)
        .then(({ data }) => setRecords((data as AttendanceRecord[]) ?? []));
    }
  }, [classId, date]);

  function recordFor(studentId: string) {
    return records.find((r) => r.student_id === studentId);
  }

  async function mark(studentId: string, status: AttendanceStatus) {
    setRowState((prev) => ({ ...prev, [studentId]: 'saving' }));
    const activeYear = years[0];
    const existing = recordFor(studentId);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      student_id: studentId,
      class_id: classId,
      academic_year_id: activeYear?.id,
      date,
      status,
      marked_by: userData.user?.id ?? null,
    };
    const { error } = existing
      ? await supabase.from('attendance').update(payload).eq('id', existing.id)
      : await supabase.from('attendance').insert(payload);
    if (error) {
      setRowState((prev) => ({ ...prev, [studentId]: 'error' }));
      return;
    }
    setRowState((prev) => ({ ...prev, [studentId]: 'saved' }));
    const { data } = await supabase.from('attendance').select('*').eq('class_id', classId).eq('date', date);
    setRecords((data as AttendanceRecord[]) ?? []);
    setTimeout(() => setRowState((prev) => ({ ...prev, [studentId]: 'idle' })), 1200);
  }

  async function markAllPresent() {
    if (!confirm('Mark all students in this class Present for today?')) return;
    for (const s of students) {
      if (!recordFor(s.id)) await mark(s.id, 'Present');
    }
    await logActivity('attendance_bulk_marked', { class_id: classId, date });
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Attendance</h1>
      <div className="mb-3 flex gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="flex-1 rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Select class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm" />
      </div>

      {!classId ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select a class to mark attendance.</p>
      ) : students.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">No active students in this class.</p>
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" onClick={markAllPresent}>Mark all Present</Button>
          </div>
          <div className="space-y-2">
            {students.map((s) => {
              const r = recordFor(s.id);
              const state = rowState[s.id] ?? 'idle';
              return (
                <Card key={s.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 text-sm font-medium">{s.first_name} {s.last_name}</div>
                  <SavingIndicator state={state} />
                  <div className="flex gap-1">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        onClick={() => mark(s.id, st)}
                        className={`rounded-md px-2 py-1 text-[11px] ${
                          r?.status === st ? 'bg-gold text-black' : 'bg-surface text-neutral-300'
                        }`}
                      >
                        {st[0]}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
