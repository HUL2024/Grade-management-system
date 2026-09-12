import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, EmptyState } from '../components/ui';

interface LogRow {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, full_name'),
    ]).then(([{ data: l }, { data: p }]) => {
      setLogs((l as LogRow[]) ?? []);
      const map: Record<string, string> = {};
      (p ?? []).forEach((u: any) => (map[u.id] = u.full_name));
      setUserNames(map);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">Activity Log</h1>
      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : logs.length === 0 ? (
        <EmptyState message="No activity recorded yet." />
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <Card key={log.id} className="py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-200">{log.action.replace(/_/g, ' ')}</span>
                <span className="text-neutral-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-neutral-500">
                {log.user_id ? userNames[log.user_id] ?? 'Unknown user' : 'System'}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
