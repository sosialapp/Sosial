import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** POST-only sign-out so it can be a plain form button. Clears the session
 *  cookie server-side (client-side signOut alone can leave the SSR cookie). */
export async function POST(request: Request) {
  const sb = await createClient();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
