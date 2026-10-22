/** Subscribe the Page to Messenger/comment webhooks. Best-effort: without
 *  `pages_manage_metadata` Meta refuses, and polling still works, so a
 *  refusal is recorded in metadata instead of failing the job. */
import { readSecret, rest } from './db';
import { restPatch } from './rest';
import { warn } from './logger';

const GRAPH = 'https://graph.facebook.com/v21.0';
const FIELDS = 'messages,messaging_postbacks,messaging_reactions,comments,feed';

interface Row {
  id: string;
  provider: string;
  external_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  channel_tokens?: { access_token_secret_id: string | null }[] | { access_token_secret_id: string | null } | null;
}

export async function ensureMetaWebhook(channelId: string): Promise<'subscribed' | 'skipped'> {
  const rows = await rest<Row[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,provider,external_id,status,metadata,channel_tokens(access_token_secret_id)&limit=1`,
  );
  const c = rows?.[0];
  if (!c || c.provider !== 'facebook' || c.status !== 'connected') return 'skipped';

  const t = Array.isArray(c.channel_tokens) ? c.channel_tokens[0] : c.channel_tokens;
  const token = t?.access_token_secret_id ? await readSecret(t.access_token_secret_id) : null;
  if (!token) return 'skipped';

  const r = await fetch(
    `${GRAPH}/${encodeURIComponent(c.external_id)}/subscribed_apps?subscribed_fields=${FIELDS}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  );
  const j = await r.json().catch(() => null);
  const ok = r.ok && j?.success !== false;
  const meta: Record<string, unknown> = {
    ...(c.metadata ?? {}),
    webhookReady: ok,
    webhookCheckedAt: new Date().toISOString(),
  };
  if (ok) {
    delete meta.webhookError;
  } else {
    meta.webhookError = String(j?.error?.message ?? `HTTP ${r.status}`).slice(0, 200);
    warn(`meta subscribe ${c.external_id}: ${meta.webhookError}`);
  }
  await restPatch('connected_channels', c.id, { metadata: meta });
  return ok ? 'subscribed' : 'skipped';
}
