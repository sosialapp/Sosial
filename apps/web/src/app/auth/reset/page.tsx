'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { authMessages } from '@/lib/i18n/auth';

/**
 * Password-reset landing: the inbox link routes through /auth/callback,
 * which exchanges the recovery code for a session and redirects here with
 * that session, so updateUser can set the new password directly.
 */
export default function ResetPasswordPage() {
  const t = useT(authMessages);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb.auth
      .getSession()
      .then(({ data }) => setHasSession(Boolean(data.session)))
      .catch(() => setHasSession(false))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw1.length < 6) return;
    if (pw1 !== pw2) {
      setErr(t('errMismatch'));
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setDone(true);
      // The recovery session is consumed server-side by the password change.
      await sb.auth.signOut().catch(() => undefined);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Image src="/bolt.png" alt="Sosial" width={44} height={44} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Sosial</h1>
        </div>

        <div className="card p-6">
          {checking ? (
            <div className="py-6 text-center">
              <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-faint" aria-hidden="true" />
            </div>
          ) : !hasSession ? (
            <div className="text-center">
              <p className="text-sm leading-relaxed text-muted">{t('resetNoSession')}</p>
              <Link href="/login" className="btn btn-primary mt-4 w-full">
                {t('backToSignIn')}
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <p className="eyebrow mb-3">{t('resetEyebrow')}</p>
              <p className="text-sm leading-relaxed text-muted">{t('resetNote')}</p>
              <Link href="/login" className="btn btn-primary mt-4 w-full">
                {t('backToSignIn')}
              </Link>
            </div>
          ) : (
            <>
              <p className="eyebrow mb-4">{t('resetEyebrow')}</p>
              <form onSubmit={submit} className="space-y-3">
                <input
                  className="field"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={t('resetPwPh')}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                />
                <input
                  className="field"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={t('pwConfirmPh')}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
                <button className="btn btn-primary w-full" disabled={busy} type="submit" aria-busy={busy}>
                  {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {t('resetSubmit')}
                </button>
              </form>
            </>
          )}
          {err && <p className="mt-4 text-sm text-[#9F2F2D]">{err}</p>}
        </div>
      </div>
    </div>
  );
}
