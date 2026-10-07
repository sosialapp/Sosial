// sheets-auth · Google Sheets import connection (connect + refresh)
//
// Uses the SAME confidential Google client as YouTube (YT_CLIENT_ID/SECRET
// in edge secrets) with an incremental scope: spreadsheets.readonly. The
// user's Google account is shared across Sosial features per account — a
// second consent adds the Sheets scope without touching YouTube grants.
//
// POST { workspace_id, code, redirect_uri }  → exchange, Vault store, upsert
// POST { workspace_id, refresh: true }       → mint access token from Vault
//                                              refresh token (route helper)
// Vault: access + refresh secrets; sheets_connections holds only ids.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, clear: () => clearTimeout(t) };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const clientId = Deno.env.get("YT_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("YT_CLIENT_SECRET") ?? "";
  if (!supaUrl || !anonKey || !serviceKey || !clientId || !clientSecret) {
    return bad("Google is not configured on the backend.", 500);
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
  const workspaceId = typeof body["workspace_id"] === "string" ? body["workspace_id"] : "";
  const code = typeof body["code"] === "string" ? body["code"] : "";
  const redirectUri = typeof body["redirect_uri"] === "string" ? body["redirect_uri"] : "";
  if (!workspaceId) return bad("workspace_id required.");

  const admin = createClient(supaUrl, serviceKey);

  const { data: mem } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) return bad("Not a member of this workspace.", 403);

  if (!code) return bad("code required.");
  if (!redirectUri) return bad("redirect_uri required.");

  const t = withTimeout(15000);
  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: t.signal,
    });
  } catch {
    t.clear();
    return bad("Could not reach Google — try again.", 504);
  }
  t.clear();
  const tok: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tok?.access_token || !tok?.refresh_token) {
    const detail = String(tok?.error_description ?? tok?.error ?? `HTTP ${tokenRes.status}`);
    return bad(`Google refused the connection (${detail.slice(0, 140)}). Reconnect and try again.`, 502);
  }

  const access = String(tok.access_token);
  const refresh = String(tok.refresh_token);
  const expiresAt = new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString();

  const upSecret = async (secret: string, suffix: string): Promise<string | null> => {
    const { data, error } = await admin
      .from("vault")
      .insert({ secret, name: `sheets:${workspaceId}:${suffix}` })
      .select("id")
      .single();
    if (error || !data) return null;
    return String((data as { id: string }).id);
  };

  const accessId = await upSecret(access, "access");
  const refreshId = await upSecret(refresh, "refresh");
  if (!accessId || !refreshId) return bad("Could not store the Google tokens.", 500);

  // Replace any prior connection (and its secrets).
  const { data: prev } = await admin
    .from("sheets_connections")
    .select("id, access_secret_id, refresh_secret_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (prev) {
    const p = prev as { id: string; access_secret_id: string; refresh_secret_id: string };
    await admin.rpc("vault_delete_secret", { secret_id: p.access_secret_id });
    await admin.rpc("vault_delete_secret", { secret_id: p.refresh_secret_id });
    await admin
      .from("sheets_connections")
      .update({
        access_secret_id: accessId,
        refresh_secret_id: refreshId,
        expires_at: expiresAt,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    return Response.json({ ok: true, reconnected: true }, { headers: CORS });
  }

  const { error: insErr } = await admin.from("sheets_connections").insert({
    workspace_id: workspaceId,
    created_by: user.id,
    access_secret_id: accessId,
    refresh_secret_id: refreshId,
    expires_at: expiresAt,
  });
  if (insErr) {
    await admin.rpc("vault_delete_secret", { secret_id: accessId });
    await admin.rpc("vault_delete_secret", { secret_id: refreshId });
    return bad("Could not save the connection.", 500);
  }
  return Response.json({ ok: true }, { headers: CORS });
});
