import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { Card, EmptyState, StatusPill } from '../components/ui';
import type { Profile, UserRole } from '../types';

const ROLES: UserRole[] = ['administrator', 'principal', 'teacher', 'academic_officer', 'viewer'];

export default function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }

  async function changeRole(user: Profile, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', user.id);
    await logActivity('user_role_changed', { user: user.full_name, role });
    load();
  }

  async function toggleActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    await logActivity(user.is_active ? 'user_deactivated' : 'user_activated', { user: user.full_name });
    load();
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">User Management</h1>
      <p className="mb-3 text-xs text-neutral-500">
        New staff accounts are created in Supabase Authentication, then appear here to assign a role. See README for the invite steps.
      </p>

      {loading ? (
        <p className="text-center text-neutral-500">Loading…</p>
      ) : users.length === 0 ? (
        <EmptyState message="No user accounts found yet." />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div className="font-medium">{u.full_name}</div>
                <StatusPill text={u.is_active ? 'Active' : 'Disabled'} tone={u.is_active ? 'good' : 'bad'} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select value={u.role} onChange={(e) => changeRole(u, e.target.value as UserRole)} className="flex-1 rounded-lg border border-neutral-700 bg-surface px-2 py-1 text-xs">
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
                <button onClick={() => toggleActive(u)} className="rounded-lg bg-surface px-3 py-1 text-xs text-neutral-300">
                  {u.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
