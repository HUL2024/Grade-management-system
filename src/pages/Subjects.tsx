import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, EmptyState } from '../components/ui';
import { friendlyDbError } from '../lib/errors';
import type { Subject } from '../types';
import { Plus, X } from 'lucide-react';

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Subject> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('subjects').select('*').order('name');
    setSubjects((data as Subject[]) ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditing({ max_score: 100, passing_score: 50 });
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
      ? await supabase.from('subjects').insert(payload)
      : await supabase.from('subjects').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) {
      setErrorMsg(friendlyDbError(error));
      return;
    }
    await logActivity(isNew ? 'subject_created' : 'subject_updated', { name: editing.name });
    setEditing(null);
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Subjects</h1>
        <Button onClick={openNew} className="flex items-center gap-1"><Plus size={16} /> Add</Button>
      </div>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : subjects.length === 0 ? (
        <EmptyState message="No subjects have been added yet." action={<Button onClick={openNew}>+ Add Subject</Button>} />
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <Card key={s.id} onClick={() => { setEditing(s); setErrorMsg(null); }} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-neutral-400">{s.code} · Max {s.max_score} · Pass {s.passing_score}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={handleSave} className="w-full rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editing.id ? 'Edit Subject' : 'Add Subject'}</h2>
              <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input className="col-span-2" placeholder="Subject name *" required value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input placeholder="Code *" required value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
              <Input type="number" placeholder="Max score" value={editing.max_score ?? 100} onChange={(e) => setEditing({ ...editing, max_score: Number(e.target.value) })} />
              <Input type="number" placeholder="Passing score" value={editing.passing_score ?? 50} onChange={(e) => setEditing({ ...editing, passing_score: Number(e.target.value) })} />
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
