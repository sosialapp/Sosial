/**
 * Where "Go to Sosial" points.
 *
 * Today this is the in-app dashboard, the middleware routes signed-out
 * visitors to /login and members straight to /dashboard, so one link is
 * correct for both states. Once dashboard.sosial.app is live, set
 * NEXT_PUBLIC_DASHBOARD_URL to it (e.g. https://dashboard.sosial.app) and
 * every entry button follows with no code change.
 */
export function dashboardUrl(): string {
  const env = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  return '/dashboard';
}

/**
 * Canonical origin of the docs site, no trailing slash. Production needs no
 * env; set NEXT_PUBLIC_DOCS_URL=http://docs.localhost:3000 locally to keep
 * nav and footer links on your machine.
 */
export function docsUrl(): string {
  return (process.env.NEXT_PUBLIC_DOCS_URL?.trim() || 'https://docs.sosial.app').replace(/\/+$/, '');
}

/**
 * The address people reach the app on, for redirects and OAuth callbacks.
 * Self-hosted behind a proxy (output: 'standalone'), req.url carries the
 * container's bind address (https://0.0.0.0:3000), which no provider has
 * registered, so Pinterest and the rest reject the redirect. The proxy's
 * forwarded host, or the browser's Host, is the real one; NEXT_PUBLIC_SITE_URL
 * covers a proxy that sends neither.
 */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const first = (v: string | null) => (v ?? '').split(',')[0].trim();
  const host = first(req.headers.get('x-forwarded-host')) || first(req.headers.get('host'));
  const proto = first(req.headers.get('x-forwarded-proto')) || url.protocol.replace(/:$/, '');
  const bindAddress = /^(0\.0\.0\.0|\[::\])(:\d+)?$/;
  if (host && !bindAddress.test(host)) return `${proto}://${host}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/+$/, '');
  return url.origin;
}
