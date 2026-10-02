import { readSecret, updateSecret } from './db';
import { info } from './logger';
import { env } from './env';

/**
 * Reddit publisher (OAuth, per-subreddit rows, self posts).
 *
 * Auth is a permanent refresh token (duration=permanent at connect); the
 * access token dies hourly, so every publish refreshes first when stale.
 * Reddit REQUIRES a descriptive User-Agent — requests without one are
 * throttled/rejected regardless of limits.
 * - Validation: GET /api/v1/me (proves the token, names the account)
 * - Subreddits: GET /subreddits/mine/subscriber (connect-time picker)
 * - Publish: POST /api/submit {api_type:json, kind:self, sr, title, text}
 *
 * v1 is text (self) posts only: title is required (300 chars), body caps at
 * 40000. Image/video posts need Reddit's hosted-upload dance, link posts
 * need composer URL fields, flair needs per-subreddit templates — all v1
 * omissions, declared in compat (no fake capabilities).
 *
 * Practical Reddit truth surfaced in errors, not hidden: subreddit karma
 * minimums, mod queues and rate limits can still eat a post — submit errors
 * (RATELIMIT, ALREADY_SUB, SUBREDDIT_NOTALLOWED, …) are translated, never
 * swallowed.
 */

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API = 'https://oauth.reddit.com';
const UA = 'web:Sosial:v1.0 (by /u/sosialapp)';

/** Reddit client pair — same app the web/mobile flows authorize against. */
function clientCreds(): { id: string; secret: string } {
  const id = env('REDDIT_CLIENT_ID') || '';
  const secret = env('REDDIT_CLIENT_SECRET') || '';
  if (!id || !secret) {
    throw new Error('Reddit is not configured on the worker (REDDIT_CLIENT_ID/SECRET) — set them in Railway.');
  }
  return { id, secret };
}

