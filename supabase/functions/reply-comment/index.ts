// reply-comment · queue a comment reply for the worker.
//
// POST { provider: 'facebook'|'threads'|'instagram', channel_id, comment_id, message }
// → { queued: true }
//
// Gate: caller must be an ACTIVE member of the channel's workspace
// (verified against workspace_members via their JWT — never trust body ids).
// Replies post AS the connected Page/identity, so members trigger them but
// the reply is authored by the Page, matching the publishing model.
// Facebook, Threads + Instagram only; other providers refuse with a clear error.

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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured.", 500);

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
  const provider = String(body["provider"] ?? "");
  const channelId = String(body["channel_id"] ?? "");
  const commentId = String(body["comment_id"] ?? "");
  const message = String(body["message"] ?? "").trim();
  if (!provider || !channelId || !commentId || !message) {
    return bad("provider, channel_id, comment_id and message are required.");
  }
  const dmProviders = new Set(["facebook", "threads", "instagram", "x", "mastodon"]);
  if (!dmProviders.has(provider)) {
    return bad("Replies are supported for Facebook, Threads, Instagram, X and Mastodon only.");
  }
  if (message.length > 2200) return bad("Reply exceeds 2200 characters.");

  const admin = createClient(supaUrl, serviceKey);
  const { data: ch, error: chErr } = await admin
    .from("connected_channels")
    .select("id, workspace_id, provider, status")
    .eq("id", channelId)
    .maybeSingle();
  if (chErr || !ch) return bad("Channel not found.", 404);
  if ((ch as any).provider !== provider) return bad("Channel provider mismatch.", 400);
  if ((ch as any).status !== "connected") return bad("That channel is not connected.", 400);

  const { data: mem, error: mErr } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", (ch as any).workspace_id)
    .eq("user_id", ud.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (mErr || !mem) return bad("You are not a member of that channel's workspace.", 403);

  const { error: qErr } = await admin.from("job_queue").upsert({
    kind: "reply_comment",
    payload: { provider, channel_id: channelId, comment_id: commentId, message },
    run_at: new Date().toISOString(),
    idempotency_key: `reply_comment:${crypto.randomUUID()}`,
  }, { onConflict: "idempotency_key" });
  if (qErr) return bad(`Could not queue the reply (${qErr.message}).`, 500);

  return Response.json({ queued: true }, { headers: CORS });
});
