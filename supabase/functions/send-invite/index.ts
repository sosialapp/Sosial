// send-invite · workspace invite delivery (owner/admin only)
//
// POST { workspace_id, email, role? ('admin'|'member'), all_channels? }
// → 200 { invite_id, token } · 401 unauthenticated · 403 not owner/admin
//
// Flow: creates (or refreshes) the invite row through the create_invite RPC
// as the CALLER (single source of truth — the RPC enforces the role check),
// then sends the email with auth.admin and enqueues a job_queue send_invite
// job so the worker retries delivery if this call fails after row creation.
// The emailed link points at the web redeem page: {SITE_URL}/invite/<token>.
//
// Secrets (supabase secrets set): SITE_URL (public web origin, e.g.
// https://sosial.app). Supabase URL/keys are injected by the platform.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROLES = new Set(["admin", "member"]);

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://sosial.app").replace(/\/+$/, "");
  if (!supaUrl || !anonKey || !serviceKey) {
    return bad("Function misconfigured — missing Supabase env.", 500);
  }

  // Caller identity from their own JWT (never trust a body user_id).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  if (uErr || !ud?.user) return bad("Sign in first.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const workspace_id = body["workspace_id"];
  const email = body["email"];
  const role = typeof body["role"] === "string" && ROLES.has(body["role"]) ? body["role"] : "member";
  const all_channels = body["all_channels"] === true;
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof email !== "string" || !email.includes("@")) return bad("Valid email required.");

  // Invite row via the RPC as the caller — the function itself enforces
  // owner/admin, so a 428 here means "not allowed", surfaced as 403.
  const { data: invite, error: invErr } = await userClient.rpc("create_invite", {
    p_workspace_id: workspace_id,
    p_email: email.trim(),
    p_role: role,
    p_all_channels: all_channels,
  });
  if (invErr || !invite?.id || !invite?.token) {
    const msg = String(invErr?.message ?? "Could not create the invite.");
    const status = /only owners and admins|cannot invite/i.test(msg) ? 403 : 400;
    return bad(msg, status);
  }

  const admin = createClient(supaUrl, serviceKey);

  // Email via Auth admin (uses the project's SMTP sender, e.g. Resend).
  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(String(invite.email), {
    redirectTo: `${siteUrl}/invite/${invite.token}`,
    data: { workspace_id, invite_id: invite.id },
  });
  if (mailErr) {
    // Row exists, mail failed: enqueue the retry job and tell the caller —
    // the worker re-sends until delivery succeeds or the invite expires.
    await admin.from("job_queue").upsert(
      {
        kind: "send_invite",
        payload: { invite_id: invite.id },
        run_at: new Date().toISOString(),
        idempotency_key: `send_invite:${invite.id}`,
      },
      { onConflict: "idempotency_key" },
    );
    return bad(`Invite saved but the email failed (${mailErr.message}) — retry queued.`, 502);
  }
  await admin.from("invites").update({ emailed_at: new Date().toISOString() }).eq("id", invite.id);

  return Response.json({ invite_id: invite.id, token: invite.token });
});
