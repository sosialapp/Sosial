'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';
import { createClient } from '@/lib/supabase/client';
import { callbackUrl, safeNextPath } from '@/lib/auth';

/** How long a spinner may keep spinning if navigation never lands. */
const BUSY_WATCHDOG_MS = 20000;

function friendly(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e ?? '');
  if (/invalid login|invalid_credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already exists|duplicate/i.test(m)) return 'That email already has an account. Sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first, then check your inbox.';
  if (/fetch|network|failed/i.test(m)) return 'Could not reach the cloud backend. Check your connection.';
  return m || 'Something went wrong.';
}

/** Inline spinner used inside the submit buttons while the request is in flight. */
function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <LoaderCircle className={`${className} animate-spin`} aria-hidden="true" />;
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
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function switchMode(next: 'in' | 'up') {
    setMode(next);
    setConfirm('');
    setPassword('');
    setErr(null);
    setNote(null);
  }

  function stopBusy() {
    setBusy(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setNote(null);

    if (mode === 'up' && password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const sb = createClient();
      if (mode === 'up') {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is on — there is no dashboard to travel to yet.
          setNote('Check your inbox to confirm your email, then sign in.');
          stopBusy();
          return;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      // Deliberately keep `busy` set: the button keeps buffering until the
      // dashboard actually renders, not just until the request resolves.
      router.replace(target);
      router.refresh();
      window.setTimeout(stopBusy, BUSY_WATCHDOG_MS);
    } catch (e) {
      setErr(friendly(e));
      stopBusy();
    }
  }

  async function google() {
    setErr(null);
    setBusy(true);
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
      window.setTimeout(stopBusy, BUSY_WATCHDOG_MS);
    } catch (e) {
      setErr(friendly(e));
      stopBusy();
    }
  }

  const signingUp = mode === 'up';

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
        <p className="eyebrow mb-1">{signingUp ? 'Create account' : 'Sign in'}</p>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          {signingUp
            ? 'Set up a workspace in a few seconds. Free forever, no card.'
            : 'Welcome back. Pick up your calendar where you left it.'}
        </p>

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
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            placeholder={signingUp ? 'Choose a password (6+ characters)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {signingUp && (
            <input
              className="field"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}

          <button className="btn btn-primary w-full" disabled={busy} type="submit" aria-busy={busy}>
            {busy && <Spinner />}
            {signingUp ? 'Create account' : 'Sign in'}
          </button>

          {signingUp && (
            <p className="text-center text-xs leading-relaxed text-faint">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-muted underline underline-offset-2 hover:text-ink">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-muted underline underline-offset-2 hover:text-ink">
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <button className="btn btn-ghost w-full" onClick={google} disabled={busy} type="button" aria-busy={busy}>
          {busy ? <Spinner /> : <BrandIcon provider="google" badge={false} className="h-[18px] w-[18px]" />}
          Continue with Google
        </button>

        {(err || externalError) && (
          <p className="mt-4 text-sm text-[#9F2F2D]">{err ?? externalError}</p>
        )}
        {note && <p className="mt-4 text-sm text-[#346538]">{note}</p>}

        <p className="mt-4 text-center text-xs text-muted">
          {signingUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            className="font-semibold text-accent underline-offset-2 hover:underline"
            onClick={() => switchMode(signingUp ? 'in' : 'up')}
          >
            {signingUp ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
