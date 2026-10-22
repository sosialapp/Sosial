// inbox-send — queue a DM send for the unified sync worker (p92).
//
// POST { conversation_id, text }
// → 200 { queued: true } | { ok:false, error, upgrade? } | hard errors
//
// Gates: user JWT → active membership of the conversation's workspace →
// paid plan → the conversation's channel must be connected and speak DM
// (Phase 1: facebook, instagram, mastodon, x, bluesky). The worker sends
// through the adapter and writes the message row; the UI sees it land via
// the next messages read.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function fail(msg: string, upgrade = false): Response {
  return Response.json({ ok: false, error: msg, ...(upgrade ? { upgrade: true } : {}) }, { headers: CORS });
}
function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

const SUPPORTED = new Set(["facebook", "instagram", "mastodon", "x", "bluesky"]);
const NOT_YET: Record<string, string> = {
  threads: "Unified Inbox for Threads is coming in the next release.",
  youtube: "Messaging is not offered by the YouTube API.",
  linkedin: "Unified messaging for LinkedIn is planned.",
  tiktok: "Unified messaging for TikTok is not available — the API only exposes comments.",
  pinterest: "Messaging is not exposed by the Pinterest API.",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("POST only");

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return fail("Function misconfigured, missing Supabase env.");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  const user = ud?.user;
  if (uErr || !user) return bad("Sign in first.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON.");
  }
  const conversationId = String(body["conversation_id"] ?? "");
  const text = String(body["text"] ?? body["message"] ?? "").trim();
  if (!conversationId) return fail("conversation_id required.");
  if (!text) return fail("Write a message first.");
  if (text.length > 2000) return fail(`Messages are limited to 2000 characters.`);

  const admin = createClient(supaUrl, serviceKey);

  // Conversation → channel → workspace, never client-supplied.
  const { data: conv, error: cvErr } = await admin
    .from("conversations")
    .select("id, workspace_id, channel_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (cvErr || !conv) return fail("Conversation not found, refresh your inbox.");
  const workspace_id = String((conv as any).workspace_id);

  // Membership gate (service client bypasses RLS — this IS the check).
  const { data: mem } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (!mem || mem.length === 0) return bad("Not a member of this workspace.", 403);

  // Paid-only feature, resolved by the canonical DB function.
  const { data: planRow } = await admin.rpc("workspace_plan", { p_workspace_id: workspace_id });
  const plan = typeof planRow === "string" && planRow ? planRow : "free";
  if (plan === "free") return fail("Direct messages are available on paid plans. Upgrade to unlock the Messages inbox.", true);

  // The channel must still be connected and speak DM.
  const { data: ch, error: chErr } = await admin
    .from("connected_channels")
    .select("id, provider, status")
    .eq("id", (conv as any).channel_id)
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  if (chErr || !ch) return fail("Channel not found in this workspace.");
  if ((ch as any).status !== "connected") return fail("That channel is disconnected, reconnect it in Connect.");
  const provider = String((ch as any).provider);
  if (NOT_YET[provider]) return fail(NOT_YET[provider]);
  if (!SUPPORTED.has(provider)) return fail("This channel cannot send direct messages.");

  const { error: qErr } = await admin.rpc("enqueue_send_message", {
    p_channel: (ch as any).id,
    p_conversation: conversationId,
    p_text: text,
  });
  if (qErr) {
    if (/invalid_message/i.test(String(qErr.message))) return fail("Write a message between 1 and 2000 characters.");
    return fail(`Could not queue the message (${qErr.message}).`);
  }
  return Response.json({ ok: true, queued: true }, { headers: CORS });
});
