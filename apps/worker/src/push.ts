/**
 * Owner broadcast delivery over the Expo Push API (no auth needed for
 * sending; the EAS project owns its credentials server-side at Expo).
 *
 * Best-effort per chunk: one bad token never sinks the batch, and
 * DeviceNotRegistered receipts prune the dead row so the audience heals.
 *
 * `platforms` narrows the audience to the selected device types (P75). Only
 * ios/android have push tokens, so a single selected platform is an exact
 * filter; both (or omitted, for pre-P75 jobs) means every token, including
 * legacy rows whose platform predates the column.
 */
import { rest } from './db';
import { info, warn } from './logger';

interface PushTokenRow {
  expo_token: string;
}

interface PushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushBroadcast(
  title: string,
  body: string,
  platforms?: string[],
): Promise<{ sent: number; removed: number }> {
  const push = (platforms ?? []).filter((p) => p === 'ios' || p === 'android');
  const platformFilter = push.length === 1 ? `&platform=eq.${push[0]}` : '';
  const rows = await rest<PushTokenRow[]>(
    `/rest/v1/push_tokens?select=expo_token${platformFilter}`,
  );
  const uniq = [
    ...new Set(
      (rows ?? [])
        .map((r) => r.expo_token)
        .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken[')),
    ),
  ];
  let sent = 0;
  let removed = 0;
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    try {
      const r = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map((to) => ({ to, title, body }))),
      });
      const tickets = (await r.json().catch(() => [])) as PushTicket[];
      for (let j = 0; j < chunk.length; j++) {
        const tk = Array.isArray(tickets) ? tickets[j] : undefined;
        if (!r.ok || tk?.status !== 'ok') {
          warn(`push ${chunk[j].slice(0, 26)}… failed: ${tk?.message ?? `http ${r.status}`}`);
          if (tk?.details?.error === 'DeviceNotRegistered') {
            try {
              await rest<unknown>(
                `/rest/v1/push_tokens?expo_token=eq.${encodeURIComponent(chunk[j])}`,
                { method: 'DELETE' },
              );
              removed += 1;
            } catch {}
          }
        } else {
          sent += 1;
        }
      }
    } catch (e: any) {
      warn(`push chunk failed: ${e?.message ?? e}`);
    }
  }
  info(
    `send_push done: ${sent} sent, ${removed} pruned, ${uniq.length} tokens` +
      (platformFilter ? ` (${push[0]} only)` : ''),
  );
  return { sent, removed };
}
