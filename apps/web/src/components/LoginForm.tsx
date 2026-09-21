'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import { createClient } from '@/lib/supabase/client';
import { callbackUrl, safeNextPath } from '@/lib/auth';

function friendly(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e ?? '');
  if (/invalid login|invalid_credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already exists|duplicate/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first — check your inbox.';
  if (/fetch|network|failed/i.test(m)) return 'Could not reach the cloud backend — check your connection.';
  return m || 'Something went wrong.';
}

/** Small inline spinner for buttons while an auth request is in flight. */
function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Buffering animation shown over the form while credentials are verified. */
function AuthBusy({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-card/92 backdrop-blur-[2px]"
    >
      <span className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        <span className="absolute inset-2 rounded-full border-2 border-transparent border-b-accent/40 animate-spin [animation-duration:1.6s] [animation-direction:reverse]" />
        <Image src="/bolt.png" alt="" width={30} height={30} className="animate-float" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold text-soft">{label}</span>
    </div>
  );
}

export default function LoginForm({
  externalError,
  next,
  initialMode,
  compact,
}: {
  externalError?: string | null;
  /** Post-login destination (e.g. an invite link) — same-origin paths only. */
  next?: string | null;
  /** Starting tab when embedded (e.g. in the auth modal). */
  initialMode?: 'in' | 'up';
  /** Hide the brand header — the host (e.g. modal) provides its own. */
  compact?: boolean;
}) {
  const router = useRouter();
  const target = safeNextPath(next);
  const [mode, setMode] = useState<'in' | 'up'>(initialMode ?? 'in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPending(mode === 'in' ? 'Signing you in…' : 'Creating your account…');
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      if (mode === 'up') {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setNote('Check your inbox to confirm your email, then sign in.');
          return;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      router.replace(target);
      router.refresh();
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  async function google() {
    setBusy(true);
    setPending('Connecting to Google…');
    setErr(null);
    try {
      const sb = createClient();
      const redirectTo = callbackUrl(window.location.origin);
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: target === '/calendar' ? redirectTo : `${redirectTo}?next=${encodeURIComponent(target)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setErr(friendly(e));
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {!compact && (
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Image src="/bolt.png" alt="Sosial" width={44} height={44} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Sosial</h1>
          <p className="mt-1 text-sm text-muted">Compose, schedule and publish across every channel.</p>
        </div>
      )}

      <div className={`relative ${compact ? '' : 'card p-6'}`}>
        {busy && <AuthBusy label={pending ?? 'Working…'} />}
        <p className="eyebrow mb-4">{mode === 'in' ? 'Sign in' : 'Create account'}</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="field"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-primary w-full" disabled={busy} type="submit" aria-busy={busy}>
            {busy && <Spinner />}
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <button className="btn btn-ghost w-full" onClick={google} disabled={busy} type="button" aria-busy={busy}>
          {busy && pending?.startsWith('Connecting') ? (
            <Spinner />
          ) : (
            <BrandIcon provider="google" className="h-4 w-4" />
          )}
          Continue with Google
        </button>

        {(err || externalError) && (
          <p className="mt-4 text-sm text-[#9F2F2D]">{err ?? externalError}</p>
        )}
        {note && <p className="mt-4 text-sm text-[#346538]">{note}</p>}

        <p className="mt-4 text-center text-xs text-muted">
          {mode === 'in' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="font-semibold text-accent underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in');
              setErr(null);
              setNote(null);
            }}
          >
            {mode === 'in' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
