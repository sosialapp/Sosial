/**
 * Reddit OAuth config (confidential client, same app web/mobile authorize).
 *
 * HOW THIS DIFFERS FROM META (read before touching):
 * 1. Tokens exchange with HTTP Basic (client_id:secret) — never body creds.
 * 2. duration=permanent mints a refresh token that never expires; the access
 *    token dies hourly and is refreshed silently from it.
 * 3. Reddit REQUIRES a descriptive User-Agent on every API call — generic
 *    ones get throttled regardless of limits.
 * 4. Each subreddit is its own channel (u/{user}/r/{sr}); Reddit's karma
 *    minimums and mod queues still gate posts — surfaced in errors.
 */
export const RD_CLIENT_ID = process.env.EXPO_PUBLIC_RD_CLIENT_ID ?? '';
export const RD_CLIENT_SECRET = process.env.EXPO_PUBLIC_RD_CLIENT_SECRET ?? '';

export const RD_AUTH_ENDPOINT = 'https://www.reddit.com/api/v1/authorize';
export const RD_TOKEN_ENDPOINT = 'https://www.reddit.com/api/v1/access_token';
export const RD_API = 'https://oauth.reddit.com';

export const RD_SCOPES = ['identity', 'mysubreddits', 'submit', 'read'];

export const RD_UA = 'mobile:Sosial:v1.0 (by /u/sosialapp)';

export const rdConfigured = (): boolean => RD_CLIENT_ID.length > 0 && RD_CLIENT_SECRET.length > 0;
