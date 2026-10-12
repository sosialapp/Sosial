import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth';

/**
 * Add a consenting user to the Resend marketing audience. Idempotent
 * (contacts upsert by email), so re-confirming a link is harmless.
 * Fire-and-forget: a marketing-sync hiccup must never block a sign-in.
 */
async function syncMarketingOptIn(email: string | undefined): Promise<void> {
  if (!email) return;
  const key = process.env.RESEND_API_KEY;
  const audience = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audience) return;
  try {
    await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
  } catch {
    // Never block authentication on marketing sync.
  }
}

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
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      // Signup consent: both platforms' confirmation links land here, so this
      // single hook covers web and mobile signups (and Google sign-ins —
      // their users simply never set the flag, so nothing fires).
      const optedIn = (data?.user?.user_metadata as Record<string, unknown> | undefined)?.[
        'marketing_opt_in'
      ];
      if (optedIn === true) void syncMarketingOptIn(data?.user?.email);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${errCode}`);
}
