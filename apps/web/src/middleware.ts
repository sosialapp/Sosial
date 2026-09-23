import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Refreshes the Supabase session cookie and gates the app behind sign-in.
 *  No-ops (rather than crashing) when env is missing so the login page can
 *  explain the setup state. */
const PUBLIC_PREFIXES = [
  '/',
  '/blog',
  '/resources',
  '/integrations',
  '/publish',
  '/post',
  '/create',
  '/ai-assistant',
  '/audiences',
  '/terms',
  '/privacy',
  '/sitemap',
  '/robots',
  '/invite',
  '/auth',
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Marketing + auth-callback pages need nothing from Supabase here — skip
  // the client and the getUser round-trip entirely (this runs on EVERY
  // navigation). /login stays on the slow path (signed-in redirect).
  if (path !== '/login' && PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Cookie-only read: no network round-trip (getUser() phones home on every
  // tap). A forged cookie only gets past this UX gate — every page and RLS
  // policy re-verifies with getUser() server-side, which bounces to /login.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const isPublic =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/invite') ||
    path.startsWith('/blog') ||
    path.startsWith('/resources') ||
    path.startsWith('/integrations') ||
    path.startsWith('/publish') ||
    path.startsWith('/post') ||
    path.startsWith('/create') ||
    path.startsWith('/ai-assistant') ||
    path.startsWith('/audiences') ||
    path.startsWith('/terms') ||
    path.startsWith('/privacy') ||
    path.startsWith('/sitemap') ||
    path.startsWith('/robots');

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    return NextResponse.redirect(redirect);
  }
  if (user && path === '/login') {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/dashboard';
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
