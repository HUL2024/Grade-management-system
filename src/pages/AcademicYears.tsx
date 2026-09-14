import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, EmptyState, StatusPill } from '../components/ui';
import { friendlyDbError } from '../lib/errors';
import type { AcademicYear, Period } from '../types';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function AcademicYears() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingYear, setEditingYear] = useState<Partial<AcademicYear> | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<Partial<Period> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [closingYearId, setClosingYearId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: y }, { data: p }] = await Promise.all([
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
      supabase.from('periods').select('*').order('sort_order'),
    ]);
    setYears((y as AcademicYear[]) ?? []);
    setPeriods((p as Period[]) ?? []);
    setLoading(false);
  }

  async function saveYear(e: React.FormEvent) {
    e.preventDefault();
    if (!editingYear) return;
    setYearError(null);
    setSaving(true);
    const payload = { ...editingYear };
    const isNew = !payload.id;
    delete (payload as any).id;
    if (isNew && !payload.status) payload.status = 'active';
    const { error } = isNew
      ? await supabase.from('academic_years').insert(payload)
      : await supabase.from('academic_years').update(payload).eq('id', editingYear.id);
    setSaving(false);
    if (error) {
      setYearError(friendlyDbError(error));
      return;
    }
    await logActivity(isNew ? 'academic_year_created' : 'academic_year_updated', { name: editingYear.name });
    setEditingYear(null);
    load();
  }

  async function savePeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPeriod) return;
    setPeriodError(null);
    setSaving(true);
    const payload = { ...editingPeriod };
    const isNew = !payload.id;
    delete (payload as any).id;
    const { error } = isNew
      ? await supabase.from('periods').insert(payload)
      : await supabase.from('periods').update(payload).eq('id', editingPeriod.id);
    setSaving(false);
    if (error) {
      setPeriodError(friendlyDbError(error));
      return;
    }
    await logActivity(isNew ? 'period_created' : 'period_updated', { name: editingPeriod.name });
    setEditingPeriod(null);
    load();
  }

  async function closeYear(year: AcademicYear) {
    if (!confirm(`Close academic year ${year.name}? Historical records will be preserved and locked.`)) return;
    setClosingYearId(year.id);
    const { error } = await supabase.from('academic_years').update({ status: 'closed' }).eq('id', year.id);
    setClosingYearId(null);
    if (error) {
      alert(friendlyDbError(error));
      return;
    }
    await logActivity('academic_year_closed', { name: year.name });
    load();
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Academic Years</h1>
        <Button onClick={() => { setEditingYear({}); setYearError(null); }} className="flex items-center gap-1"><Plus size={16} /> Add</Button>
      </div>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : years.length === 0 ? (
        <EmptyState message="No academic years have been set up yet." action={<Button onClick={() => setEditingYear({})}>+ Add Academic Year</Button>} />
      ) : (
        <div className="space-y-2">
          {years.map((y) => (
            <Card key={y.id}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === y.id ? null : y.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <div className="font-medium">{y.name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {periods.filter((p) => p.academic_year_id === y.id).length} period(s) · tap to manage
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill text={y.status} tone={y.status === 'active' ? 'good' : 'neutral'} />
                  {expanded === y.id ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
                </div>
              </button>
              {expanded === y.id && (
                <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Periods</span>
                    <button className="text-xs text-gold" onClick={() => { setEditingPeriod({ academic_year_id: y.id, sort_order: periods.filter(p => p.academic_year_id === y.id).length }); setPeriodError(null); }}>
                      + Add period
                    </button>
                  </div>
                  {periods.filter((p) => p.academic_year_id === y.id).map((p) => (
                    <div key={p.id} onClick={() => { setEditingPeriod(p); setPeriodError(null); }} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
                      <span>{p.name}</span>
                      {p.is_exam_period && <StatusPill text="Exam" tone="warn" />}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" onClick={() => { setEditingYear(y); setYearError(null); }}>Edit</Button>
                    {y.status === 'active' && (
                      <Button variant="danger" disabled={closingYearId === y.id} onClick={() => closeYear(y)}>
                        {closingYearId === y.id ? 'Closing…' : 'Close Year'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editingYear && (
        <div className="app-overlay fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={saveYear} className="w-full rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editingYear.id ? 'Edit Year' : 'Add Academic Year'}</h2>
              <button type="button" onClick={() => setEditingYear(null)}><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <Input placeholder="e.g. 2026/2027 *" required value={editingYear.name ?? ''} onChange={(e) => setEditingYear({ ...editingYear, name: e.target.value })} />
              <Input type="date" value={editingYear.start_date ?? ''} onChange={(e) => setEditingYear({ ...editingYear, start_date: e.target.value })} />
              <Input type="date" value={editingYear.end_date ?? ''} onChange={(e) => setEditingYear({ ...editingYear, end_date: e.target.value })} />
            </div>
            {yearError && <p className="mt-2 text-sm text-red-400">{yearError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingYear(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </div>
      )}

      {editingPeriod && (
        <div className="app-overlay fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <form onSubmit={savePeriod} className="w-full rounded-t-2xl bg-ink-soft p-4 sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gold">{editingPeriod.id ? 'Edit Period' : 'Add Period'}</h2>
              <button type="button" onClick={() => setEditingPeriod(null)}><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <Input placeholder="Period name (e.g. First Period, Exam 1) *" required value={editingPeriod.name ?? ''} onChange={(e) => setEditingPeriod({ ...editingPeriod, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" placeholder="Start date (for attendance)" value={editingPeriod.start_date ?? ''} onChange={(e) => setEditingPeriod({ ...editingPeriod, start_date: e.target.value })} />
                <Input type="date" placeholder="End date (for attendance)" value={editingPeriod.end_date ?? ''} onChange={(e) => setEditingPeriod({ ...editingPeriod, end_date: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="checkbox" checked={editingPeriod.is_exam_period ?? false} onChange={(e) => setEditingPeriod({ ...editingPeriod, is_exam_period: e.target.checked })} />
                This is an exam period
              </label>
            </div>
            {periodError && <p className="mt-2 text-sm text-red-400">{periodError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingPeriod(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
