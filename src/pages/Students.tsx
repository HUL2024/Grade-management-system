import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card, EmptyState, StatusPill, SavingIndicator } from '../components/ui';
import type { Student, SchoolClass } from '../types';
import { Plus, Search, X } from 'lucide-react';
import { PhotoUpload } from '../components/PhotoUpload';
import { friendlyDbError } from '../lib/errors';

const emptyForm: Partial<Student> = {
  status: 'Active',
};

export default function Students() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('administrator', 'principal', 'academic_officer');

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('students').select('*').order('last_name'),
      supabase.from('classes').select('*'),
    ]);
    setStudents((s as Student[]) ?? []);
    setClasses((c as SchoolClass[]) ?? []);
    setLoading(false);
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      s.student_code.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q);
    const matchesClass = !classFilter || s.current_class_id === classFilter;
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  });

  function className(id: string | null) {
    return classes.find((c) => c.id === id)?.name ?? '—';
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErrorMsg(null);
    setSaveState('saving');
    const payload = { ...editing };
    const isNew = !payload.id;
    delete (payload as any).id;

    const { error } = isNew
      ? await supabase.from('students').insert(payload)
      : await supabase.from('students').update(payload).eq('id', editing.id);

    if (error) {
      setSaveState('error');
      setErrorMsg(friendlyDbError(error));
      return;
    }
    await logActivity(isNew ? 'student_created' : 'student_updated', { student_code: editing.student_code });
    setSaveState('saved');
    setEditing(null);
    load();
  }

  async function handleArchive(student: Student) {
    if (!confirm(`Archive ${student.first_name} ${student.last_name}? This will mark them Inactive but keep their records.`)) return;
    await supabase.from('students').update({ status: 'Inactive' }).eq('id', student.id);
    await logActivity('student_archived', { student_code: student.student_code });
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Students</h1>
        {canEdit && (
          <Button onClick={() => { setEditing({ ...emptyForm }); setErrorMsg(null); }} className="flex items-center gap-1">
            <Plus size={16} /> Add
          </Button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input placeholder="Search name, ID, admission #" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-1 text-xs text-neutral-100">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-1 text-xs text-neutral-100">
          <option value="">All statuses</option>
          {['Active', 'Inactive', 'Transferred', 'Withdrawn', 'Graduated'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          message="No students have been added yet."
          action={canEdit ? <Button onClick={() => { setEditing({ ...emptyForm }); setErrorMsg(null); }}>+ Add Student</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div onClick={() => canEdit && setEditing(s)} className="flex flex-1 items-center gap-3">
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-surface" />
                )}
                <div>
                  <div className="font-medium">{s.first_name} {s.last_name}</div>
                  <div className="text-xs text-neutral-400">
                    {s.student_code} · {className(s.current_class_id)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill
                  text={s.status}
                  tone={s.status === 'Active' ? 'good' : s.status === 'Graduated' ? 'neutral' : 'warn'}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={handleSave} className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editing.id ? 'Edit Student' : 'Add Student'}</h2>
              <div className="flex items-center gap-2">
                <SavingIndicator state={saveState} />
                <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PhotoUpload value={editing.photo_url} onChange={(url) => setEditing({ ...editing, photo_url: url })} folder="students" />
              <Input placeholder="Student ID *" required value={editing.student_code ?? ''} onChange={(e) => setEditing({ ...editing, student_code: e.target.value })} />
              <Input placeholder="Admission # *" required value={editing.admission_number ?? ''} onChange={(e) => setEditing({ ...editing, admission_number: e.target.value })} />
              <Input placeholder="First name *" required value={editing.first_name ?? ''} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
              <Input placeholder="Middle name" value={editing.middle_name ?? ''} onChange={(e) => setEditing({ ...editing, middle_name: e.target.value })} />
              <Input placeholder="Last name *" required value={editing.last_name ?? ''} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
              <Input type="date" placeholder="Date of birth" value={editing.date_of_birth ?? ''} onChange={(e) => setEditing({ ...editing, date_of_birth: e.target.value })} />
              <select className="rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.gender ?? ''} onChange={(e) => setEditing({ ...editing, gender: e.target.value as any })}>
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <select className="rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.current_class_id ?? ''} onChange={(e) => setEditing({ ...editing, current_class_id: e.target.value })}>
                <option value="">Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Input placeholder="Section" value={editing.section ?? ''} onChange={(e) => setEditing({ ...editing, section: e.target.value })} />
              <select className="rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.status ?? 'Active'} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                {['Active', 'Inactive', 'Transferred', 'Withdrawn', 'Graduated'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Input className="col-span-2" placeholder="Address" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              <Input className="col-span-2" placeholder="Guardian name" value={editing.guardian_name ?? ''} onChange={(e) => setEditing({ ...editing, guardian_name: e.target.value })} />
              <Input placeholder="Guardian relationship" value={editing.guardian_relationship ?? ''} onChange={(e) => setEditing({ ...editing, guardian_relationship: e.target.value })} />
              <Input placeholder="Guardian phone" value={editing.guardian_phone ?? ''} onChange={(e) => setEditing({ ...editing, guardian_phone: e.target.value })} />
              <Input className="col-span-2" placeholder="Emergency contact" value={editing.emergency_contact ?? ''} onChange={(e) => setEditing({ ...editing, emergency_contact: e.target.value })} />
            </div>
            {errorMsg && <p className="mt-2 text-sm text-red-400">{errorMsg}</p>}
            <div className="mt-4 flex justify-between gap-2">
              {editing.id && (
                <Button type="button" variant="danger" onClick={() => { handleArchive(editing as Student); setEditing(null); }}>
                  Archive
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saveState === 'saving'}>{saveState === 'saving' ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
