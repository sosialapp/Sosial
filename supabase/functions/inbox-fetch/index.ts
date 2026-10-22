// inbox-fetch — stateless DM reader for the Messages tab (web + mobile)
//
// Zero persistence: nothing lands in the database, every call reads straight
// from the provider API and returns a normalized payload. Secrets stay in
// Vault; the caller (user JWT) is checked for workspace membership and the
// workspace plan (Messages is a paid feature; free gets {ok:false,upgrade}).
//
  // POST { workspace_id, channel_id?, conversation_id?, limit?, after?, fresh? }
//  - conversations list when conversation_id is absent (per channel, or all
//    DM-capable channels of the workspace when channel_id is omitted)
//  - message thread when channel_id + conversation_id are given
// => 200 { conversations | messages | ok:false, error, upgrade? }
//    401 unauthenticated, 400 bad body (mobile-parity hard errors)
//
// DM-capable providers (phase 1): facebook (Page Messenger), instagram
// (business DM), mastodon (direct conversations). Threads/X have no DM API.
//
// Supabase secrets: none beyond the standard injected ones.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

/** Cloudflare in front of the gateway replaces 4xx/5xx bodies with its own
 *  "error code: N" page, so every failure rides a 200 body; consumers read
 *  payload.error. Hard 401s stay 401 (mobile-parity contract). */
function fail(msg: string, upgrade = false): Response {
  return Response.json({ ok: false, error: msg, ...(upgrade ? { upgrade: true } : {}) }, { headers: CORS });
}
function okj(payload: Record<string, unknown>): Response {
  return Response.json({ ok: true, ...payload }, { headers: CORS });
}

const DM_PROVIDERS = new Set(["facebook", "instagram", "mastodon"]);
const GRAPH = "https://graph.facebook.com/v23.0";

interface Conv {
  provider: string;
  channel_id: string;
  id: string;
  title: string;
  unread: number | null;
  previewText: string;
  updated_at: string | null;
  /** The other side's provider id — the send recipient (fb/ig). */
  other_id: string | null;
  /** Mastodon only: the other side's @acct for the send mention. */
  other_acct: string | null;
  /** Mastodon only: latest status id to reply into. */
  last_status_id: string | null;
}
interface Msg {
  provider: string;
  channel_id: string;
  conversation_id: string;
  id: string;
  text: string;
  from_me: boolean;
  from_name: string | null;
  ts: string | null;
}

/** Module-level TTL cache for conversation LISTS only; threads are uncached.
 *  Stateless across requests apart from this in-memory freshness buffer. */
const listCache = new Map<string, { at: number; data: Conv[] }>();
const TTL = 60_000;

function cacheGet(key: string): Conv[] | null {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  if (hit) listCache.delete(key);
  return null;
}
function cachePut(key: string, data: Conv[]): void {
  listCache.set(key, { at: Date.now(), data });
  if (listCache.size > 200) {
    const oldest = [...listCache.entries()].sort((a, z) => a[1].at - z[1].at)[0];
    if (oldest) listCache.delete(oldest[0]);
  }
}

async function jget(url: string, token: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const m = j?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(m.slice(0, 300));
  }
  return j;
}
async function mget(url: string, token: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t.slice(0, 300) || `HTTP ${r.status}`);
  }
  return r.json();
}

/* --------------------------------- facebook / instagram ------------------ */

function metaConvs(
  provider: string,
  channel: ChannelCtx,
  limit: number,
): Promise<Conv[]> {
  return (async () => {
    const root = `${GRAPH}/${encodeURIComponent(channel.external_id)}/conversations`;
    const qs =
      provider === "instagram"
        ? `platform=instagram&fields=id,updated_time,message_count,snippet,participants&limit=${limit}`
        : `platform=messenger&fields=id,updated_time,message_count,snippet,participants,unread_count&limit=${limit}`;
    const j = await jget(`${root}?${qs}`, channel.token);
    return (j?.data ?? []).map((c: any): Conv => {
      const parts: any[] = c?.participants?.data ?? [];
      const other = parts.find((p) => String(p?.id) !== channel.external_id) ?? parts[0] ?? null;
      return {
        provider,
        channel_id: channel.id,
        id: String(c?.id ?? ""),
        title: other?.name ?? other?.username ?? "Conversation",
        unread: typeof c?.unread_count === "number" ? c.unread_count : null,
        previewText: String(c?.snippet ?? "").slice(0, 200),
        updated_at: c?.updated_time ? new Date(c.updated_time).toISOString() : null,
        other_id: other ? String(other.id) : null,
        other_acct: null,
        last_status_id: null,
      };
    });
  })();
}

