import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicOrigin } from '@/lib/site';

/** POST-only sign-out so it can be a plain form button. Clears the session
 *  cookie server-side (client-side signOut alone can leave the SSR cookie).
 *  Lands the user back on the marketing site, not the login screen. */
export async function POST(request: Request) {
  const sb = await createClient();
  await sb.auth.signOut();
  const home = new URL('/', publicOrigin(request));
  return NextResponse.redirect(home, { status: 303 });
}
