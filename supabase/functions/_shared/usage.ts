// _shared/usage.ts · AI credit gate for the AI edge functions.
//
// USAGE PERIOD ≠ BILLING PERIOD: credits reset every calendar month
// ('YYYY-MM', UTC) even for annual subscribers — the billing interval only
// changes price and renewal. The allowance and the atomic, idempotent charge
// both live in the database (plan_limits + ai_consume_credits), so the edge
// function never has to trust the client or race another invocation.
//
// Uses only fetch/PostgREST — no supabase-js dependency in the bundle.

import { type AiAction, AI_MODEL_ID, costOf } from "./aiCredits.ts";

export interface AiGateContext {
  supaUrl: string;
  serviceKey: string;
  authHeader: string;
  anonKey: string;
}

export interface AiGateResult {
  ok: boolean;
  message?: string;
  status?: number;
  /** credits left this month after this charge; null = unlimited */
  remaining?: number | null;
  /** echo of the idempotency key used for the charge (pass to refund) */
  requestId?: string;
}

function rest(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function json(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Verify the caller's JWT and return their user id, or "" when unauthenticated. */
export async function callerId(ctx: AiGateContext): Promise<string> {
  try {
    const me = await fetch(`${ctx.supaUrl}/auth/v1/user`, {
      headers: { Authorization: ctx.authHeader, apikey: ctx.anonKey },
    });
    if (!me.ok) return "";
    const body = (await json(me)) as { id?: string } | null;
    return body?.id ?? "";
  } catch {
    return "";
  }
}

async function workspaceFor(supaUrl: string, serviceKey: string, uid: string): Promise<string> {
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/workspace_members?user_id=eq.${uid}&status=eq.active&select=workspace_id&limit=1`,
      { headers: rest(serviceKey) },
    );
    const rows = (await json(r)) as { workspace_id: string }[] | null;
    return rows?.[0]?.workspace_id ?? "";
  } catch {
    return "";
  }
}

/**
 * Charge `action`'s credit cost for the caller. Atomic + idempotent by
 * `requestId` (pass a stable id to make retries free). Returns ok:false with
 * an upgrade-friendly message when the plan has no credits left.
 */
export async function gateAiCredits(
  ctx: AiGateContext,
  action: AiAction,
  requestId: string,
): Promise<AiGateResult> {
  const uid = await callerId(ctx);
  if (!uid) return { ok: false, message: "Sign in first.", status: 401 };

  const wid = await workspaceFor(ctx.supaUrl, ctx.serviceKey, uid);
  if (!wid) {
    return { ok: false, message: "Set up your workspace to use AI.", status: 402 };
  }

  const credits = costOf(action);
  let payload: {
    ok?: boolean;
    message?: string;
    status?: number;
    remaining?: number | null;
  } | null = null;
  try {
    const res = await fetch(`${ctx.supaUrl}/rest/v1/rpc/ai_consume_credits`, {
      method: "POST",
      headers: { ...rest(ctx.serviceKey), "Content-Type": "application/json" },
      body: JSON.stringify({
        p_workspace_id: wid,
        p_user_id: uid,
        p_action: action,
        p_credits: credits,
        p_request_id: requestId,
        p_model: AI_MODEL_ID,
      }),
    });
    payload = (await json(res)) as typeof payload;
  } catch {
    // A gate failure must not silently give away paid AI — fail closed.
    return { ok: false, message: "Could not check your AI credits. Try again.", status: 503 };
  }

  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      message: payload?.message ?? "You're out of AI credits for this month.",
      status: payload?.status ?? 402,
      remaining: payload?.remaining ?? null,
      requestId,
    };
  }
  return { ok: true, remaining: payload.remaining ?? null, requestId };
}

/** Refund a charge when generation fails before producing output. Best-effort. */
export async function refundAiCredits(ctx: AiGateContext, requestId: string): Promise<void> {
  try {
    await fetch(`${ctx.supaUrl}/rest/v1/rpc/ai_refund_credits`, {
      method: "POST",
      headers: { ...rest(ctx.serviceKey), "Content-Type": "application/json" },
      body: JSON.stringify({ p_request_id: requestId }),
    });
  } catch {
    // best-effort; a failed refund is recoverable from ai_usage_events
  }
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
