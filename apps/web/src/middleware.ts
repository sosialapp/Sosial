import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** App UI that requires a session. Everything else is public: marketing pages
 *  (including the custom CMS pages at the root), auth flows and API routes.
 *  API routes authenticate themselves (401 or Stripe signature), so this gate
 *  is a UX layer only, every page and RLS policy still re-verifies with
 *  getUser() server-side. */
const GATED_PREFIXES = [
  '/admin',
  '/analytics',
  '/billing',
  '/calendar',
  '/calendar-line',
  '/calendar-month',
  '/channels',
  '/composer',
  '/dashboard',
  '/new',
  '/post',
  '/post-ideas',
  '/post-publish',
  '/post-templates',
  '/profile',
  '/queue',
  '/reports',
  '/team',
];

function isGated(path: string): boolean {
  return GATED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Paths the docs host serves as-is instead of mapping into /docs: framework
 *  assets, API routes and the root metadata images. Only `/api/…`, so a docs
 *  page can still be called `api` (docs.sosial.app/api). */
const DOCS_PASSTHROUGH = /^\/(?:_next\/|api\/|(?:opengraph-image|twitter-image|icon|apple-icon)(?:\/|$|-))/;

function isDocsHost(request: NextRequest): boolean {
  const host = (request.headers.get('host') ?? '').toLowerCase();
  return host.startsWith('docs.');
}

/** Where sosial.app/docs/* sends visitors: NEXT_PUBLIC_DOCS_URL, else the
 *  docs.localhost twin of a local dev host, else production. */
function docsOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DOCS_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  const { hostname, port, protocol } = request.nextUrl;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//docs.localhost${port ? `:${port}` : ''}`;
  }
  return 'https://docs.sosial.app';
}

/** docs.sosial.app is the same deployment: every path maps onto the /docs
 *  route tree (docs.sosial.app/x renders /docs/x). The main host redirects
 *  /docs/* there so each page has one public URL. */
function routeDocs(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (isDocsHost(request)) {
    if (DOCS_PASSTHROUGH.test(path)) return null;
    if (path === '/docs' || path.startsWith('/docs/')) {
      // From the Host header: nextUrl can carry the server's own hostname.
      const host = request.headers.get('host');
      const rest = (path.slice('/docs'.length) || '/') + request.nextUrl.search;
      return NextResponse.redirect(`${request.nextUrl.protocol}//${host}${rest}`, 308);
    }
    const url = request.nextUrl.clone();
    url.pathname = path === '/' ? '/docs' : `/docs${path}`;
    return NextResponse.rewrite(url);
  }
  // The developer guide lives in the docs now.
  if (path === '/developers') {
    return NextResponse.redirect(`${docsOrigin(request)}/api`, 308);
  }
  if (path === '/docs' || path.startsWith('/docs/')) {
    const rest = path.slice('/docs'.length) || '/';
    return NextResponse.redirect(`${docsOrigin(request)}${rest}${request.nextUrl.search}`, 308);
  }
  return null;
}

/** Refreshes the Supabase session cookie for gated app routes and gates them
 *  behind sign-in. No-ops (rather than crashing) when env is missing so the
 *  login page can explain the setup state. */
export async function middleware(request: NextRequest) {
  const docs = routeDocs(request);
  if (docs) return docs;

  const path = request.nextUrl.pathname;

  // Marketing + public pages need nothing from Supabase here, skip the
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
  // tap). A forged cookie only gets past this UX gate, every page and RLS
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
