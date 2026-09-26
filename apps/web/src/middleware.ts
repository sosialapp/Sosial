import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** App UI that requires a session. Everything else is public: marketing pages
 *  (including the custom CMS pages at the root), auth flows and API routes.
 *  API routes authenticate themselves (401 or Stripe signature), so this gate
 *  is a UX layer only — every page and RLS policy still re-verifies with
 *  getUser() server-side. */
const GATED_PREFIXES = [
  '/admin',
  '/analytics',
  '/billing',
  '/calendar',
  '/channels',
  '/composer',
  '/dashboard',
  '/new',
  '/profile',
  '/queue',
  '/reports',
  '/team',
];

function isGated(path: string): boolean {
  return GATED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Refreshes the Supabase session cookie for gated app routes and gates them
 *  behind sign-in. No-ops (rather than crashing) when env is missing so the
 *  login page can explain the setup state. */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Marketing + public pages need nothing from Supabase here — skip the
  // client and the getSession round-trip entirely (this runs on EVERY
  // navigation). /login stays on the slow path (signed-in redirect).
  if (path !== '/login' && !isGated(path)) {
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

  if (!user && path !== '/login') {
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
