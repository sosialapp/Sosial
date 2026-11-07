import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isGated, needsSession } from '@/lib/authRoutes';
import { DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/i18n/locales';
import { LOCALE_HEADER, isLocalizedPath, splitLocalePath } from '@/lib/i18n/routing';
import { publicOrigin } from '@/lib/site';

/** A redirect target on the address people actually use. Self-hosted, nextUrl
 *  can carry the server's own bind address (https://0.0.0.0:3000), so a
 *  cloned nextUrl sent browsers there. Keeps the query string. */
function publicUrl(request: NextRequest, pathname: string): URL {
  return new URL(`${pathname}${request.nextUrl.search}`, publicOrigin(request));
}

/** Paths the docs host serves as-is instead of mapping into /docs: framework
 *  assets, API routes and the root metadata images. Only `/api/…`, so a docs
 *  page can still be called `api` (docs.sosial.app/api). */
const DOCS_PASSTHROUGH = /^\/(?:_next\/|api\/|og$|(?:opengraph-image|twitter-image|icon|apple-icon)(?:\/|$|-))/;

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

/** Locale-prefixed public URLs (lib/i18n/routing): /es/pricing renders
 *  /pricing in Spanish via a request header, and remembers the choice in the
 *  locale cookie so the next unprefixed page follows it. /en/… and prefixes
 *  on untranslated pages redirect to the one unprefixed URL. */
function routeLocale(request: NextRequest): NextResponse | null {
  const { locale, path } = splitLocalePath(request.nextUrl.pathname);
  if (!locale) return null;
  const url = request.nextUrl.clone();
  url.pathname = path;
  if (locale === DEFAULT_LOCALE || !isLocalizedPath(path)) {
    return NextResponse.redirect(publicUrl(request, path), 308);
  }
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  const response = NextResponse.rewrite(url, { request: { headers } });
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }
  return response;
}

/** Refreshes the Supabase session cookie for gated app routes and gates them
 *  behind sign-in. No-ops (rather than crashing) when env is missing so the
 *  login page can explain the setup state. */
export async function middleware(request: NextRequest) {
  // One host per site: www.sosial.app (and www.docs…) duplicate the apex, so
  // they redirect permanently instead of serving a second copy to crawlers.
  const host = request.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    return NextResponse.redirect(`https://${host.slice(4)}${request.nextUrl.pathname}${request.nextUrl.search}`, 308);
  }

  const docs = routeDocs(request);
  if (docs) return docs;

  const localized = routeLocale(request);
  if (localized) return localized;

  const path = request.nextUrl.pathname;

  // Marketing + public pages need nothing from Supabase here, skip the
  // client and the getSession round-trip entirely (this runs on EVERY
  // navigation). Everything else is public too: API routes authenticate
  // themselves (401 or Stripe signature), and this gate is a UX layer only.
  if (!needsSession(path)) {
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

  if (!user && isGated(path)) {
    return NextResponse.redirect(publicUrl(request, '/login'));
  }
  if (user && path === '/login') {
    return NextResponse.redirect(publicUrl(request, '/dashboard'));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
