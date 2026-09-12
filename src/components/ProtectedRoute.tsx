import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../types';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Profile['role'][];
}) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gold">
        Loading…
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(profile.role)) {
    return (
      <div className="p-6 text-center text-neutral-400">
        You don't have permission to access this section.
      </div>
    );
  }

  return <>{children}</>;
}
