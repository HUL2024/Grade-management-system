import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, EmptyState, StatusPill } from '../components/ui';
import type { AssessmentType } from '../types';
import { friendlyDbError } from '../lib/errors';
import { Plus, X, Trash2 } from 'lucide-react';

export default function AssessmentTypes() {
  const [items, setItems] = useState<AssessmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AssessmentType> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('assessment_types').select('*').order('sort_order');
    setItems((data as AssessmentType[]) ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditing({ category: 'ca', max_score: 100, sort_order: items.length });
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
      ? await supabase.from('assessment_types').insert(payload)
      : await supabase.from('assessment_types').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) { setErrorMsg(friendlyDbError(error)); return; }
    await logActivity(isNew ? 'assessment_type_created' : 'assessment_type_updated', { name: editing.name });
    setEditing(null);
    load();
  }

  async function handleDelete(item: AssessmentType) {
    if (!confirm(`Delete "${item.name}"? Any grades already entered against it will remain but won't show up for new entry.`)) return;
    const { error } = await supabase.from('assessment_types').delete().eq('id', item.id);
    if (error) { alert(friendlyDbError(error)); return; }
    await logActivity('assessment_type_deleted', { name: item.name });
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Assessments</h1>
        <Button onClick={openNew} className="flex items-center gap-1"><Plus size={16} /> Add</Button>
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        Assessment types are the components that make up a grade — e.g. Class Participation,
        Homework 1, Quiz 1, Test. Mark each as either Continuous Assessment (CA) or Exam so it
        rolls into the right weight in Settings.
      </p>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState message="No assessment types have been set up yet." action={<Button onClick={openNew}>+ Add Assessment Type</Button>} />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="flex items-center justify-between">
              <div onClick={() => { setEditing(item); setErrorMsg(null); }} className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-neutral-400">Max score {item.max_score}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill text={item.category === 'ca' ? 'CA' : 'Exam'} tone={item.category === 'ca' ? 'neutral' : 'warn'} />
                <button onClick={() => handleDelete(item)} className="text-neutral-500 hover:text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="app-overlay fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={handleSave} className="w-full rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editing.id ? 'Edit Assessment Type' : 'Add Assessment Type'}</h2>
              <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input className="col-span-2" placeholder="Name (e.g. Homework 1) *" required value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <select className="rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm" value={editing.category ?? 'ca'} onChange={(e) => setEditing({ ...editing, category: e.target.value as any })}>
                <option value="ca">Continuous Assessment (CA)</option>
                <option value="exam">Exam</option>
              </select>
              <Input type="number" placeholder="Max score" value={editing.max_score ?? 100} onChange={(e) => setEditing({ ...editing, max_score: Number(e.target.value) })} />
              <Input type="number" className="col-span-2" placeholder="Sort order (display order)" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
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
