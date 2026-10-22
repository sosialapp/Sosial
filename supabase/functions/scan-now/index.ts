// scan-now — user-triggered unified sync (refresh buttons)
//
// POST { workspace_id } → { ok: true, queued: true }
// Verifies membership (JWT), then enqueues sync_inbox + sync_comments jobs
// for every Phase-1 channel in the workspace. The enqueue function's
// per-workspace-per-minute idempotency key means repeated clicks within the
// same minute dedupe — hammering the button floods nothing. The worker
// picks the jobs up within seconds; the UI polls the lists afterwards.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function fail(msg: string, status = 400): Response {
  return Response.json({ ok: false, error: msg }, { status, headers: CORS });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return fail("Function misconfigured.", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return fail("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  const user = ud?.user;
  if (uErr || !user) return fail("Sign in first.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON.");
  }
  const workspace_id = typeof body["workspace_id"] === "string" ? body["workspace_id"] : "";
  if (!workspace_id) return fail("workspace_id required.");

  const admin = createClient(supaUrl, serviceKey);

  // Membership gate (service client bypasses RLS — this IS the check).
  const { data: mem } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (!mem || mem.length === 0) return fail("Not a member of this workspace.", 403);

  const { error: qErr } = await admin.rpc("enqueue_unified_sync_on_demand", {
    p_workspace: workspace_id,
  });
  if (qErr) return fail(`Could not queue the refresh (${qErr.message}).`, 500);

  return Response.json({ ok: true, queued: true }, { headers: CORS });
});
