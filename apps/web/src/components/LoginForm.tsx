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
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
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
    }
  }

  async function google() {
    setBusy(true);
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
    }
  }

  return (
    <div className="w-full max-w-sm">
      {!compact && (
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-bone ring-1 ring-line">
            <Image src="/bolt.png" alt="Sosial" width={36} height={36} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Sosial</h1>
          <p className="mt-1 text-sm text-muted">Compose, schedule and publish across every channel.</p>
        </div>
      )}

      <div className={compact ? '' : 'card p-6'}>
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
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <button className="btn btn-ghost w-full" onClick={google} disabled={busy} type="button">
          <BrandIcon provider="google" className="h-4 w-4" />
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
