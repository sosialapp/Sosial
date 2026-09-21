import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** POST-only sign-out so it can be a plain form button. Clears the session
 *  cookie server-side (client-side signOut alone can leave the SSR cookie).
 *  Lands the user back on the marketing site, not the login screen. */
export async function POST(request: Request) {
  const sb = await createClient();
  await sb.auth.signOut();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const home = base ? new URL('/', base) : new URL('/', request.url);
  return NextResponse.redirect(home, { status: 303 });
}
