// inbox-send — stateless DM sender for the Messages tab (web + mobile)
//
// Sends one message through the provider API and returns the normalized
// message. No database writes, secrets stay in Vault. Same gates as
// inbox-fetch: user JWT + workspace membership + paid plan + the channel
// must belong to the workspace and be DM-capable.
//
// POST { workspace_id, channel_id, conversation_id?, recipient_id?,
//        recipient_acct?, reply_to_id?, text }
//  - facebook / instagram: recipient_id required (the other participant)
//  - mastodon: recipient_acct required (mention), reply_to_id recommended
// => 200 { ok:true, message } | { ok:false, error, upgrade? }
//    401 unauthenticated, 403 not a member (mobile-parity hard errors)
//
// Phase-1 providers: facebook (Page Messenger send API), instagram
// (business messaging), mastodon (direct status).

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
function okj(payload: Record<string, unknown>): Response {
  return Response.json({ ok: true, ...payload }, { headers: CORS });
}

const DM_PROVIDERS = new Set(["facebook", "instagram", "mastodon"]);
const GRAPH = "https://graph.facebook.com/v23.0";
const TEXT_MAX = 2000;

async function jpost(url: string, token: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const m = j?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(m.slice(0, 300));
  }
  return j;
}
async function mpost(url: string, token: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const m = j?.error ?? `HTTP ${r.status}`;
    throw new Error(String(typeof m === "string" ? m : JSON.stringify(m)).slice(0, 300));
  }
  return j;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("POST only");

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return fail("Function misconfigured, missing Supabase env.");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return Response.json({ error: "Sign in first." }, { status: 401, headers: CORS });
  const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  const user = ud?.user;
  if (uErr || !user) return Response.json({ error: "Sign in first." }, { status: 401, headers: CORS });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON.");
  }
  const workspace_id = typeof body["workspace_id"] === "string" ? body["workspace_id"] : "";
  const channel_id = typeof body["channel_id"] === "string" ? body["channel_id"] : "";
  const text = typeof body["text"] === "string" ? body["text"].trim() : "";
  if (!workspace_id) return fail("workspace_id required.");
  if (!channel_id) return fail("channel_id required.");
  if (!text) return fail("Write a message first.");
  if (text.length > TEXT_MAX) return fail(`Messages are limited to ${TEXT_MAX} characters.`);

  const admin = createClient(supaUrl, serviceKey);

  // Membership gate (service client bypasses RLS — this IS the check).
  const { data: mem } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (!mem || mem.length === 0) return Response.json({ error: "Not a member of this workspace." }, { status: 403, headers: CORS });

  // Paid-only feature, resolved by the canonical DB function.
  const { data: planRow } = await admin.rpc("workspace_plan", { p_workspace_id: workspace_id });
  const plan = typeof planRow === "string" && planRow ? planRow : "free";
  if (plan === "free") return fail("Direct messages are available on paid plans. Upgrade to unlock the Messages inbox.", true);

  // The channel must belong to this workspace and speak DM.
  const { data: ch, error: chErr } = await admin
    .from("connected_channels")
    .select("id,provider,external_id,instance_url,channel_tokens(access_token_secret_id)")
    .eq("id", channel_id)
    .eq("workspace_id", workspace_id)
    .eq("status", "connected")
    .maybeSingle();
  if (chErr || !ch) return fail("Channel not found in this workspace.");
  const chan = ch as Record<string, any>;
  if (!DM_PROVIDERS.has(String(chan.provider))) return fail("This channel cannot send direct messages.");

  const sid = chan?.channel_tokens?.[0]?.access_token_secret_id ?? chan?.channel_tokens?.access_token_secret_id ?? null;
  if (!sid) return fail("Channel token missing, reconnect it in Connect.");
  const { data: tok } = await admin.rpc("vault_read_secret", { secret_id: sid });
  if (!tok) return fail("Channel token unavailable, reconnect it in Connect.");
  const token = String(tok);
  const provider = String(chan.provider);
  const externalId = String(chan.external_id ?? "");
  const now = new Date().toISOString();

  try {
    if (provider === "facebook" || provider === "instagram") {
      const recipientId = typeof body["recipient_id"] === "string" ? body["recipient_id"] : "";
      if (!recipientId) return fail("Missing the conversation partner, reopen the thread.");
      const url = `${GRAPH}/${encodeURIComponent(externalId)}/messages`;
      const payload: Record<string, unknown> = {
        recipient: { id: recipientId },
        message: provider === "instagram" ? { text } : { text },
        messaging_type: "RESPONSE",
      };
      const j = await jpost(url, token, payload);
      return okj({
        message: {
          provider,
          channel_id,
          conversation_id: typeof body["conversation_id"] === "string" ? body["conversation_id"] : "",
          id: String(j?.message_id ?? ""),
          text,
          from_me: true,
          from_name: null,
          ts: now,
        },
      });
    }

    // mastodon
    const base = (chan.instance_url as string | null ?? "").replace(/\/+$/, "");
    if (!base) return fail("Mastodon channel missing its instance URL, reconnect it.");
    const acct = typeof body["recipient_acct"] === "string" ? body["recipient_acct"] : "";
    if (!acct) return fail("Missing the conversation partner, reopen the thread.");
    const replyTo = typeof body["reply_to_id"] === "string" ? body["reply_to_id"] : "";
    const status = `@${acct} ${text}`.slice(0, 500);
    const payload: Record<string, unknown> = { status, visibility: "direct" };
    if (replyTo) payload.in_reply_to_id = replyTo;
    const j = await mpost(`${base}/api/v1/statuses`, token, payload);
    return okj({
      message: {
        provider: "mastodon",
        channel_id,
        conversation_id: typeof body["conversation_id"] === "string" ? body["conversation_id"] : "",
        id: String(j?.id ?? ""),
        text,
        from_me: true,
        from_name: null,
        ts: j?.created_at ?? now,
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (/expired|invalid.*token|401|OAuthException/i.test(msg)) {
      return fail(`${provider} rejected the send, the connection looks stale — reconnect the channel in Connect.`);
    }
    return fail(`Could not send: ${msg}`);
  }
});
