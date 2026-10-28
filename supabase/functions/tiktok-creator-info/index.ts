// tiktok-creator-info — live creator info for the web composer.
//
// Why this exists: TikTok's Content Sharing Guidelines require the page that
// publishes to show the creator's nickname/avatar and the privacy levels,
// interaction capabilities and max video length TikTok reports *at render
// time*. On the web the channel token lives in Vault (service_role only), so
// the browser can never call open.tiktokapis.com itself. This function brokers
// that single read, authorized by the caller's own JWT and workspace
// membership. Mobile keeps its on-device fetch (src/utils/tiktokAuth.ts).
//
// POST { workspace_id, channel_ids?: string[], channel_id?: string }
//   → { creators: [{ channel_id, nickname, avatar_url, privacy_level_options,
//                    comment_disabled, duet_disabled, stitch_disabled,
//                    max_video_post_duration_sec, can_post, error? }] }
// 401 unauthenticated → 403 not a member → 404 no TikTok channel

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const TT_API = "https://open.tiktokapis.com";
const TT_TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

interface ChRow {
  id: string;
  external_id: string;
  workspace_id: string;
  metadata: Record<string, unknown> | null;
}

interface CreatorInfo {
  channel_id: string;
  nickname: string;
  avatar_url: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
  /** False when TikTok says this creator cannot post right now (daily cap,
   *  posting ban, app quota). The composer must stop the publish. */
  can_post: boolean;
  error?: string;
}

