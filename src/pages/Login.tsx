import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';
import { logActivity } from '../lib/activityLog';
import { isEmailLike, phoneToInternalEmail } from '../lib/staffAuth';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Administrators/Principals sign in with a real email.
      // Teachers sign in with their phone number, which we convert to a
      // hidden internal email behind the scenes (same one used when their
      // account was created).
      const email = isEmailLike(identifier) ? identifier : phoneToInternalEmail(identifier);

      const err = await signIn(email, password);
      if (err) {
        setError('Incorrect email/phone number or password. Please check them and try again.');
        setSubmitting(false);
        return;
      }
      await logActivity('login');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in — please check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-ink px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold text-2xl font-bold text-gold">
          AJB
        </div>
        <h1 className="text-lg font-semibold text-gold">AJB Leaders Academy</h1>
        <p className="text-xs text-neutral-400">Grade Management System</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <Input
          type="text"
          placeholder="Email (staff) or phone number (teachers)"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && (
          <div className="rounded-lg border border-red-500 bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-8 text-center text-[11px] text-neutral-600">
        Diamond Creek, Soul Clinic Community, Paynesville City, Liberia
      </p>
    </div>
  );
}
