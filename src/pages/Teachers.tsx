import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, EmptyState, StatusPill, SavingIndicator } from '../components/ui';
import type { Teacher } from '../types';
import { Plus, X } from 'lucide-react';
import { PhotoUpload } from '../components/PhotoUpload';
import { friendlyDbError } from '../lib/errors';

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Teacher> | null>(null);
  const [password, setPassword] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('teachers').select('*').order('full_name');
    setTeachers((data as Teacher[]) ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditing({ status: 'Active' });
    setPassword('');
    setErrorMsg(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErrorMsg(null);

    const isNew = !editing.id;

    if (isNew) {
      // New teachers get a real login account created via the server-side
      // function (it needs the service-role key, which never runs in the browser).
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
    } else {
      // Editing an existing teacher only updates their record, not their login.
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
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
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