function metaThread(
  provider: string,
  channel: ChannelCtx,
  conversationId: string,
  limit: number,
  after: string | null,
): Promise<Msg[]> {
  return (async () => {
    const qs = new URLSearchParams({
      fields: "id,from,to,created_time,message",
      limit: String(limit),
    });
    if (after) qs.set("after", after);
    const j = await jget(
      `${GRAPH}/${encodeURIComponent(conversationId)}/messages?${qs.toString()}`,
      channel.token,
    );
    return (j?.data ?? []).map((m: any): Msg => ({
      provider,
      channel_id: channel.id,
      conversation_id: conversationId,
      id: String(m?.id ?? ""),
      text: String(m?.message ?? ""),
      from_me: String(m?.from?.id ?? "") === channel.external_id,
      from_name: m?.from?.name ?? null,
      ts: m?.created_time ? new Date(m.created_time).toISOString() : null,
    }));
  })();
}

/* ---------------------------------- mastodon ----------------------------- */

async function mastodonMe(base: string, token: string): Promise<string> {
  const cacheKey = `me:${base}:${token.slice(-12)}`;
  const hit = listCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return String(hit.data);
  const me = await mget(`${base}/api/v1/accounts/verify_credentials`, token);
  const acct = String(me?.acct ?? "");
  listCache.set(cacheKey, { at: Date.now(), data: acct });
  return acct;
}

