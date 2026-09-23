/**
 * Web OAuth registry — mirrors the mobile connect flow (src/utils/*Config.ts
 * + *Auth.ts) for the browser. Authorize URLs are built here (public client
 * IDs only); the code↔token exchange plus profile fetch live in the
 * `oauth-exchange` edge function where the secrets stay server-side.
 *
 * Server env (Vercel, never NEXT_PUBLIC_ — the start route reads these):
 *   TT_CLIENT_KEY, META_APP_ID, IG_APP_ID, X_CLIENT_ID, YT_CLIENT_ID, LI_CLIENT_ID
 * The matching secrets live as Supabase secrets for oauth-exchange.
 *
 * The redirect URI is the same static bridge the mobile app uses
 * ({origin}/auth.html) — already registered in every provider dashboard, so
 * no dashboard changes are needed. The bridge forwards to
 * /api/oauth/callback on the same origin when `state` is a web nonce
 * (mobile puts a return URL in `state`, which still goes to the app).
 */

export type OAuthProvider =
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'youtube'
  | 'linkedin';

export const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
];

export const isOAuthProvider = (v: unknown): v is OAuthProvider =>
  OAUTH_PROVIDERS.some((p) => p.id === v);

export const oauthLabel = (p: string): string =>
  OAUTH_PROVIDERS.find((x) => x.id === p)?.label ?? p;

/** The redirect URI — the shared mobile/web bridge, already allow-listed
 *  everywhere. Origin-aware so local dev serves its own copy. */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/auth.html`;
}

const TT_SCOPES = ['user.info.basic', 'user.info.stats', 'video.upload', 'video.publish', 'video.list'];
const IG_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];
const FB_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_posts'];
const X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];
const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];
const LI_SCOPES = [
  'openid', 'profile',
  'w_member_social', 'r_member_social',
  'w_organization_social', 'r_organization_social',
];

const q = (p: Record<string, string>): string =>
  Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/** Public client id for a provider (server env). Empty = not configured. */
export function clientIdFor(provider: OAuthProvider): string {
  switch (provider) {
    case 'tiktok':
      return process.env.TT_CLIENT_KEY ?? '';
    case 'instagram':
      return process.env.IG_APP_ID ?? '';
    case 'facebook':
      return process.env.META_APP_ID ?? '';
    case 'x':
      return process.env.X_CLIENT_ID ?? '';
    case 'youtube':
      return process.env.YT_CLIENT_ID ?? '';
    case 'linkedin':
      return process.env.LI_CLIENT_ID ?? '';
  }
}

export interface AuthorizeArgs {
  provider: OAuthProvider;
  redirectUri: string;
  /** Opaque CSRF nonce — echoed back as `state`. */
  state: string;
  /** PKCE challenge (X only). */
  challenge?: string;
}

/** Provider consent URL. Throws when the provider isn't configured. */
export function authorizeUrl({ provider, redirectUri: redir, state, challenge }: AuthorizeArgs): string {
  const id = clientIdFor(provider);
  if (!id) throw new Error(`${oauthLabel(provider)} is not configured yet.`);
  switch (provider) {
    case 'tiktok':
      // TikTok takes client_key, NOT client_id.
      return (
        'https://www.tiktok.com/v2/auth/authorize/' +
        `?${q({ client_key: id, scope: TT_SCOPES.join(','), response_type: 'code', redirect_uri: redir, state })}`
      );
    case 'instagram':
      // enable_fb_login=false keeps the flow on instagram.com when a
      // Facebook session is lingering around.
      return (
        'https://www.instagram.com/oauth/authorize' +
        `?${q({ client_id: id, redirect_uri: redir, response_type: 'code', scope: IG_SCOPES.join(','), enable_fb_login: 'false', state })}`
      );
    case 'facebook':
      return (
        'https://www.facebook.com/v21.0/dialog/oauth' +
        `?${q({ client_id: id, redirect_uri: redir, response_type: 'code', scope: FB_SCOPES.join(','), auth_type: 'rerequest', state })}`
      );
    case 'x':
      if (!challenge) throw new Error('X needs a PKCE challenge.');
      return (
        'https://x.com/i/oauth2/authorize' +
        `?${q({ response_type: 'code', client_id: id, redirect_uri: redir, scope: X_SCOPES.join(' '), state, code_challenge: challenge, code_challenge_method: 'S256' })}`
      );
    case 'youtube':
      // access_type=offline + prompt=consent so Google always returns a
      // refresh_token (without it you only get one, once, ever).
      return (
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?${q({ response_type: 'code', client_id: id, redirect_uri: redir, scope: YT_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state })}`
      );
    case 'linkedin':
      return (
        'https://www.linkedin.com/oauth/v2/authorization' +
        `?${q({ response_type: 'code', client_id: id, redirect_uri: redir, scope: LI_SCOPES.join(' '), state })}`
      );
  }
}
