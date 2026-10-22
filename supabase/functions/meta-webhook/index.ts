// meta-webhook — Meta (Facebook Page + Instagram Login) webhook receiver.
//
// GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//      → echoes the challenge when META_WEBHOOK_VERIFY_TOKEN matches.
// POST signed with X-Hub-Signature-256 (HMAC-SHA256 of the raw body with
//      META_APP_SECRET) → queues a per-channel sync. The worker does the
//      provider reads/writes, so this endpoint never touches Vault and stays
//      fast; Meta retries non-2xx, so provider work must not happen inline.
//
// Configure the callback URL as https://<project>/functions/v1/meta-webhook
// and subscribe the Page to messages, messaging_postbacks,
// messaging_reactions, comments and feed (the worker does that on connect).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enc = new TextEncoder();

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } });
}

async function validSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  const expected = `sha256=${Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request): Promise<Response> => {
  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const appSecret = Deno.env.get("META_APP_SECRET") ?? "";
  const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && verifyToken && token === verifyToken) return text(challenge);
    return text("forbidden", 403);
  }

  if (req.method !== "POST") return text("POST only", 405);
  if (!supaUrl || !serviceKey || !appSecret) return text("Function misconfigured.", 500);

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256"), appSecret))) {
    return text("bad signature", 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return text("bad json", 400);
  }

  const object = String(payload?.object ?? "");
  const provider = object === "instagram" ? "instagram" : object === "page" ? "facebook" : "";
  if (!provider) return text("ignored");

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const jobs = new Map<string, Record<string, unknown>>();
  const runAt = new Date().toISOString();

  const queue = (kind: string, channelId: string, eventKey: string) => {
    const idempotency_key = `wh:${kind}:${channelId}:${eventKey}`;
    jobs.set(idempotency_key, {
      kind,
      payload: { channel_id: channelId },
      run_at: runAt,
      idempotency_key,
    });
  };

  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    const externalId = String(entry?.id ?? "");
    if (!externalId) continue;

    const { data: channels } = await admin
      .from("connected_channels")
      .select("id")
      .eq("provider", provider)
      .eq("external_id", externalId)
      .eq("status", "connected");
    const ids = ((channels ?? []) as { id: string }[]).map((c) => c.id);
    if (!ids.length) continue;

    for (const m of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      const event = m?.message ?? m?.postback ?? m?.reaction;
      if (!event) continue; // read/delivery receipts need no sync
      const key = String(
        event?.mid ?? m?.timestamp ?? `${m?.sender?.id ?? ""}:${Date.now()}`,
      );
      for (const id of ids) queue("sync_inbox", id, key);
    }

    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const field = String(change?.field ?? "");
      if (field !== "feed" && field !== "comments") continue;
      const value = change?.value ?? {};
      const key = String(value?.comment_id ?? value?.id ?? `${entry?.time ?? Date.now()}`);
      for (const id of ids) queue("sync_comments", id, key);
    }
  }

  if (jobs.size) {
    const { error } = await admin
      .from("job_queue")
      .upsert([...jobs.values()], { onConflict: "idempotency_key" });
    // 500 makes Meta retry; per-event idempotency keys keep that safe.
    if (error) return text(`queue failed: ${error.message}`, 500);
  }

  return text("ok");
});
