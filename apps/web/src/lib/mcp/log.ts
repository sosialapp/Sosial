import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Structured MCP observability: one row per tool call with outcome and
 * latency — never content bodies, never tokens. Backed by a dedicated
 * table (p49) so it survives serverless isolation; failures to log are
 * swallowed (observability must never fail a user call).
 */
export async function logTool(
  admin: ReturnType<typeof supabaseAdmin> | { from: (t: string) => any },
  keyId: string,
  workspaceId: string,
  userId: string | null,
  tool: string,
  outcome: string,
  latencyMs: number,
): Promise<void> {
  try {
    await (admin as { from: (t: string) => any })
      .from('mcp_logs')
      .insert({
        workspace_id: workspaceId,
        key_id: keyId,
        user_id: userId,
        tool,
        outcome,
        latency_ms: Math.round(latencyMs),
      });
  } catch {
    /* never fail a call over logging */
  }
}
