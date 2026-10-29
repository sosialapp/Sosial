// moderate-comment · hide or unhide a comment on the platform (p114).
//
// POST { comment_id, hide: boolean }
// → 200 { queued: true } | { error }
//
// Same gate as reply-comment: caller must be an ACTIVE member of the
// comment's workspace, resolved from the comment itself. Only Facebook
// Pages and Instagram expose hiding; our own replies cannot be hidden.

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

const SUPPORTED = new Set(["facebook", "instagram"]);

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
  const commentId = String(body["comment_id"] ?? "");
  const hide = body["hide"] !== false;
  if (!commentId) return bad("comment_id is required.");

  const admin = createClient(supaUrl, serviceKey);

  // Comment → channel → workspace, never client-supplied.
  const { data: cm, error: cErr } = await admin
    .from("comments")
    .select("id, workspace_id, channel_id, status, is_own")
    .eq("id", commentId)
    .maybeSingle();
  if (cErr || !cm) return bad("Comment not found.", 404);
  if ((cm as any).is_own) return bad("Your own replies cannot be hidden.");

  const { data: mem, error: mErr } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", (cm as any).workspace_id)
    .eq("user_id", ud.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (mErr || !mem) return bad("You are not a member of that comment's workspace.", 403);

  // Provider gate comes from the comment's own channel (authoritative).
  const { data: ch } = await admin
    .from("connected_channels")
    .select("id, provider, status")
    .eq("id", (cm as any).channel_id)
    .maybeSingle();
  if (!ch) return bad("The channel that owns this comment is gone.", 404);
  if ((ch as any).status !== "connected") return bad("That channel is disconnected, reconnect it in Connect.");
  const provider = String((ch as any).provider);
  if (!SUPPORTED.has(provider)) return bad("Hiding comments works on Facebook and Instagram only.");

  const { error: qErr } = await admin.rpc("enqueue_moderate_comment", {
    p_channel: (ch as any).id,
    p_comment: commentId,
    p_hide: hide,
  });
  if (qErr) return bad(`Could not queue that (${qErr.message}).`, 500);
  return Response.json({ queued: true }, { headers: CORS });
});