function basic(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

function submitErr(errors: [string, string, string?][] | undefined, fallback: string): string {
  const [code = '', msg = ''] = errors?.[0] ?? [];
  const detail = msg || code || fallback;
  if (/RATELIMIT/i.test(code) || /doing that too much/i.test(detail)) {
    const mins = detail.match(/(\d+)\s*minutes?/i)?.[1] ?? detail.match(/(\d+)\s*seconds?/i)?.[1];
    return `Reddit rate-limited this account (${detail.slice(0, 120)}). Wait${mins ? ` ~${mins} minutes` : ''} and retry — the queue will back off on its own.`;
  }
  if (/ALREADY_SUB/i.test(code)) {
    return 'Reddit says this is already posted there (ALREADY_SUB) — check the subreddit before reposting.';
  }
  if (/SUBREDDIT_NOTALLOWED|NO_PRIVILEGES|NOTALLOWED/i.test(code)) {
    return `That community doesn't allow posts from this account (${code || 'restricted'}). Check its rules, karma minimums, or mod approval — then retry.`;
  }
  if (/SUBREDDIT_NOEXIST|SUBREDDIT_NOT_FOUND/i.test(code)) {
    return 'That subreddit doesn\u2019t exist (or the name is misspelled) — reconnect and pick it again.';
  }
  if (/NO_TEXT|NO_TITLE|NO_SUBJECT|TOO_LONG/i.test(code)) {
    return `Reddit refused the post text (${code}): ${detail.slice(0, 140)}`;
  }
  if (/USER_REQUIRED|PLEASE_LOGIN/i.test(code)) {
    return 'Reddit rejected the login — reconnect Reddit in Connect.';
  }
  if (/BANNED|ACCOUNT/i.test(code)) {
    return `Reddit blocked this account (${detail.slice(0, 140)}). Check the account standing on reddit.com.`;
  }
  return `Reddit refused the post: ${detail.slice(0, 160)}`;
}

export function subredditOf(externalId: string): string {
  const m = String(externalId ?? '').match(/\/r\/([A-Za-z0-9_]+)\s*$/);
  if (!m) throw new Error('Reddit subreddit is missing — reconnect the channel in Connect.');
  return m[1];
}

export function redditUserOf(externalId: string): string {
  const m = String(externalId ?? '').match(/^u\/([A-Za-z0-9_-]+)\/r\//);
  return m ? m[1] : '';
}

/** Fresh access token (refresh-first when stale). Rotating-safe: Reddit
 *  keeps the same permanent refresh token, access is rewritten in Vault. */
export async function ensureRedditToken(b: Bundle, force = false): Promise<string> {
  const fresh =
    !force && b.secrets.expires_at && Date.parse(b.secrets.expires_at) > Date.now() + 600000;
  if (fresh && b.secrets.access_secret_id) {
    const access = await readSecret(b.secrets.access_secret_id);
    if (access) return access;
  }
  if (!b.secrets.refresh_secret_id) {
    throw new Error('Reddit session expired — reconnect Reddit in Connect.');
  }
  const refresh = await readSecret(b.secrets.refresh_secret_id);
  if (!refresh) throw new Error('Reddit session expired — reconnect Reddit in Connect.');
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basic(id, secret), 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.access_token) {
    const detail =
      typeof json?.error === 'string' && json.error ? json.error : `HTTP ${res.status}`;
    throw new Error(`Reddit refused the refresh (${detail}) — reconnect Reddit in Connect.`);
  }
  const access = String(json.access_token);
  if (b.secrets.access_secret_id) await updateSecret(b.secrets.access_secret_id, access);
  // Reddit refresh tokens are permanent (duration=permanent); if it ever
  // rotates one, persist the new value the same way X does.
  if (typeof json.refresh_token === 'string' && json.refresh_token && json.refresh_token !== refresh) {
    await updateSecret(b.secrets.refresh_secret_id, String(json.refresh_token));
  }
  const { required } = await import('./env');
  const base = required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
  const k = required('WORKER_SERVICE_ROLE_KEY');
  await fetch(`${base}/rest/v1/channel_tokens?channel_id=eq.${encodeURIComponent(b.channel.id)}`, {
    method: 'PATCH',
    headers: { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      expires_at: new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return access;
}

async function api<T>(access: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, 'User-Agent': UA, ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (res.status === 401) throw new Error('__EXPIRED__');
  if (res.status === 429) throw new Error('Reddit rate limit hit (429) — the queue backs off on its own.');
  if (!res.ok || !json) throw new Error(`Reddit refused the request (HTTP ${res.status}).`);
  return json;
}

export async function publishRedditTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const sr = subredditOf(b.channel.external_id);
  let access: string;
  try {
    access = await ensureRedditToken(b);
  } catch (e) {
    throw e;
  }

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const firstLine = text.split('\n')[0]?.trim() ?? '';
  const title = (b.post.title ?? '').trim() || firstLine.slice(0, 300);
  if (!title) throw new Error('Reddit needs a title — add one in the composer (first line works).');
  if (!text) throw new Error('Reddit needs post text — this post is empty (v1 sends text posts only).');

  const form = new URLSearchParams({
    api_type: 'json',
    kind: 'self',
    sr,
    title: title.slice(0, 300),
    text: text.slice(0, 40000),
  });
  let data: { json?: { errors?: [string, string, string?][]; data?: { url?: string; id?: string; name?: string } } };
  try {
    data = await api<typeof data>(access, '/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (e: any) {
    if (e?.message === '__EXPIRED__') {
      access = await ensureRedditToken(b, true);
      data = await api<typeof data>(access, '/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
    } else {
      throw e;
    }
  }
  const errors = data?.json?.errors;
  if (errors && errors.length > 0) throw new Error(submitErr(errors, 'submit failed'));
  const posted = data?.json?.data;
  if (!posted?.name && !posted?.id && !posted?.url) {
    throw new Error('Reddit accepted the post but returned no id — check r/' + sr + ' before retrying.');
  }
  const remoteId = String(posted.name ?? posted.id);
  const remoteUrl = posted.url ?? `https://www.reddit.com/r/${sr}/`;
  info('reddit post published', { target: b.target.id, post: remoteId });
  return { remoteId, remoteUrl };
}

/** Connect-time validation: /me proves the token and names the account. */
export async function redditValidate(access: string): Promise<{ username: string; userId: string; avatar?: string }> {
  const me = await api<{ name?: string; id?: string; icon_img?: string }>(access, '/api/v1/me');
  if (!me?.name) throw new Error('Reddit hid the account — try connecting again.');
  const avatar = typeof me.icon_img === 'string' && me.icon_img ? me.icon_img : undefined;
  return { username: me.name, userId: String(me.id ?? ''), avatar };
}

/** Connect-time subreddit picker source: subs the account can post to. */
export async function redditSubreddits(access: string): Promise<{ name: string; title: string; subscribers: number }[]> {
  const out: { name: string; title: string; subscribers: number }[] = [];
  let after = '';
  for (let page = 0; page < 3 && out.length < 200; page++) {
    const qs = new URLSearchParams({ limit: '100', ...(after ? { after } : {}) });
    const j = await api<{
      data?: {
        after?: string | null;
        children?: { data?: { display_name?: string; title?: string; subscribers?: number } }[];
      };
    }>(access, `/subreddits/mine/subscriber?${qs.toString()}`);
    const kids = j?.data?.children ?? [];
    for (const k of kids) {
      const name = k?.data?.display_name;
      if (name) {
        out.push({
          name,
          title: k.data?.title || `r/${name}`,
          subscribers: Number(k.data?.subscribers ?? 0),
        });
      }
    }
    after = j?.data?.after ?? '';
    if (!after) break;
  }
  return out;
}
