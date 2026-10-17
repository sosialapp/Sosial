// pin-boards · server-side Pinterest board picker for the web app
//
// Why this exists: publishing a Pin needs a board id, but on the web the
// channel's access token lives in Vault (service_role only), so the browser
// can never reach api.pinterest.com itself. This function brokers the two
// board operations the picker needs, authorized by the caller's own JWT and
// workspace role exactly like import-channel-token. Mobile keeps its
// on-device picker (src/utils/pinPublish.ts listPinBoards).
//
// POST { workspace_id, action, channel_id?, board_id?, board_name? }
//   action 'list' → { boards:[{id,name}], board_id, board_name, channel_id }
//   action 'set'  → { ok:true, board_id, board_name, channel_id }
// 401 unauthenticated · 403 not owner/admin · 404 no channel · 409 reconnect

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const PIN_API = "https://api.pinterest.com/v5";
const PIN_TOKEN_ENDPOINT = "https://api.pinterest.com/v5/oauth/token";
const PIN_SCOPES = "boards:read,boards:write,pins:read,pins:write,user_accounts:read";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

interface ChRow {
  id: string;
  external_id: string;
  workspace_id: string;
  metadata: Record<string, unknown> | null;
}

interface Board {
  id: string;
  name: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  // Env fallbacks: newer projects inject SB_* instead of SUPABASE_*.
  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) {
    return bad("Function misconfigured, missing Supabase env.", 500);
  }

  // Caller identity from their own JWT (never trust a body user_id).
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
  const action = body["action"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (action !== "list" && action !== "set") return bad("Unknown action.");

  const admin = createClient(supaUrl, serviceKey);

  // Role gate: owners and admins only (service client bypasses RLS, so this
  // check is the entire authorization, never skip it).
  const { data: mem } = await admin
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const role = (mem as { role?: string } | null)?.role;
  if (!mem || (role !== "owner" && role !== "admin")) {
    return bad("Only owners and admins can manage Pinterest boards.", 403);
  }

  // Target channel: an explicit id, else the newest connected Pinterest one.
  const channel_id = body["channel_id"];
  let q = admin
    .from("connected_channels")
    .select("id, external_id, workspace_id, metadata")
    .eq("workspace_id", workspace_id)
    .eq("provider", "pinterest");
  q = typeof channel_id === "string" && channel_id
    ? q.eq("id", channel_id)
    : q.eq("status", "connected");
  const { data: ch, error: chErr } = await q
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (chErr) return bad("Could not read the channel.", 500);
  if (!ch) return bad("Connect Pinterest first.", 404);
  const row = ch as unknown as ChRow;
  const md = (row.metadata ?? {}) as Record<string, unknown>;
  const currentBoardId = typeof md.pinBoardId === "string" ? md.pinBoardId : "";
  const currentBoardName = typeof md.pinBoardName === "string" ? md.pinBoardName : "";

  if (action === "set") {
    const board_id = body["board_id"];
    if (typeof board_id !== "string" || !board_id) return bad("board_id required.");
    const board_name = typeof body["board_name"] === "string" ? body["board_name"] : "";
    const { error: upErr } = await admin
      .from("connected_channels")
      .update({ metadata: { ...md, pinBoardId: board_id, pinBoardName: board_name } as never })
      .eq("id", row.id);
    if (upErr) return bad("Could not save the board.", 500);
    return Response.json({ ok: true, board_id, board_name, channel_id: row.id }, { headers: CORS });
  }

  // action === 'list'
  const { data: tok } = await admin
    .from("channel_tokens")
    .select("access_token_secret_id, refresh_token_secret_id, expires_at")
    .eq("channel_id", row.id)
    .maybeSingle();
  const tk = tok as
    | { access_token_secret_id?: string; refresh_token_secret_id?: string | null; expires_at?: string | null }
    | null;
  if (!tk?.access_token_secret_id) return bad("Pinterest is not fully connected, reconnect it.", 409);

  const readSecret = async (id: string | null | undefined): Promise<string> => {
    if (!id) return "";
    const { data } = await admin.rpc("vault_read_secret", { secret_id: id });
    return typeof data === "string" ? data : "";
  };

  let access = await readSecret(tk.access_token_secret_id);
  if (!access) return bad("Pinterest is not fully connected, reconnect it.", 409);

  // Rotate the token pair in place (mirrors the mobile/worker refresh posture).
  const refresh = async (): Promise<boolean> => {
    const cid = Deno.env.get("PIN_CLIENT_ID") ?? "";
    const secret = Deno.env.get("PIN_CLIENT_SECRET") ?? "";
    if (!cid || !secret || !tk.refresh_token_secret_id) return false;
    const rt = await readSecret(tk.refresh_token_secret_id);
    if (!rt) return false;
    const r = await fetch(PIN_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${cid}:${secret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: rt,
        scope: PIN_SCOPES,
      }).toString(),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.access_token) return false;
    const tag = `ch/${row.workspace_id}/pinterest/${row.external_id}`;
    const store = async (val: string, suffix: string): Promise<string | null> => {
      const { data, error } = await admin.rpc("vault_create_secret", {
        secret: val,
        secret_name: `${tag}/${suffix}`,
        secret_description: "channel access token (Sosial cloud publishing)",
      });
      return error || !data ? null : String(data);
    };
    // Vault enforces unique names, so drop the old access secret first.
    await admin.rpc("vault_delete_secret", { secret_id: tk.access_token_secret_id });
    const newAccess = await store(String(j.access_token), "access");
    if (!newAccess) return false;
    let newRefresh: string | null = null;
    if (typeof j.refresh_token === "string" && j.refresh_token) {
      if (tk.refresh_token_secret_id) {
        await admin.rpc("vault_delete_secret", { secret_id: tk.refresh_token_secret_id });
      }
      newRefresh = await store(j.refresh_token, "refresh");
    }
    const expiresAt = new Date(Date.now() + (Number(j.expires_in) || 2592000) * 1000).toISOString();
    await admin
      .from("channel_tokens")
      .update({
        access_token_secret_id: newAccess,
        ...(newRefresh ? { refresh_token_secret_id: newRefresh } : {}),
        expires_at: expiresAt,
      })
      .eq("channel_id", row.id);
    access = String(j.access_token);
    return true;
  };

  const fetchBoards = async (): Promise<{ boards?: Board[]; status?: number; error?: string }> => {
    const out: Board[] = [];
    let bookmark: string | undefined;
    for (let page = 0; page < 4; page++) {
      const qs = new URLSearchParams({ page_size: "50" });
      if (bookmark) qs.set("bookmark", bookmark);
      const r = await fetch(`${PIN_API}/boards?${qs}`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        return {
          status: r.status,
          error: `Pinterest refused the board list (${String(j?.message ?? `HTTP ${r.status}`)}).`,
        };
      }
      for (const b of (j?.items ?? []) as any[]) {
        if (b?.id) out.push({ id: String(b.id), name: String(b.name ?? "Untitled board") });
      }
      bookmark = typeof j?.bookmark === "string" && j.bookmark ? j.bookmark : undefined;
      if (!bookmark) break;
    }
    return { boards: out };
  };

  const expired = tk.expires_at ? new Date(tk.expires_at).getTime() <= Date.now() + 60_000 : false;
  if (expired) await refresh();

  let res = await fetchBoards();
  if (!res.boards && res.status === 401 && (await refresh())) {
    res = await fetchBoards();
  }
  if (!res.boards) {
    return bad(res.error ?? "Could not read your Pinterest boards.", res.status === 401 ? 409 : 502);
  }

  return Response.json(
    { boards: res.boards, board_id: currentBoardId, board_name: currentBoardName, channel_id: row.id },
    { headers: CORS },
  );
});
