import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, EmptyState } from '../components/ui';
import { friendlyDbError } from '../lib/errors';
import type { SchoolClass, Teacher, AcademicYear, Student } from '../types';
import { Plus, X } from 'lucide-react';

export default function Classes() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SchoolClass> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: t }, { data: y }, { data: s }] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('teachers').select('*'),
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
      supabase.from('students').select('id, current_class_id').eq('status', 'Active'),
    ]);
    setClasses((c as SchoolClass[]) ?? []);
    setTeachers((t as Teacher[]) ?? []);
    setYears((y as AcademicYear[]) ?? []);
    setStudents((s as Student[]) ?? []);
    setLoading(false);
  }

  function studentCount(classId: string) {
    return students.filter((s) => s.current_class_id === classId).length;
  }
  function teacherName(id: string | null) {
    return teachers.find((t) => t.id === id)?.full_name ?? 'Unassigned';
  }

  function openNew() {
    setEditing({});
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
      ? await supabase.from('classes').insert(payload)
      : await supabase.from('classes').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) {
      setErrorMsg(friendlyDbError(error));
      return;
    }
    await logActivity(isNew ? 'class_created' : 'class_updated', { name: editing.name });
    setEditing(null);
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Classes</h1>
        <Button onClick={openNew} className="flex items-center gap-1"><Plus size={16} /> Add</Button>
      </div>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : classes.length === 0 ? (
        <EmptyState message="No classes have been created yet." action={<Button onClick={openNew}>+ Add Class</Button>} />
      ) : (
        <div className="space-y-2">
          {classes.map((c) => (
            <Card key={c.id} onClick={() => { setEditing(c); setErrorMsg(null); }}>
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-neutral-400">{studentCount(c.id)} students</div>
              </div>
              <div className="text-xs text-neutral-500">Class teacher: {teacherName(c.class_teacher_id)}</div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={handleSave} className="w-full rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editing.id ? 'Edit Class' : 'Add Class'}</h2>
              <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <Input placeholder="Class name (e.g. Grade 7) *" required value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <select className="w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" required value={editing.academic_year_id ?? ''} onChange={(e) => setEditing({ ...editing, academic_year_id: e.target.value })}>
                <option value="">Academic year *</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <select className="w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.class_teacher_id ?? ''} onChange={(e) => setEditing({ ...editing, class_teacher_id: e.target.value })}>
                <option value="">Class teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
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
