import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Card, EmptyState } from '../components/ui';
import { friendlyDbError } from '../lib/errors';
import type { AcademicYear, SchoolClass, Subject, Teacher, ClassSubjectTeacher } from '../types';
import { Plus, X, Trash2 } from 'lucide-react';

export default function TeacherAssignments() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<ClassSubjectTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ClassSubjectTeacher> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: y }, { data: c }, { data: s }, { data: t }, { data: a }] = await Promise.all([
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('class_subject_teachers').select('*'),
    ]);
    setYears((y as AcademicYear[]) ?? []);
    setClasses((c as SchoolClass[]) ?? []);
    setSubjects((s as Subject[]) ?? []);
    setTeachers((t as Teacher[]) ?? []);
    setAssignments((a as ClassSubjectTeacher[]) ?? []);
    setLoading(false);
  }

  function className(id: string) { return classes.find((c) => c.id === id)?.name ?? '—'; }
  function subjectName(id: string) { return subjects.find((s) => s.id === id)?.name ?? '—'; }
  function teacherName(id: string | null) { return teachers.find((t) => t.id === id)?.full_name ?? 'Unassigned'; }
  function yearName(id: string) { return years.find((y) => y.id === id)?.name ?? '—'; }

  function openNew() {
    const active = years.find((y) => y.status === 'active');
    setEditing({ academic_year_id: active?.id ?? '' });
    setErrorMsg(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErrorMsg(null);
    setSaving(true);
    const payload = { ...editing };
    const isNew = !payload.id;
    delete (payload as any).id;
    const { error } = isNew
      ? await supabase.from('class_subject_teachers').insert(payload)
      : await supabase.from('class_subject_teachers').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) {
      setErrorMsg(friendlyDbError(error, { duplicate: 'This teacher is already assigned to that class and subject for this year.' }));
      return;
    }
    await logActivity(isNew ? 'assignment_created' : 'assignment_updated', {
      class: className(editing.class_id ?? ''), subject: subjectName(editing.subject_id ?? ''), teacher: teacherName(editing.teacher_id ?? null),
    });
    setEditing(null);
    load();
  }

  async function handleDelete(a: ClassSubjectTeacher) {
    if (!confirm(`Remove ${teacherName(a.teacher_id)} from ${subjectName(a.subject_id)} — ${className(a.class_id)}?`)) return;
    const { error } = await supabase.from('class_subject_teachers').delete().eq('id', a.id);
    if (error) { alert(friendlyDbError(error)); return; }
    await logActivity('assignment_removed', { class: className(a.class_id), subject: subjectName(a.subject_id), teacher: teacherName(a.teacher_id) });
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Teacher Assignments</h1>
        <Button onClick={openNew} className="flex items-center gap-1"><Plus size={16} /> Add</Button>
      </div>
      <p className="mb-3 text-[11px] text-neutral-500">
        This controls exactly what each teacher can see and grade. A teacher only ever sees the classes
        and subjects they're assigned here — nothing else, in the app or the database.
      </p>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : assignments.length === 0 ? (
        <EmptyState message="No teacher assignments yet — teachers won't see any classes until you add some." action={<Button onClick={openNew}>+ Add Assignment</Button>} />
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div onClick={() => { setEditing(a); setErrorMsg(null); }} className="flex-1">
                <div className="font-medium">{teacherName(a.teacher_id)}</div>
                <div className="text-xs text-neutral-400">{subjectName(a.subject_id)} · {className(a.class_id)} · {yearName(a.academic_year_id)}</div>
              </div>
              <button onClick={() => handleDelete(a)} className="text-neutral-500 hover:text-red-400"><Trash2 size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="app-overlay fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={handleSave} className="w-full rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editing.id ? 'Edit Assignment' : 'Add Assignment'}</h2>
              <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <select className="w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" required value={editing.teacher_id ?? ''} onChange={(e) => setEditing({ ...editing, teacher_id: e.target.value })}>
                <option value="">Teacher *</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <select className="w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" required value={editing.class_id ?? ''} onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}>
                <option value="">Class *</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" required value={editing.subject_id ?? ''} onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}>
                <option value="">Subject *</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" required value={editing.academic_year_id ?? ''} onChange={(e) => setEditing({ ...editing, academic_year_id: e.target.value })}>
                <option value="">Academic Year *</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            {errorMsg && <p className="mt-2 text-sm text-red-400">{errorMsg}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
