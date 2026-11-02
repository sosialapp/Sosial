// x-token · live X access token for the app, from the cloud copy
//
// Why this exists: X refresh tokens are single-use. Once an X account is in
// the cloud, the phone and the worker each held a copy of the same refresh
// token, and whichever refreshed second was signed out (posting to X worked
// only some of the time). The phone now asks here instead of refreshing its
// own copy: the server is the only one that ever refreshes, under the same
// channel_tokens lease the worker uses (p121).
//
// POST { workspace_id, external_id }
// → 200 { access_token, expires_at }
// 401 unauthenticated · 403 not allowed · 404 { not_in_cloud: true } ·
// 409 the cloud session is dead (reconnect X)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const X_TOKEN_ENDPOINT = "https://api.x.com/2/oauth2/token";

function bad(msg: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error: msg, ...extra }, { status });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return bad("POST only", 405);

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
  const external_id = body["external_id"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof external_id !== "string" || !external_id) return bad("external_id required.");

  const admin = createClient(supaUrl, serviceKey);

  const { data: ch } = await admin
    .from("connected_channels")
    .select("id, status, connected_by, metadata")
    .eq("workspace_id", workspace_id)
    .eq("provider", "x")
    .eq("external_id", external_id)
    .maybeSingle();
  const row = ch as
    | { id: string; status: string; connected_by: string | null; metadata: Record<string, unknown> | null }
    | null;
  if (!row || row.status === "revoked") return bad("This X account is not in the cloud.", 404, { not_in_cloud: true });

  // A raw token is a credential: owners, admins and whoever connected the
  // account only (the service client bypasses RLS, this is the whole check).
  const { data: mem } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const role = (mem as { role?: string } | null)?.role;
  if (!mem || (role !== "owner" && role !== "admin" && row.connected_by !== user.id)) {
    return bad("Only owners, admins and the person who connected this account can use it here.", 403);
  }

  const readSecret = async (id: string | null | undefined): Promise<string> => {
    if (!id) return "";
    const { data } = await admin.rpc("vault_read_secret", { secret_id: id });
    return typeof data === "string" ? data : "";
  };
  const state = async () => {
    const { data } = await admin
      .from("channel_tokens")
      .select("access_token_secret_id, refresh_token_secret_id, expires_at")
      .eq("channel_id", row.id)
      .maybeSingle();
    return data as
      | { access_token_secret_id: string | null; refresh_token_secret_id: string | null; expires_at: string | null }
      | null;
  };
  const liveFor = (s: { expires_at: string | null } | null, ms: number) =>
    !!s?.expires_at && Date.parse(s.expires_at) > Date.now() + ms;

  let s = await state();
  if (!s?.access_token_secret_id) return bad("This X account is not in the cloud.", 404, { not_in_cloud: true });
  if (liveFor(s, 5 * 60_000)) {
    const access = await readSecret(s.access_token_secret_id);
    if (access) return Response.json({ access_token: access, expires_at: s.expires_at });
  }

  // Refresh under the shared lease; if the worker holds it, wait for its
  // result instead of spending the same refresh token twice.
  const claim = async () => {
    const { data, error } = await admin.rpc("claim_token_refresh", { p_channel_id: row.id, p_seconds: 30 });
    return error ? true : data === true;
  };
  let held = await claim();
  for (let i = 0; !held && i < 30; i++) {
    await sleep(500);
    held = await claim();
  }
  try {
    s = await state();
    if (s && liveFor(s, 5 * 60_000)) {
      const access = await readSecret(s.access_token_secret_id);
      if (access) return Response.json({ access_token: access, expires_at: s.expires_at });
    }
    const refresh = await readSecret(s?.refresh_token_secret_id);
    const clientId = String(row.metadata?.xClientId ?? "");
    if (!s || !refresh || !clientId) return bad("X session expired, reconnect X.", 409);
    const r = await fetch(X_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, grant_type: "refresh_token", refresh_token: refresh }).toString(),
    });
    const j: Record<string, unknown> = await r.json().catch(() => ({}));
    if (typeof j.access_token !== "string" || !j.access_token) return bad("X session expired, reconnect X.", 409);
    const access = j.access_token;
    const expires_at = new Date(Date.now() + Number(j.expires_in ?? 7200) * 1000).toISOString();
    // Refresh token first: it is the one that can't be minted again.
    await admin.rpc("vault_update_secret", {
      secret_id: s.refresh_token_secret_id,
      secret: typeof j.refresh_token === "string" && j.refresh_token ? j.refresh_token : refresh,
    });
    await admin.rpc("vault_update_secret", { secret_id: s.access_token_secret_id, secret: access });
    await admin
      .from("channel_tokens")
      .update({ expires_at, updated_at: new Date().toISOString() })
      .eq("channel_id", row.id);
    return Response.json({ access_token: access, expires_at });
  } finally {
    if (held) await admin.rpc("release_token_refresh", { p_channel_id: row.id });
  }
});
