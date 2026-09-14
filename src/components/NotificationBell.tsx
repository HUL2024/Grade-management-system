import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

export default function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data as AppNotification[]) ?? []);
  }

  const unreadCount = notifications.length;

  async function markAllRead() {
    const unreadIds = notifications.map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications([]);
  }

  async function markRead(n: AppNotification) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    setNotifications((prev) => prev.filter((item) => item.id !== n.id));
  }

  function timeAgo(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative p-1 text-gold">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 max-h-80 w-72 overflow-y-auto rounded-xl border border-neutral-800 bg-ink-soft shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-800 p-2">
              <span className="text-xs font-semibold text-neutral-300">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-gold">Clear all</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="p-3 text-center text-xs text-neutral-500">No new notifications.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className="block w-full border-b border-neutral-800 p-2 text-left text-xs text-neutral-100 last:border-0"
                >
                  <div className="flex items-start gap-1.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{n.message}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-500">{timeAgo(n.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
