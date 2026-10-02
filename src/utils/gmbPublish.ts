/**
 * Native Google Business Profile publishing (local posts, STANDARD topic).
 * Mirrors apps/worker/src/gmb.ts: 1500-char summary per location row.
 * Offers/events/CTAs/media are v1 omissions — compat declares text only.
 */

import { API_BI } from './gmbConfig';
import { getValidGmb } from './gmbAuth';

function locationName(externalId: string): string {
  const v = String(externalId ?? '');
  if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(v)) {
    throw new Error('Google Business Profile location is missing — reconnect the channel in Connect.');
  }
  return v;
}

/** external_id (accounts/{a}/locations/{l}) drives the API path directly. */
export async function publishGmb(opts: {
  accountId?: string;
  locationExternalId: string;
  text: string;
}): Promise<string> {
  const token = await getValidGmb(opts.accountId);
  const parent = locationName(opts.locationExternalId);
  const text = (opts.text ?? '').trim();
  if (!text) throw new Error('Google Business Profile needs post text — this post is empty.');

  const res = await fetch(`${API_BI}/${parent}/localPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ languageCode: 'en', summary: text.slice(0, 1500), topicType: 'STANDARD' }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Force-refresh once and retry.
    const fresh = await getValidGmb(opts.accountId);
    const retry = await fetch(`${API_BI}/${parent}/localPosts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fresh}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode: 'en', summary: text.slice(0, 1500), topicType: 'STANDARD' }),
    });
    const rj: any = await retry.json().catch(() => ({}));
    if (!retry.ok || !rj?.name) {
      throw new Error(rj?.error?.message ?? `Google Business Profile refused the post (HTTP ${retry.status}).`);
    }
    return String(rj.name);
  }
  if (!res.ok || !j?.name) {
    const m = j?.error?.message ?? j?.message ?? `HTTP ${res.status}`;
    if (/403|permission|disabled|not been used/i.test(String(m))) {
      throw new Error(`${m} — the Google Cloud project needs Business Profile API access approved (one-time allow-list).`);
    }
    throw new Error(`Google Business Profile refused the post: ${String(m).slice(0, 160)}`);
  }
  return String(j.name);
}
