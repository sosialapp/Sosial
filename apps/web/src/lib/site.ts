/**
 * Where "Go to Sosial" points.
 *
 * Today this is the in-app calendar — the middleware routes signed-out
 * visitors to /login and members straight to /calendar, so one link is
 * correct for both states. Once dashboard.sosial.app is live, set
 * NEXT_PUBLIC_DASHBOARD_URL to it (e.g. https://dashboard.sosial.app) and
 * every entry button follows with no code change.
 */
export function dashboardUrl(): string {
  const env = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  return '/calendar';
}
