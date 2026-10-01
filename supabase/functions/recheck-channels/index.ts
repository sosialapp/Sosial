// recheck-channels · on-demand channel health check (owner/admin)
//
// POST { workspace_id } → 200 { queued_refresh, avatars_queued, skipped }
// The worker owns credential truth (it can refresh from Vault), so this
// endpoint only verifies membership and enqueues one refresh_token job per
// connected channel plus one sync_avatars job. The worker marks auth-dead
// channels 'expired' with last_error (refresh.ts outcome policy); bot-token
// providers (telegram/discord) and Mastodon get a live ping instead of a
// rotation. Meta-family tokens are long-lived — failures surface at publish.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured — missing Supabase env.", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  const user = ud?.user;
  if (uErr || !user) return bad("Sign in first.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const workspace_id = body["workspace_id"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const { data: member } = await admin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (member as { role?: string; status?: string } | null)?.role;
  if (!member || member.status !== "active" || (role !== "owner" && role !== "admin")) {
    return bad("Only workspace owners and admins can check channel health.", 403);
  }

  const { data: channels, error: cErr } = await admin
    .from("connected_channels")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("status", "connected");
  if (cErr) return bad("Could not list channels.", 500);
  const ids = ((channels ?? []) as { id: string }[]).map((c) => c.id);

  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const jobs = ids.map((id) => ({
    kind: "refresh_token",
    payload: { channel_id: id },
    run_at: new Date().toISOString(),
    idempotency_key: `recheck:${id}:${bucket}`,
  }));
  if (jobs.length) {
    const { error: qErr } = await admin.from("job_queue").upsert(jobs, {
      onConflict: "idempotency_key",
    });
    if (qErr) return bad(`Could not queue the health check (${qErr.message}).`, 500);
  }
  // Photos refresh in the same pass.
  await admin.from("job_queue").upsert(
    {
      kind: "sync_avatars",
      payload: { workspace_id },
      run_at: new Date().toISOString(),
      idempotency_key: `sync_avatars:${workspace_id}:${bucket}`,
    },
    { onConflict: "idempotency_key" },
  );

  return Response.json(
    { queued_refresh: jobs.length, avatars_queued: true },
    { headers: CORS },
  );
});
