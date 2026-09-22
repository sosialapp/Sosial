// send-notification · owner broadcast trigger (app admins only)
//
// POST { title, body } → 200 { queued: true, audience } · 401 · 403
//
// The worker owns delivery (Expo Push API + dead-token pruning), so this
// endpoint only verifies the caller is an app admin and enqueues one
// send_push job. Broadcast v1: every registered device token.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
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

  // Global admin gate (P11): SECURITY DEFINER reads app_admins, but
  // auth.uid() comes from the caller's JWT, so this is a real check.
  const { data: admin, error: aErr } = await userClient.rpc("is_app_admin");
  if (aErr || admin !== true) return bad("Owner console only.", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  const message = typeof body["body"] === "string" ? body["body"].trim() : "";
  if (!title || !message) return bad("title and body required.");
  if (title.length > 120 || message.length > 500) {
    return bad("title ≤ 120 chars, body ≤ 500 chars.");
  }

  const adminClient = createClient(supaUrl, serviceKey);
  const { count } = await adminClient
    .from("push_tokens")
    .select("id", { count: "exact", head: true });

  // Fresh idempotency key per send: broadcasts are never deduped.
  const { error: qErr } = await adminClient.from("job_queue").upsert(
    {
      kind: "send_push",
      payload: { title, body: message },
      run_at: new Date().toISOString(),
      idempotency_key: `send_push:${Date.now()}:${crypto.randomUUID()}`,
    },
    { onConflict: "idempotency_key" },
  );
  if (qErr) return bad(`Could not queue the broadcast (${qErr.message}).`, 500);

  return Response.json({ queued: true, audience: count ?? 0 });
});
