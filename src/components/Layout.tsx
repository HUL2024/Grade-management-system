import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  CalendarCheck, FileText, Trophy, History, ArrowUpCircle, BarChart3,
  CalendarRange, Settings, DatabaseBackup, ShieldCheck, ScrollText, Menu, LogOut, WifiOff, Wifi, ListChecks
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/students', label: 'Students', icon: Users, roles: null },
  { to: '/teachers', label: 'Teachers', icon: GraduationCap, roles: ['administrator', 'principal'] },
  { to: '/classes', label: 'Classes', icon: BookOpen, roles: ['administrator', 'principal'] },
  { to: '/subjects', label: 'Subjects', icon: ClipboardList, roles: ['administrator', 'principal'] },
  { to: '/assessments', label: 'Assessments', icon: ListChecks, roles: ['administrator', 'principal'] },
  { to: '/gradebook', label: 'Gradebook', icon: FileText, roles: ['administrator', 'principal', 'teacher', 'academic_officer'] },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['administrator', 'principal', 'teacher', 'academic_officer'] },
  { to: '/report-cards', label: 'Report Cards', icon: FileText, roles: null },
  { to: '/rankings', label: 'Rankings', icon: Trophy, roles: null },
  { to: '/academic-history', label: 'Academic History', icon: History, roles: null },
  { to: '/promotion', label: 'Promotion', icon: ArrowUpCircle, roles: ['administrator', 'principal'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: null },
  { to: '/academic-years', label: 'Academic Years', icon: CalendarRange, roles: ['administrator', 'principal'] },
  { to: '/users', label: 'User Management', icon: ShieldCheck, roles: ['administrator'] },
  { to: '/activity-log', label: 'Activity Log', icon: ScrollText, roles: ['administrator', 'principal'] },
  { to: '/backup', label: 'Backup & Restore', icon: DatabaseBackup, roles: ['administrator'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['administrator'] },
];

export default function Layout() {
  const { profile, isOnline, signOut, hasRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const visibleNav = NAV.filter((item) => !item.roles || hasRole(...(item.roles as any)));
  const bottomNav = visibleNav.slice(0, 4);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-full flex-col bg-ink text-neutral-100">
      {/* Top bar */}
      <header className="no-print flex items-center justify-between border-b border-gold/20 bg-ink-soft px-4 py-3">
        <button onClick={() => setMenuOpen(true)} className="p-1 text-gold">
          <Menu size={22} />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-gold">AJB Leaders Academy</div>
          <div className="text-[10px] text-neutral-400">Grade Management System</div>
        </div>
        <div className="flex items-center gap-1 text-xs" title={isOnline ? 'Online' : 'Offline — changes will sync later'}>
          {isOnline ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-red-500" />}
        </div>
      </header>

      {!isOnline && (
        <div className="no-print bg-red-900/40 px-3 py-1 text-center text-xs text-red-200">
          You're offline. Changes will be saved locally and synced when connection returns.
        </div>
      )}

      {/* Slide-out menu */}
      {menuOpen && (
        <div className="no-print fixed inset-0 z-50 flex">
          <div className="w-72 overflow-y-auto bg-ink-soft p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gold">{profile?.full_name}</div>
                <div className="text-xs capitalize text-neutral-400">{profile?.role.replace('_', ' ')}</div>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-neutral-400">✕</button>
            </div>
            <nav className="flex flex-col gap-1">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      isActive ? 'bg-gold text-black font-medium' : 'text-neutral-200 hover:bg-surface'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={handleSignOut}
                className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-surface"
              >
                <LogOut size={18} /> Sign out
              </button>
            </nav>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="no-print fixed bottom-0 left-0 right-0 z-40 flex border-t border-gold/20 bg-ink-soft">
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? 'text-gold' : 'text-neutral-400'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setMenuOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-neutral-400">
          <Menu size={20} />
          More
        </button>
      </nav>
    </div>
  );
}
