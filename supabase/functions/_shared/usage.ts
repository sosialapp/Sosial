// _shared/usage.ts · monthly AI allowance gate for the AI edge functions.
//
// USAGE PERIOD ≠ BILLING PERIOD: allowances reset every calendar month
// ('YYYY-MM', UTC) even for annual subscribers — the billing interval only
// changes price and renewal. Limits come from the canonical plan book
// (identical for monthly and annual of the same plan); null = unlimited.

export const AI_LIMITS: Record<string, number | null> = {
  free: 0,
  starter: 500,
  pro: 1000,
  business: 2000,
};

export interface AiGateResult {
  ok: boolean;
  message?: string;
  status?: number;
}

function rest(url: string, key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function json(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Check + consume one AI generation for the caller. Returns { ok: true } and
 * records usage, or { ok: false, message } with an upgrade-friendly error.
 * Uses only fetch/PostgREST — no supabase-js dependency in the bundle.
 */
export async function gateAiGeneration(
  supaUrl: string,
  serviceKey: string,
  authHeader: string,
  anonKey: string,
): Promise<AiGateResult> {
  // 1. Caller identity
  let uid = "";
  try {
    const me = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!me.ok) return { ok: false, message: "Sign in first.", status: 401 };
    const body = (await json(me)) as { id?: string } | null;
    uid = body?.id ?? "";
  } catch {
    return { ok: false, message: "Sign in first.", status: 401 };
  }
  if (!uid) return { ok: false, message: "Sign in first.", status: 401 };

  const headers = rest(supaUrl, serviceKey);

  // 2. The caller's workspace (matches the app's single-workspace model)
  let wid = "";
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/workspace_members?user_id=eq.${uid}&status=eq.active&select=workspace_id&limit=1`,
      { headers },
    );
    const rows = (await json(r)) as { workspace_id: string }[] | null;
    wid = rows?.[0]?.workspace_id ?? "";
  } catch {
    // fall through — treated as no workspace
  }
  if (!wid) {
    return {
      ok: false,
      message: "AI writing is on Starter and up — upgrade in Billing to unlock it.",
      status: 402,
    };
  }

  // 3. Plan → allowance
  let plan = "free";
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/subscriptions?workspace_id=eq.${wid}&select=plan&limit=1`,
      { headers },
    );
    const rows = (await json(r)) as { plan: string }[] | null;
    plan = rows?.[0]?.plan ?? "free";
  } catch {
    plan = "free";
  }
  const limit = AI_LIMITS[plan] ?? 0;
  if (limit === null) return { ok: true }; // unlimited

  const month = new Date().toISOString().slice(0, 7);

  // 4. Current usage this month
  let used = 0;
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/usage_counters?workspace_id=eq.${wid}&month=eq.${month}&select=ai_generations&limit=1`,
      { headers },
    );
    const rows = (await json(r)) as { ai_generations: number }[] | null;
    used = rows?.[0]?.ai_generations ?? 0;
  } catch {
    used = 0;
  }

  if (used >= limit) {
    return {
      ok: false,
      message:
        limit === 0
          ? "AI writing is on Starter and up — upgrade in Billing to unlock it."
          : `You've used all ${limit} AI generations for this month — they reset on the 1st, or upgrade for more.`,
      status: 402,
    };
  }

  // 5. Consume one generation (atomic upsert)
  try {
    await fetch(`${supaUrl}/rest/v1/rpc/billing_add_ai_generation`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_workspace_id: wid }),
    });
  } catch {
    // usage write failing must never block a paying customer's generation
  }

  return { ok: true };
}
