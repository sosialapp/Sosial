/** Which paths the middleware handles the Supabase session for (pure, safe to
 *  unit-test in node).
 *
 *  Every page that reads the session on the server must be covered. A Server
 *  Component cannot set cookies, so when it finds an expired access token it
 *  spends the refresh token and then loses the replacement. The browser keeps
 *  the spent token, and using it after the reuse window makes the auth server
 *  revoke the whole session, which signs the user out. The middleware can
 *  write cookies, so it has to do the refresh before the page renders. */

/** App UI that requires a session. authRoutes.test.ts fails when a directory
 *  under app/(app) or app/(admin) is missing from this list. */
export const GATED_PREFIXES = [
  '/admin',
  '/analytics',
  '/billing',
  '/calendar',
  '/calendar-day',
  '/calendar-line',
  '/calendar-list',
  '/calendar-month',
  '/calendar-year',
  '/channels',
  '/community',
  '/composer',
  '/create',
  '/dashboard',
  '/import',
  '/new',
  '/post',
  '/post-ideas',
  '/post-import',
  '/post-publish',
  '/post-templates',
  '/profile',
  '/queue',
  '/reports',
  '/team',
];

/** Open to signed-out visitors, but the page reads the session on the server
 *  when there is one, so it still needs the refresh. */
const REFRESH_ONLY_PREFIXES = ['/invite'];

function matches(prefixes: string[], path: string): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isGated(path: string): boolean {
  return matches(GATED_PREFIXES, path);
}

/** True when the middleware must load (and so refresh) the session. /login is
 *  here for its signed-in redirect. */
export function needsSession(path: string): boolean {
  return path === '/login' || isGated(path) || matches(REFRESH_ONLY_PREFIXES, path);
}
