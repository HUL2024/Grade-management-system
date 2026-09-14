import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, EmptyState, StatusPill, SavingIndicator } from '../components/ui';
import type { Teacher, SchoolClass, Subject, AcademicYear, ClassSubjectTeacher } from '../types';
import { Plus, X, Trash2 } from 'lucide-react';
import { PhotoUpload } from '../components/PhotoUpload';
import { friendlyDbError } from '../lib/errors';

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Teacher> | null>(null);
  const [password, setPassword] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Assignment management, embedded right in this form.
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [assignments, setAssignments] = useState<ClassSubjectTeacher[]>([]);
  const [newAssignment, setNewAssignment] = useState<{ class_id: string; subject_id: string; academic_year_id: string }>({ class_id: '', subject_id: '', academic_year_id: '' });
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  useEffect(() => { load(); loadAssignmentOptions(); }, []);
  useEffect(() => { if (editing?.id) loadAssignments(editing.id); }, [editing?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('teachers').select('*').order('full_name');
    setTeachers((data as Teacher[]) ?? []);
    setLoading(false);
  }

  async function loadAssignmentOptions() {
    const [{ data: c }, { data: s }, { data: y }] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
    ]);
    setClasses((c as SchoolClass[]) ?? []);
    setSubjects((s as Subject[]) ?? []);
    const yearList = (y as AcademicYear[]) ?? [];
    setYears(yearList);
    const active = yearList.find((yr) => yr.status === 'active');
    setNewAssignment((prev) => ({ ...prev, academic_year_id: prev.academic_year_id || active?.id || '' }));
  }

  async function loadAssignments(teacherId: string) {
    const { data } = await supabase.from('class_subject_teachers').select('*').eq('teacher_id', teacherId);
    setAssignments((data as ClassSubjectTeacher[]) ?? []);
  }

  function className(id: string) { return classes.find((c) => c.id === id)?.name ?? '—'; }
  function subjectName(id: string) { return subjects.find((s) => s.id === id)?.name ?? '—'; }
  function yearName(id: string) { return years.find((y) => y.id === id)?.name ?? '—'; }

  function openNew() {
    setEditing({ status: 'Active' });
    setPassword('');
    setErrorMsg(null);
    setAssignments([]);
  }

  async function addAssignment() {
    if (!editing?.id) return;
    setAssignmentError(null);
    if (!newAssignment.class_id || !newAssignment.subject_id || !newAssignment.academic_year_id) {
      setAssignmentError('Choose a class, subject and academic year first.');
      return;
    }
    setAssignmentSaving(true);
    const { error } = await supabase.from('class_subject_teachers').insert({
      teacher_id: editing.id,
      class_id: newAssignment.class_id,
      subject_id: newAssignment.subject_id,
      academic_year_id: newAssignment.academic_year_id,
    });
    setAssignmentSaving(false);
    if (error) {
      setAssignmentError(friendlyDbError(error, { duplicate: 'This teacher is already assigned to that class and subject for this year.' }));
      return;
    }
    await logActivity('assignment_created', { teacher: editing.full_name, class: className(newAssignment.class_id), subject: subjectName(newAssignment.subject_id) });
    loadAssignments(editing.id);
  }

  async function removeAssignment(a: ClassSubjectTeacher) {
    // Removing an assignment only changes who is CURRENTLY assigned — it never
    // touches grades already entered, which stay exactly as they were recorded.
    if (!confirm(`Remove ${subjectName(a.subject_id)} — ${className(a.class_id)} from this teacher? Grades they already entered are not affected.`)) return;
    await supabase.from('class_subject_teachers').delete().eq('id', a.id);
    await logActivity('assignment_removed', { teacher: editing?.full_name, class: className(a.class_id), subject: subjectName(a.subject_id) });
    if (editing?.id) loadAssignments(editing.id);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErrorMsg(null);

    const isNew = !editing.id;

    if (isNew) {
      if (!editing.phone) {
        setErrorMsg('Phone number is required — teachers log in with their phone number.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMsg('Please set a password of at least 6 characters for this teacher.');
        return;
      }
      setSaveState('saving');
      const { data, error } = await supabase.functions.invoke('create-staff-account', {
        body: {
          full_name: editing.full_name,
          phone: editing.phone,
          password,
          teacher_code: editing.teacher_code,
          gender: editing.gender,
          qualification: editing.qualification,
          specialization: editing.specialization,
          employment_date: editing.employment_date,
          address: editing.address,
          email: editing.email,
          status: editing.status ?? 'Active',
          photo_url: editing.photo_url,
        },
      });
      if (error || (data as any)?.error) {
        setSaveState('error');
        const rawMessage = (data as any)?.error ?? error?.message ?? 'Could not create the teacher account.';
        setErrorMsg(friendlyDbError({ message: rawMessage }));
        return;
      }
      await logActivity('teacher_created', { name: editing.full_name });
      setSaveState('saved');
      await load();
      // Keep the form open, switched into "edit" mode for the teacher we just
      // created, so assignments can be added immediately in the same place.
      const newTeacherId = (data as any)?.teacher_id as string | undefined;
      if (newTeacherId) {
        const { data: freshTeacher } = await supabase.from('teachers').select('*').eq('id', newTeacherId).single();
        if (freshTeacher) {
          setEditing(freshTeacher as Teacher);
          return;
        }
      }
      setEditing(null);
      return;
    } else {
      const payload = { ...editing };
      delete (payload as any).id;
      setSaveState('saving');
      const { error } = await supabase.from('teachers').update(payload).eq('id', editing.id);
      if (error) {
        setSaveState('error');
        setErrorMsg(friendlyDbError(error));
        return;
      }
      await logActivity('teacher_updated', { name: editing.full_name });
    }

    setSaveState('saved');
    setEditing(null);
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Teachers</h1>
        <Button onClick={openNew} className="flex items-center gap-1"><Plus size={16} /> Add</Button>
      </div>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : teachers.length === 0 ? (
        <EmptyState message="No teachers have been added yet." action={<Button onClick={openNew}>+ Add Teacher</Button>} />
      ) : (
        <div className="space-y-2">
          {teachers.map((t) => (
            <Card key={t.id} onClick={() => { setEditing(t); setErrorMsg(null); }} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {t.photo_url ? (
                  <img src={t.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-surface" />
                )}
                <div>
                  <div className="font-medium">{t.full_name}</div>
                  <div className="text-xs text-neutral-400">{t.teacher_code} · {t.specialization ?? 'No specialization set'}</div>
                </div>
              </div>
              <StatusPill text={t.status} tone={t.status === 'Active' ? 'good' : 'neutral'} />
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="app-overlay fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={handleSave} className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editing.id ? 'Edit Teacher' : 'Add Teacher'}</h2>
              <div className="flex items-center gap-2">
                <SavingIndicator state={saveState} />
                <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
              </div>
            </div>

            {!editing.id && (
              <p className="mb-2 rounded-lg bg-surface p-2 text-[11px] text-neutral-400">
                This creates a real login for the teacher. They'll sign in using their phone number and the password you set below.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <PhotoUpload value={editing.photo_url} onChange={(url) => setEditing({ ...editing, photo_url: url })} folder="teachers" />
              <Input placeholder="Teacher ID *" required value={editing.teacher_code ?? ''} onChange={(e) => setEditing({ ...editing, teacher_code: e.target.value })} />
              <Input placeholder="Full name *" required value={editing.full_name ?? ''} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              <select className="rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.gender ?? ''} onChange={(e) => setEditing({ ...editing, gender: e.target.value as any })}>
                <option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option>
              </select>
              <Input placeholder="Phone (used to log in) *" required value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} disabled={!!editing.id} />
              {!editing.id && (
                <Input
                  className="col-span-2"
                  type="password"
                  placeholder="Set login password (min 6 characters) *"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              <Input className="col-span-2" placeholder="Email (optional)" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              <Input placeholder="Qualification" value={editing.qualification ?? ''} onChange={(e) => setEditing({ ...editing, qualification: e.target.value })} />
              <Input placeholder="Specialization" value={editing.specialization ?? ''} onChange={(e) => setEditing({ ...editing, specialization: e.target.value })} />
              <Input type="date" placeholder="Employment date" value={editing.employment_date ?? ''} onChange={(e) => setEditing({ ...editing, employment_date: e.target.value })} />
              <select className="rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.status ?? 'Active'} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                <option value="Active">Active</option><option value="Inactive">Inactive</option>
              </select>
              <Input className="col-span-2" placeholder="Address" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </div>

            {editing.id && (
              <p className="mt-2 text-[11px] text-neutral-500">Phone number can't be changed here since it's tied to their login. Use Supabase Authentication directly if it needs to change.</p>
            )}
            {errorMsg && <p className="mt-2 text-sm text-red-400">{errorMsg}</p>}

            {editing.id && (
              <div className="mt-4 border-t border-neutral-800 pt-3">
                <h3 className="mb-1 text-sm font-semibold text-gold">Classes & Subjects Assigned</h3>
                <p className="mb-2 text-[11px] text-neutral-500">
                  Only what's listed here is visible to this teacher. Removing an assignment doesn't change any grades they already entered.
                </p>

                {assignments.length === 0 ? (
                  <p className="mb-2 text-xs text-neutral-500">No assignments yet — this teacher won't see any classes until you add one below.</p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface px-2 py-1.5 text-xs">
                        <span>{subjectName(a.subject_id)} · {className(a.class_id)} · {yearName(a.academic_year_id)}</span>
                        <button type="button" onClick={() => removeAssignment(a)} className="text-neutral-500 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <select className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-xs" value={newAssignment.class_id} onChange={(e) => setNewAssignment({ ...newAssignment, class_id: e.target.value })}>
                    <option value="">Class</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-xs" value={newAssignment.subject_id} onChange={(e) => setNewAssignment({ ...newAssignment, subject_id: e.target.value })}>
                    <option value="">Subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select className="col-span-2 rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-xs" value={newAssignment.academic_year_id} onChange={(e) => setNewAssignment({ ...newAssignment, academic_year_id: e.target.value })}>
                    <option value="">Academic Year</option>
                    {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
                {assignmentError && <p className="mt-1 text-xs text-red-400">{assignmentError}</p>}
                <Button type="button" variant="ghost" className="mt-2 w-full" disabled={assignmentSaving} onClick={addAssignment}>
                  {assignmentSaving ? 'Adding…' : '+ Add Assignment'}
                </Button>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saveState === 'saving'}>{saveState === 'saving' ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