async function mastodonConvs(channel: ChannelCtx, limit: number): Promise<Conv[]> {
  const base = channel.instance_url;
  if (!base) throw new Error("Mastodon channel missing its instance URL, reconnect it.");
  const j = await mget(`${base}/api/v1/conversations?limit=${limit}`, channel.token);
  const me = await mastodonMe(base, channel.token);
  const domain = base.replace(/^https?:\/\//, "").split("/")[0];
  return (j ?? []).map((c: any): Conv => {
    const last = c?.last_status ?? null;
    const other = (c?.accounts ?? [])[0] ?? null;
    const acct = String(other?.acct ?? "");
    const full = acct.includes("@") ? acct : acct && domain ? `${acct}@${domain}` : acct;
    return {
      provider: "mastodon",
      channel_id: channel.id,
      id: String(c?.id ?? ""),
      title: other?.display_name || acct || "Conversation",
      unread: c?.unread ? 1 : 0,
      previewText: String(last?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
      updated_at: last?.created_at ?? null,
      other_id: null,
      other_acct: full,
      last_status_id: last?.id ? String(last.id) : null,
    };
  });
}

/** Mastodon has no conversation-thread endpoint; rebuild the thread from the
 *  direct timeline restricted to the conversation's counterpart. */
async function mastodonThread(
  channel: ChannelCtx,
  conversation: Conv,
  limit: number,
): Promise<Msg[]> {
  const base = channel.instance_url;
  if (!base) throw new Error("Mastodon channel missing its instance URL, reconnect it.");
  const me = await mastodonMe(base, channel.token);
  const domain = base.replace(/^https?:\/\//, "").split("/")[0];
  const mine = me.includes("@") ? me : `${me}@${domain}`;
  const convAcct = (conversation.other_acct ?? "").toLowerCase();
  if (!convAcct) return [];
  const j = await mget(`${base}/api/v1/timelines/direct?limit=40`, channel.token);
  const otherOf = (s: any): string => {
    const a = String(s?.account?.acct ?? "");
    return (a.includes("@") ? a : `${a}@${domain}`).toLowerCase();
  };
  return (j ?? [])
    .filter((s: any) => otherOf(s) === convAcct)
    .slice(0, limit)
    .reverse()
    .map((s: any): Msg => ({
      provider: "mastodon",
      channel_id: channel.id,
      conversation_id: conversation.id,
      id: String(s?.id ?? ""),
      text: String(s?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      from_me: otherOf(s) === mine,
      from_name: s?.account?.display_name || s?.account?.acct || null,
      ts: s?.created_at ?? null,
    }));
}

/* ----------------------------------- glue -------------------------------- */

interface ChannelCtx {
  id: string;
  provider: string;
  external_id: string;
  instance_url: string | null;
  token: string;
  display_name: string | null;
}

const LIMIT_MAX = 30;
function clampLimit(v: unknown): number {
  const n = typeof v === "number" ? Math.floor(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, LIMIT_MAX) : 15;
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
  if (!mem || mem.length === 0) return Response.json({ error: "Not a member of this workspace." }, { status: 403, headers: CORS });

  // Paid-only feature; resolved by the canonical DB function.
  const { data: planRow } = await admin.rpc("workspace_plan", { p_workspace_id: workspace_id });
  const plan = typeof planRow === "string" && planRow ? planRow : "free";
  if (plan === "free") return fail("Direct messages are available on paid plans. Upgrade to unlock the Messages inbox.", true);

  // Channels to read: one explicit channel or every connected DM-capable one.
  const chanId = typeof body["channel_id"] === "string" && body["channel_id"] ? body["channel_id"] : null;
  let chq = admin
    .from("connected_channels")
    .select("id,provider,external_id,instance_url,display_name,channel_tokens(access_token_secret_id)")
    .eq("workspace_id", workspace_id)
    .eq("status", "connected")
    .in("provider", [...DM_PROVIDERS]);
  if (chanId) chq = chq.eq("id", chanId);
  const { data: chans, error: chErr } = await chq.limit(50);
  if (chErr) return fail("Could not load channels.");
  const rows = (chans ?? []) as Array<Record<string, any>>;

  // Vault tokens in one round trip per channel.
  const ctxs: ChannelCtx[] = [];
  for (const c of rows) {
    const sid = c?.channel_tokens?.[0]?.access_token_secret_id ?? c?.channel_tokens?.access_token_secret_id ?? null;
    if (!sid) continue;
    const { data: tok } = await admin.rpc("vault_read_secret", { secret_id: sid });
    if (!tok) continue;
    ctxs.push({
      id: String(c.id),
      provider: String(c.provider),
      external_id: String(c.external_id ?? ""),
      instance_url: (c.instance_url as string | null) ?? null,
      token: String(tok),
      display_name: (c.display_name as string | null) ?? null,
    });
  }

  const convId = typeof body["conversation_id"] === "string" ? body["conversation_id"] : "";
  const limit = clampLimit(body["limit"]);
  const after = typeof body["after"] === "string" && body["after"] ? body["after"] : null;

  // Thread read.
  if (convId) {
    const ctx = ctxs.find((x) => x.id === (chanId ?? ""));
    if (!ctx) return fail("Channel not found or not a DM-capable provider.");
    try {
      let msgs: Msg[];
      if (ctx.provider === "mastodon") {
        const conv: Conv = {
          provider: "mastodon",
          channel_id: ctx.id,
          id: convId,
          title: "",
          unread: null,
          previewText: "",
          updated_at: null,
          other_id: null,
          other_acct: typeof body["other_acct"] === "string" ? body["other_acct"] : null,
          last_status_id: null,
        };
        msgs = await mastodonThread(ctx, conv, limit);
      } else {
        msgs = await metaThread(ctx.provider, ctx, convId, limit, after);
      }
      return okj({ messages: msgs });
    } catch (e) {
      return fail(`Could not load the conversation: ${(e as Error).message}`);
    }
  }

  // Conversation lists (cached per channel; body.fresh=true bypasses the
  // 60s buffer for the UI's refresh button).
  const fresh = body["fresh"] === true;
  const conversations: Conv[] = [];
  const chanErrors: string[] = [];
  await Promise.all(
    ctxs.map(async (ctx) => {
      const key = `${ctx.id}:${limit}`;
      try {
        const cached = fresh ? null : cacheGet(key);
        const list =
          cached ??
          (ctx.provider === "mastodon" ? await mastodonConvs(ctx, limit) : await metaConvs(ctx.provider, ctx, limit));
        if (!cached) cachePut(key, list);
        conversations.push(...list);
      } catch (e) {
        chanErrors.push(`${ctx.display_name ?? ctx.provider}: ${(e as Error).message}`);
      }
    }),
  );
  conversations.sort((a, z) => (z.updated_at ?? "").localeCompare(a.updated_at ?? ""));

  return okj({
    conversations,
    ...(chanErrors.length ? { warnings: chanErrors.slice(0, 5) } : {}),
  });
});
