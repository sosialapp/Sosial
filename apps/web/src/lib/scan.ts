'use client';

/**
 * Ask the server to sweep the workspace now instead of waiting for the
 * 5-minute cron.
 *
 * `scan-now` enqueues the unified comment/inbox sync for every connected
 * channel; the worker claims those jobs within seconds and writes whatever
 * the platforms returned. The UI then updates over Realtime. That turns
 * "open the inbox" into "the inbox is current", which is the difference the
 * scheduled sweep alone cannot cover.
 *
 * The function's own idempotency key is per-workspace-per-minute, so repeats
 * cost nothing server-side; the throttle below just keeps a tab from firing
 * a request on every focus event.
 */

import { createClient } from '@/lib/supabase/client';

const MIN_GAP_MS = 55_000;
const lastRequestedAt = new Map<string, number>();

export async function requestScan(workspaceId: string): Promise<void> {
  const now = Date.now();
  if (now - (lastRequestedAt.get(workspaceId) ?? 0) < MIN_GAP_MS) return;
  lastRequestedAt.set(workspaceId, now);
  try {
    const sb = createClient();
    await sb.functions.invoke('scan-now', { body: { workspace_id: workspaceId } });
  } catch {
    // A sweep that will not start is not worth an error banner: the next
    // focus, the refresh button, and the cron all retry, and the throttle
    // expires on its own.
  }
}