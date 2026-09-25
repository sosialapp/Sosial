import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLANS, type PlanKey } from './plans';
import type { Entitlement } from './entitlement';

/**
 * Usage tracking. The USAGE PERIOD is a calendar month ('YYYY-MM', UTC) and is
 * deliberately separate from the BILLING PERIOD: an annual subscriber renews
 * yearly but their AI generation and scheduled-post allowances still reset
 * every month. Limits come from the canonical plan config (null = unlimited).
 */

export interface UsageSnapshot {
  month: string;
  aiGenerations: number;
  posts: number;
  aiLimit: number | null;
  postLimit: number | null;
}

/** Current usage-month bucket, UTC. */
export function usageMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getUsage(workspaceId: string, plan: PlanKey): Promise<UsageSnapshot> {
  const month = usageMonth();
  const out: UsageSnapshot = {
    month,
    aiGenerations: 0,
    posts: 0,
    aiLimit: PLANS[plan].limits.aiGenerations,
    postLimit: PLANS[plan].limits.scheduledPosts,
  };
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('usage_counters')
      .select('ai_generations, posts')
      .eq('workspace_id', workspaceId)
      .eq('month', month)
      .maybeSingle();
    if (data) {
      out.aiGenerations = data.ai_generations ?? 0;
      out.posts = data.posts ?? 0;
    }
  } catch {
    // usage read failing must never break the page — treat as zero
  }
  return out;
}

export function overAiLimit(u: UsageSnapshot): boolean {
  return u.aiLimit !== null && u.aiGenerations >= u.aiLimit;
}

export function overPostLimit(u: UsageSnapshot): boolean {
  return u.postLimit !== null && u.posts >= u.postLimit;
}

export type { Entitlement };
