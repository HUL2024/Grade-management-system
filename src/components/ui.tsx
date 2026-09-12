import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, HTMLAttributes } from 'react';

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50';
  const styles = {
    primary: 'bg-gold text-black hover:bg-gold-light',
    ghost: 'bg-surface text-neutral-100 hover:bg-neutral-700',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-neutral-700 bg-surface px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-gold focus:outline-none ${props.className ?? ''}`}
    />
  );
}

export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border border-neutral-800 bg-ink-soft p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-neutral-500">
      <p className="text-sm">{message}</p>
      {action}
    </div>
  );
}

export function StatusPill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const tones = {
    neutral: 'bg-neutral-700 text-neutral-200',
    good: 'bg-green-900 text-green-300',
    warn: 'bg-yellow-900 text-yellow-300',
    bad: 'bg-red-900 text-red-300',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${tones[tone]}`}>{text}</span>;
}

export function SavingIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null;
  const map = {
    saving: { text: 'Saving…', tone: 'warn' as const },
    saved: { text: 'Saved', tone: 'good' as const },
    error: { text: 'Save failed', tone: 'bad' as const },
  };
  const cfg = map[state];
  return <StatusPill text={cfg.text} tone={cfg.tone} />;
}
