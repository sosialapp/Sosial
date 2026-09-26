import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLANS, type PlanKey } from './plans';

/**
 * Usage tracking.
 *
 * The USAGE PERIOD is a calendar month ('YYYY-MM', UTC) and is deliberately
 * separate from the BILLING PERIOD: an annual subscriber renews yearly but
 * their AI credit allowance still resets every month. Limits come from the
 * canonical plan config (null = unlimited).
 *
 * Scheduled posts are counted PER CONNECTED CHANNEL and are not a monthly
 * bucket: a slot is taken while a post is a draft/queued/publishing and is
 * freed the moment it publishes. So the count is derived live from
 * post_targets rather than stored in usage_counters.
 */

export interface ChannelScheduledUsage {
  channelId: string;
  scheduled: number;
}

export interface UsageSnapshot {
  /** calendar-month bucket 'YYYY-MM' (UTC) */
  month: string;
  aiCreditsUsed: number;
  aiCreditsLimit: number | null;
  aiCreditsRemaining: number | null;
  scheduledPerChannelLimit: number | null;
  /** non-published scheduled posts, per channel */
  channels: ChannelScheduledUsage[];
  scheduledTotal: number;
  /** connected accounts vs the plan's channel cap */
  channelsConnected: number;
  channelsLimit: number | null;
}

/** Current usage-month bucket, UTC. */
export function usageMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Target states that still occupy a scheduled slot (sent/skipped are freed). */
const OCCUPYING_TARGET_STATES = new Set(['pending', 'needs_approval', 'queued', 'publishing', 'failed']);

export async function getUsage(workspaceId: string, plan: PlanKey): Promise<UsageSnapshot> {
  const month = usageMonth();
  const limit = PLANS[plan].limits.aiCredits;
  const out: UsageSnapshot = {
    month,
    aiCreditsUsed: 0,
    aiCreditsLimit: limit,
    aiCreditsRemaining: limit === null ? null : limit,
    scheduledPerChannelLimit: PLANS[plan].limits.scheduledPostsPerChannel,
    channels: [],
    scheduledTotal: 0,
    channelsConnected: 0,
    channelsLimit: PLANS[plan].limits.channels,
  };

  const admin = supabaseAdmin();

  try {
    const { data } = await admin
      .from('usage_counters')
      .select('ai_credits')
      .eq('workspace_id', workspaceId)
      .eq('month', month)
      .maybeSingle();
    out.aiCreditsUsed = data?.ai_credits ?? 0;
    out.aiCreditsRemaining = limit === null ? null : Math.max(0, limit - out.aiCreditsUsed);
  } catch {
    // usage read failing must never break the page — treat as zero
  }

  try {
    const { data } = await admin
      .from('post_targets')
      .select('channel_id, status, posts!inner(workspace_id)')
      .eq('posts.workspace_id', workspaceId);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { channel_id: string; status: string }[]) {
      if (!OCCUPYING_TARGET_STATES.has(row.status)) continue;
      counts.set(row.channel_id, (counts.get(row.channel_id) ?? 0) + 1);
    }
    out.channels = [...counts.entries()].map(([channelId, scheduled]) => ({ channelId, scheduled }));
    out.scheduledTotal = out.channels.reduce((sum, c) => sum + c.scheduled, 0);
  } catch {
    // same — derived usage must not break the page
  }

  try {
    const { count } = await admin
      .from('connected_channels')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);
    out.channelsConnected = count ?? 0;
  } catch {
    // same — derived usage must not break the page
  }

  return out;
}

/** Does `cost` more credits fit within the monthly allowance? */
export function hasAiCredits(u: UsageSnapshot, cost: number): boolean {
  if (u.aiCreditsLimit === null) return true;
  return u.aiCreditsUsed + cost <= u.aiCreditsLimit;
}

export function overAiLimit(u: UsageSnapshot): boolean {
  return u.aiCreditsLimit !== null && u.aiCreditsUsed >= u.aiCreditsLimit;
}

/** Channels that have hit (or passed) the per-channel scheduled-post cap. */
export function channelsOverLimit(u: UsageSnapshot, atCapChannels: string[]): string[] {
  if (u.scheduledPerChannelLimit === null) return [];
  const full = new Set(atCapChannels);
  return u.channels.filter((c) => c.scheduled >= u.scheduledPerChannelLimit! || full.has(c.channelId)).map((c) => c.channelId);
}
