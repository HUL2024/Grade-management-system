import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Input, Card, SavingIndicator } from '../components/ui';
import type { SchoolSettings, GradeScaleRow } from '../types';

export default function Settings() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [scale, setScale] = useState<GradeScaleRow[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: s }, { data: gs }] = await Promise.all([
      supabase.from('school_settings').select('*').single(),
      supabase.from('grade_scale').select('*').order('min_score', { ascending: false }),
    ]);
    setSettings(s as SchoolSettings);
    setScale((gs as GradeScaleRow[]) ?? []);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaveState('saving');
    const { error } = await supabase.from('school_settings').update(settings).eq('id', 1);
    if (error) { setSaveState('error'); return; }
    await logActivity('settings_updated');
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1500);
  }

  async function saveScaleRow(row: GradeScaleRow) {
    await supabase.from('grade_scale').update(row).eq('id', row.id);
    load();
  }

  if (!settings) return <p className="p-6 text-center text-neutral-500">Loading…</p>;

  return (
    <div className="p-4 pb-10">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Settings</h1>
        <SavingIndicator state={saveState} />
      </div>

      <Card className="mb-3 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-300">School Information</h2>
        <Input placeholder="School name" value={settings.school_name} onChange={(e) => setSettings({ ...settings, school_name: e.target.value })} />
        <Input placeholder="Motto" value={settings.motto ?? ''} onChange={(e) => setSettings({ ...settings, motto: e.target.value })} />
        <Input placeholder="Address" value={settings.address ?? ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
        <Input placeholder="Phone" value={settings.phone ?? ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
        <Input placeholder="Email" value={settings.email ?? ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
      </Card>

      <Card className="mb-3 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-300">Assessment Weights</h2>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.ca_weight} onChange={(e) => setSettings({ ...settings, ca_weight: Number(e.target.value) })} />
          <span className="text-xs text-neutral-400">% Continuous Assessment</span>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.exam_weight} onChange={(e) => setSettings({ ...settings, exam_weight: Number(e.target.value) })} />
          <span className="text-xs text-neutral-400">% Final Examination</span>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.passing_mark} onChange={(e) => setSettings({ ...settings, passing_mark: Number(e.target.value) })} />
          <span className="text-xs text-neutral-400">Passing mark</span>
        </div>
        <div>
          <label className="text-xs text-neutral-400">Tie handling</label>
          <select value={settings.tie_rule} onChange={(e) => setSettings({ ...settings, tie_rule: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
            <option value="shared_rank">Shared rank (ties share the same position)</option>
            <option value="next_rank_skip">Skip ranks after ties</option>
          </select>
        </div>
      </Card>

      <Card className="mb-3">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">Grading Scale</h2>
        <div className="space-y-2">
          {scale.map((row) => (
            <div key={row.id} className="grid grid-cols-5 items-center gap-1 text-xs">
              <Input type="number" value={row.min_score} onChange={(e) => saveScaleRow({ ...row, min_score: Number(e.target.value) })} />
              <Input type="number" value={row.max_score} onChange={(e) => saveScaleRow({ ...row, max_score: Number(e.target.value) })} />
              <Input value={row.letter} onChange={(e) => saveScaleRow({ ...row, letter: e.target.value })} />
              <Input value={row.description ?? ''} onChange={(e) => saveScaleRow({ ...row, description: e.target.value })} />
              <input type="color" value={row.color} onChange={(e) => saveScaleRow({ ...row, color: e.target.value })} className="h-9 w-full rounded" />
            </div>
          ))}
        </div>
      </Card>

      <Button className="w-full" onClick={saveSettings}>Save Settings</Button>
    </div>
  );
}
