import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Button, Card } from '../components/ui';

const TABLES = ['students', 'teachers', 'classes', 'subjects', 'academic_years', 'periods', 'grades', 'attendance', 'school_settings'];

export default function BackupRestore() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function createBackup() {
    setBusy(true);
    setStatus('Backup in progress…');
    const backup: Record<string, unknown> = { created_at: new Date().toISOString(), tables: {} };
    for (const table of TABLES) {
      const { data } = await supabase.from(table).select('*');
      (backup.tables as Record<string, unknown>)[table] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ajb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await logActivity('backup_created');
    setStatus('Backup completed and downloaded.');
    setBusy(false);
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      setStatus('That file is not a valid backup.');
      return;
    }
    if (!confirm('Restoring will overwrite current data in the restored tables with the backup contents. This cannot be undone. Continue?')) {
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setBusy(true);
    setStatus('Restoring…');
    for (const table of Object.keys(parsed.tables ?? {})) {
      const rows = parsed.tables[table];
      if (Array.isArray(rows) && rows.length) {
        await supabase.from(table).upsert(rows);
      }
    }
    await logActivity('backup_restored', { source_created_at: parsed.created_at });
    setStatus('Restore completed.');
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Backup & Restore</h1>

      <Card className="mb-3 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-300">Create Backup</h2>
        <p className="text-xs text-neutral-500">Exports students, teachers, classes, subjects, academic years, periods, grades, attendance and settings to a JSON file.</p>
        <Button onClick={createBackup} disabled={busy} className="w-full">{busy ? 'Working…' : 'Create & Download Backup'}</Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-300">Restore from Backup</h2>
        <p className="text-xs text-neutral-500">This will overwrite matching records with the contents of the backup file. A confirmation is required before anything is changed.</p>
        <input ref={fileInput} type="file" accept="application/json" onChange={handleRestoreFile} disabled={busy} className="text-xs text-neutral-300" />
      </Card>

      {status && <p className="mt-3 text-center text-sm text-gold">{status}</p>}
    </div>
  );
}
