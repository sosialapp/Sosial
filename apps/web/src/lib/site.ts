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