/** creator_info error codes that mean "cannot post now", not "token broken". */
const CANNOT_POST: Record<string, string> = {
  spam_risk_too_many_posts: "This TikTok account reached its daily post limit, try again later.",
  spam_risk_user_banned_from_posting: "TikTok is not letting this account post right now, try again later.",
  reached_active_user_cap: "TikTok's daily posting quota for this app is reached, try again later.",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) {
    return bad("Function misconfigured, missing Supabase env.", 500);
  }

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

  const admin = createClient(supaUrl, serviceKey);

  // Any active member may read creator info (it renders the composer they can
  // use); the service client bypasses RLS, so this check is the authorization.
  const { data: mem } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) return bad("You are not a member of this workspace.", 403);

  const wanted = Array.isArray(body["channel_ids"])
    ? (body["channel_ids"] as unknown[]).filter((x): x is string => typeof x === "string" && !!x)
    : typeof body["channel_id"] === "string" && body["channel_id"]
      ? [body["channel_id"] as string]
      : [];

  let q = admin
    .from("connected_channels")
    .select("id, external_id, workspace_id, metadata")
    .eq("workspace_id", workspace_id)
    .eq("provider", "tiktok");
  if (wanted.length) q = q.in("id", wanted);
  const { data: rows, error: chErr } = await q;
  if (chErr) return bad("Could not read the channels.", 500);
  const channels = (rows ?? []) as unknown as ChRow[];
  if (!channels.length) return bad("Connect TikTok first.", 404);

  const key = Deno.env.get("TT_CLIENT_KEY") ?? "";
  const secret = Deno.env.get("TT_CLIENT_SECRET") ?? "";

  const readSecret = async (id: string | null | undefined): Promise<string> => {
    if (!id) return "";
    const { data } = await admin.rpc("vault_read_secret", { secret_id: id });
    return typeof data === "string" ? data : "";
  };

  /** Rotate the token pair in place (mirrors the worker/mobile posture). */
  const refresh = async (
    row: ChRow,
    tk: { access_token_secret_id: string; refresh_token_secret_id: string | null },
    current: string,
  ): Promise<string> => {
    if (!key || !secret || !tk.refresh_token_secret_id) return current;
    const rt = await readSecret(tk.refresh_token_secret_id);
    if (!rt) return current;
    const r = await fetch(TT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: key,
        client_secret: secret,
        grant_type: "refresh_token",
        refresh_token: rt,
      }).toString(),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.access_token) return current;
    const tag = `ch/${row.workspace_id}/tiktok/${row.external_id}`;
    const store = async (val: string, suffix: string): Promise<string | null> => {
      const { data, error } = await admin.rpc("vault_create_secret", {
        secret: val,
        secret_name: `${tag}/${suffix}`,
        secret_description: "channel access token (Sosial cloud publishing)",
      });
      return error || !data ? null : String(data);
    };
    await admin.rpc("vault_delete_secret", { secret_id: tk.access_token_secret_id });
    const newAccess = await store(String(j.access_token), "access");
    if (!newAccess) return current;
    let newRefresh: string | null = null;
    if (typeof j.refresh_token === "string" && j.refresh_token) {
      await admin.rpc("vault_delete_secret", { secret_id: tk.refresh_token_secret_id });
      newRefresh = await store(j.refresh_token, "refresh");
    }
    const expiresAt = new Date(Date.now() + (Number(j.expires_in) || 86400) * 1000).toISOString();
    await admin
      .from("channel_tokens")
      .update({
        access_token_secret_id: newAccess,
        ...(newRefresh ? { refresh_token_secret_id: newRefresh } : {}),
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("channel_id", row.id);
    return String(j.access_token);
  };

  /** Creator info, or the TikTok error code when it refuses (null = no answer). */
  const query = async (token: string): Promise<CreatorInfo | { code: string } | null> => {
    const r = await fetch(`${TT_API}/v2/post/publish/creator_info/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: "{}",
    });
    const j: any = await r.json().catch(() => ({}));
    const code = String(j?.error?.code ?? "");
    if (code && CANNOT_POST[code]) return { code };
    if (!r.ok || code !== "ok" || !j?.data) return null;
    const d = j.data;
    return {
      channel_id: "",
      nickname: String(d.creator_nickname ?? ""),
      avatar_url: String(d.creator_avatar_url ?? ""),
      privacy_level_options: Array.isArray(d.privacy_level_options)
        ? (d.privacy_level_options as unknown[]).map(String)
        : [],
      comment_disabled: d.comment_disabled === true,
      duet_disabled: d.duet_disabled === true,
      stitch_disabled: d.stitch_disabled === true,
      max_video_post_duration_sec: Number(d.max_video_post_duration_sec ?? 0) || 0,
      can_post: true,
    };
  };

  const out: CreatorInfo[] = [];
  for (const row of channels) {
    const blank: CreatorInfo = {
      channel_id: row.id,
      nickname: "",
      avatar_url: "",
      privacy_level_options: [],
      comment_disabled: false,
      duet_disabled: false,
      stitch_disabled: false,
      max_video_post_duration_sec: 0,
      can_post: true,
    };
    const { data: tok } = await admin
      .from("channel_tokens")
      .select("access_token_secret_id, refresh_token_secret_id, expires_at")
      .eq("channel_id", row.id)
      .maybeSingle();
    const tk = tok as
      | { access_token_secret_id?: string; refresh_token_secret_id?: string | null; expires_at?: string | null }
      | null;
    if (!tk?.access_token_secret_id) {
      out.push({ ...blank, error: "TikTok is not fully connected, reconnect it." });
      continue;
    }

    let access = await readSecret(tk.access_token_secret_id);
    if (!access) {
      out.push({ ...blank, error: "TikTok is not fully connected, reconnect it." });
      continue;
    }
    const expired = tk.expires_at ? new Date(tk.expires_at).getTime() <= Date.now() + 60_000 : false;
    if (expired) {
      access = await refresh(
        row,
        { access_token_secret_id: tk.access_token_secret_id, refresh_token_secret_id: tk.refresh_token_secret_id ?? null },
        access,
      );
    }

    let res = await query(access);
    if (!res) {
      const rotated = await refresh(
        row,
        { access_token_secret_id: tk.access_token_secret_id, refresh_token_secret_id: tk.refresh_token_secret_id ?? null },
        access,
      );
      if (rotated !== access) res = await query(rotated);
    }
    if (res && "code" in res) {
      out.push({ ...blank, can_post: false, error: CANNOT_POST[res.code] });
      continue;
    }
    const info = res;
    if (!info) {
      out.push({ ...blank, error: "TikTok did not return creator info, reconnect TikTok." });
      continue;
    }
    info.channel_id = row.id;

    // Keep the stored menu fresh: the mobile composer and any later web render
    // fall back to it when TikTok is unreachable.
    const md = (row.metadata ?? {}) as Record<string, unknown>;
    if (info.privacy_level_options.length) {
      await admin
        .from("connected_channels")
        .update({
          metadata: {
            ...md,
            ttPrivacyOptions: info.privacy_level_options,
            ...(info.avatar_url ? { avatar: info.avatar_url } : {}),
          } as never,
        })
        .eq("id", row.id);
    }
    out.push(info);
  }

  return Response.json({ creators: out }, { headers: CORS });
});