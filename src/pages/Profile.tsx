import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui';
import type { Teacher } from '../types';

export default function Profile() {
  const { profile, hasRole } = useAuth();
  const isTeacher = hasRole('teacher');
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    if (isTeacher) {
      supabase.from('teachers').select('*').eq('user_id', profile.id).maybeSingle().then(({ data }) => {
        setTeacher(data as Teacher | null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [profile, isTeacher]);

  if (loading) return <p className="p-6 text-center text-neutral-500">Loading…</p>;

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold text-gold">My Profile</h1>
      <p className="mb-3 text-[11px] text-neutral-500">
        This is read-only. If anything here needs to change, ask an administrator.
      </p>

      <Card className="mb-3 flex items-center gap-3">
        {teacher?.photo_url ? (
          <img src={teacher.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-surface" />
        )}
        <div>
          <div className="text-base font-semibold">{profile?.full_name}</div>
          <div className="text-xs capitalize text-neutral-400">{profile?.role.replace('_', ' ')}</div>
        </div>
      </Card>

      {isTeacher && teacher ? (
        <Card className="space-y-2 text-sm">
          <Field label="Teacher ID" value={teacher.teacher_code} />
          <Field label="Phone (login)" value={teacher.phone} />
          <Field label="Email" value={teacher.email} />
          <Field label="Gender" value={teacher.gender} />
          <Field label="Qualification" value={teacher.qualification} />
          <Field label="Specialization" value={teacher.specialization} />
          <Field label="Employment Date" value={teacher.employment_date} />
          <Field label="Address" value={teacher.address} />
          <Field label="Status" value={teacher.status} />
        </Card>
      ) : (
        <Card className="space-y-2 text-sm">
          <Field label="Phone" value={profile?.phone ?? null} />
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-neutral-800 pb-1 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span>{value || '—'}</span>
    </div>
  );
}
