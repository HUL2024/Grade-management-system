import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui';
import { Users, GraduationCap, BookOpen, ClipboardList, CalendarCheck } from 'lucide-react';

interface Stats {
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  currentYear: string;
  attendanceRate: number | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    const [studentsRes, teachersRes, classesRes, subjectsRes, yearRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('gender', { count: 'exact' }).eq('status', 'Active'),
      supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('academic_years').select('name').eq('status', 'active').maybeSingle(),
      supabase.from('attendance').select('status').gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    ]);

    const genderRows = studentsRes.data ?? [];
    const male = genderRows.filter((r: any) => r.gender === 'Male').length;
    const female = genderRows.filter((r: any) => r.gender === 'Female').length;

    const attRows = attendanceRes.data ?? [];
    const present = attRows.filter((r: any) => r.status === 'Present').length;
    const attendanceRate = attRows.length ? Math.round((present / attRows.length) * 100) : null;

    setStats({
      totalStudents: studentsRes.count ?? genderRows.length,
      maleStudents: male,
      femaleStudents: female,
      totalTeachers: teachersRes.count ?? 0,
      totalClasses: classesRes.count ?? 0,
      totalSubjects: subjectsRes.count ?? 0,
      currentYear: yearRes.data?.name ?? 'Not set',
      attendanceRate,
    });
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6 text-center text-neutral-500">Loading dashboard…</div>;
  }

  const cards = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0, icon: Users },
    { label: 'Male / Female', value: `${stats?.maleStudents ?? 0} / ${stats?.femaleStudents ?? 0}`, icon: Users },
    { label: 'Teachers', value: stats?.totalTeachers ?? 0, icon: GraduationCap },
    { label: 'Classes', value: stats?.totalClasses ?? 0, icon: BookOpen },
    { label: 'Subjects', value: stats?.totalSubjects ?? 0, icon: ClipboardList },
    { label: 'Attendance (30d)', value: stats?.attendanceRate !== null ? `${stats?.attendanceRate}%` : 'No data', icon: CalendarCheck },
  ];

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gold">Dashboard</h1>
        <p className="text-xs text-neutral-400">Academic Year: {stats?.currentYear}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="flex flex-col gap-2">
            <c.icon size={18} className="text-gold" />
            <div className="text-xl font-semibold">{c.value}</div>
            <div className="text-[11px] text-neutral-400">{c.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
