/**
 * Web OAuth registry — mirrors the mobile connect flow (src/utils/*Config.ts
 * + *Auth.ts) for the browser. Authorize URLs are built here (public client
 * IDs only); the code↔token exchange plus profile fetch live in the
 * `oauth-exchange` edge function where the secrets stay server-side.
 *
 * Public client ids come from the `oauth-config` edge function (Supabase
 * secrets, mirrored from the mobile app) — the start route fetches them with
 * the user's session, so no Vercel env is needed. The matching private
 * secrets live as Supabase secrets for oauth-exchange.
 * Every provider already allow-lists the bridge redirect below.
 */

export type OAuthProvider =
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'x'
  | 'youtube'
  | 'linkedin'
  | 'pinterest'
  | 'mastodon';

export const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'threads', label: 'Threads' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'mastodon', label: 'Mastodon' },
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
const THREADS_SCOPES = ['threads_basic', 'threads_content_publish', 'threads_read_replies', 'threads_manage_insights'];
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
const PIN_SCOPES = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];

const q = (p: Record<string, string>): string =>
  Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/** Public ids as returned by oauth-config (unconfigured providers omitted). */
export interface OAuthConfig {
  tiktok?: { client_key?: string };
  instagram?: { app_id?: string };
  facebook?: { app_id?: string };
  threads?: { app_id?: string };
  x?: { client_id?: string };
  youtube?: { client_id?: string };
  linkedin?: { client_id?: string };
  pinterest?: { client_id?: string };
}

/** Public client id for a provider. Empty = not configured. */
export function clientIdFor(provider: OAuthProvider, config: OAuthConfig): string {
  switch (provider) {
    case 'tiktok':
      return config.tiktok?.client_key ?? '';
    case 'instagram':
      return config.instagram?.app_id ?? '';
    case 'facebook':
      return config.facebook?.app_id ?? '';
    case 'threads':
      return config.threads?.app_id ?? '';
    case 'x':
      return config.x?.client_id ?? '';
    case 'youtube':
      return config.youtube?.client_id ?? '';
    case 'linkedin':
      return config.linkedin?.client_id ?? '';
    case 'pinterest':
      return config.pinterest?.client_id ?? '';
    case 'mastodon':
      return '';
  }
}

export interface AuthorizeArgs {
  provider: OAuthProvider;
  /** Public ids from oauth-config. */
  config: OAuthConfig;
  redirectUri: string;
  /** Opaque CSRF nonce — echoed back as `state`. */
  state: string;
  /** PKCE challenge (X only). */
  challenge?: string;
}

/** Provider consent URL. Throws when the provider isn't configured. */
export function authorizeUrl({ provider, config, redirectUri: redir, state, challenge }: AuthorizeArgs): string {
  if (provider === 'mastodon') {
    throw new Error('Enter your instance first — Mastodon registers per server.');
  }
  const id = clientIdFor(provider, config);
  if (!id) throw new Error(`${oauthLabel(provider)} is not configured yet.`);
  switch (provider) {
    case 'tiktok':
      // TikTok takes client_key, NOT client_id. disable_auto_auth=1 always
      // shows the consent page instead of silently auto-approving whoever is
      // logged in — the user sees which account they are authorizing.
      return (
        'https://www.tiktok.com/v2/auth/authorize/' +
        `?${q({ client_key: id, scope: TT_SCOPES.join(','), response_type: 'code', redirect_uri: redir, state, disable_auto_auth: '1' })}`
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
    case 'threads':
      return (
        'https://www.threads.com/oauth/authorize' +
        `?${q({ client_id: id, redirect_uri: redir, response_type: 'code', scope: THREADS_SCOPES.join(','), state })}`
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
    case 'pinterest':
      return (
        'https://www.pinterest.com/oauth/' +
        `?${q({ response_type: 'code', client_id: id, redirect_uri: redir, scope: PIN_SCOPES.join(','), state })}`
      );
  }
}
