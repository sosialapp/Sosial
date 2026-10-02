/**
 * Native Reddit publishing (OAuth, per-subreddit rows, self posts). Mirrors
 * apps/worker/src/reddit.ts: /api/submit api_type=json kind=self with a
 * required title (300) + markdown text (40000). Karma minimums, mod queues
 * and rate limits surface as submit errors, never silently disappear.
 */

import { RD_API, RD_UA } from './redditConfig';
import { getValidRedditToken } from './redditAuth';

function submitErr(errors: [string, string, string?][] | undefined, fallback: string): string {
  const [code = '', msg = ''] = errors?.[0] ?? [];
  const detail = msg || code || fallback;
  if (/RATELIMIT/i.test(code) || /doing that too much/i.test(detail)) {
    return `Reddit rate-limited this account (${detail.slice(0, 120)}). Wait a bit and retry from Queue.`;
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
  return `Reddit refused the post: ${detail.slice(0, 160)}`;
}

/**
 * Publish a self post. Returns the fullname (t3_…) for the queue.
 * Title falls back to the first body line when the composer sends none.
 */
export async function publishReddit(opts: {
  accessToken: string;
  subreddit: string;
  title: string;
  text: string;
}): Promise<string> {
  if (!opts.accessToken) throw new Error('Reddit not connected');
  const sr = opts.subreddit.trim();
  if (!/^[A-Za-z0-9_]+$/.test(sr)) throw new Error('Reddit subreddit is missing — reconnect the channel in Connect.');
  const text = (opts.text ?? '').trim();
  if (!text) throw new Error('Reddit needs post text — this post is empty (text posts only).');
  const title = (opts.title ?? '').trim() || text.split('\n')[0]?.trim().slice(0, 300) || '';
  if (!title) throw new Error('Reddit needs a title — add one in the composer (first line works).');

  const form = new URLSearchParams({
    api_type: 'json',
    kind: 'self',
    sr,
    title: title.slice(0, 300),
    text: text.slice(0, 40000),
  });
  const res = await fetch(`${RD_API}/api/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': RD_UA,
    },
    body: form.toString(),
  });
  const j: any = await res.json().catch(() => null);
  if (res.status === 401) throw new Error('Reddit session expired — retry from Queue (it refreshes) or reconnect.');
  if (res.status === 429) throw new Error('Reddit rate limit hit — the queue backs off on its own.');
  const errors = j?.json?.errors as [string, string, string?][] | undefined;
  if (errors && errors.length > 0) throw new Error(submitErr(errors, 'submit failed'));
  const posted = j?.json?.data;
  if (!posted?.name && !posted?.id && !posted?.url) {
    throw new Error(`Reddit accepted the post but returned no id — check r/${sr} before retrying.`);
  }
  return String(posted.name ?? posted.id);
}

/** Refresh-and-post convenience used by the composer leg. */
export async function publishRedditWithRefresh(opts: {
  accountId?: string;
  refreshToken: () => Promise<string>;
  subreddit: string;
  title: string;
  text: string;
}): Promise<string> {
  const token = await opts.refreshToken();
  try {
    return await publishReddit({ ...opts, accessToken: token });
  } catch (e: any) {
    if (/session expired/i.test(String(e?.message ?? ''))) {
      return publishReddit({ ...opts, accessToken: await opts.refreshToken() });
    }
    throw e;
  }
}
