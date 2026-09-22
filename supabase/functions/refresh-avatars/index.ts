// refresh-avatars · server-side profile-picture backfill (any workspace member)
//
// POST { workspace_id } → 200 { queued: true } · 401 · 403 not a member
//
// The worker owns the real fetch (it can refresh provider tokens from Vault),
// so this endpoint only verifies membership and enqueues one sync_avatars job.
// The idempotency key is time-bucketed so repeated page loads collapse into a
// single job per window instead of flooding the queue.
//
// Secrets: none beyond the platform-injected Supabase URL/keys.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET_MS = 5 * 60 * 1000;

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const workspace_id = body["workspace_id"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");

  // Membership check via RLS (members_member_read): a non-member sees no row.
  const { data: member } = await userClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", ud.user.id)
    .maybeSingle();
  if (!member) return bad("Not a member of this workspace.", 403);

  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const admin = createClient(supaUrl, serviceKey);
  const { error: qErr } = await admin.from("job_queue").upsert(
    {
      kind: "sync_avatars",
      payload: { workspace_id },
      run_at: new Date().toISOString(),
      idempotency_key: `sync_avatars:${workspace_id}:${bucket}`,
    },
    { onConflict: "idempotency_key" },
  );
  if (qErr) return bad(`Could not queue avatar refresh (${qErr.message}).`, 500);

  return Response.json({ queued: true });
});
