import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth';

/** OAuth/PKCE + email-confirm landing — exchanges the ?code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  // mode=confirm marks inbox "Confirm email address" links so a stale link
  // gets an email-specific message on /login instead of the Google one.
  const errCode = searchParams.get('mode') === 'confirm' ? 'confirm' : 'oauth';
  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${errCode}`);
}
