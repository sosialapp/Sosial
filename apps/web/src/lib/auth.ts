/**
 * Shared OAuth helpers (pure — safe to unit-test in node).
 *
 * Web Google sign-in lands on /auth/callback, which exchanges ?code for a
 * session cookie. NEXT_PUBLIC_SITE_URL pins the redirect target so preview
 * deploys and production agree; local dev falls back to the current origin.
 */

/** Absolute /auth/callback URL Supabase should return to after OAuth. */
export function callbackUrl(origin: string): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const base = (raw || origin).replace(/\/+$/, '');
  return `${base}/auth/callback`;
}

/** User-facing message for /login?error=<code>. Null means no banner. */
export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === 'oauth') return 'Google sign-in was interrupted before it finished. Please try again.';
  return 'Something went wrong signing you in. Please try again.';
}

/** Only allow same-origin relative paths — blocks open-redirect via ?next=. */
export function safeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/calendar';
}
