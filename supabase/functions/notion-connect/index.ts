// notion-connect · Notion public-integration OAuth exchange + storage
//
// POST { workspace_id, code, redirect_uri }
//   → verifies the caller is an active member of the workspace
//   → exchanges the OAuth code with Notion (Basic client auth)
//   → stores the access token in Vault, metadata in notion_connections
//   (upsert per (workspace, notion workspace) — reconnecting refreshes)
//
// Notion tokens do not expire, so there is no refresh path. Disconnect
// deletes the Vault secret + row (web route, service role).

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
  const clientId = Deno.env.get("NOTION_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("NOTION_CLIENT_SECRET") ?? "";
  if (!supaUrl || !anonKey || !serviceKey || !clientId || !clientSecret) {
    return bad("Notion is not configured on the backend.", 500);
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
  if (!workspaceId || !code || !redirectUri) return bad("workspace_id, code and redirect_uri are required.");

  const admin = createClient(supaUrl, serviceKey);

  // Membership check (read model): the connecting user must be active here.
  const { data: mem } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) return bad("Not a member of this workspace.", 403);

  // OAuth exchange (Basic client auth per Notion's public integration spec).
  const t = withTimeout(15000);
  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: t.signal,
    });
  } catch {
    t.clear();
    return bad("Could not reach Notion — try again.", 504);
  }
  t.clear();
  const tok: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tok?.access_token) {
    const detail = String(tok?.error_description ?? tok?.error ?? `HTTP ${tokenRes.status}`);
    return bad(`Notion refused the connection (${detail.slice(0, 140)}). Reconnect and try again.`, 502);
  }

  const accessToken = String(tok.access_token);
  const notionWsId = String(tok.workspace_id ?? "");
  const notionWsName = String(tok.workspace_name ?? "");
  const botId = tok.bot_id ? String(tok.bot_id) : null;
  if (!notionWsId) return bad("Notion did not identify the workspace. Reconnect.", 502);

  // Vault: store the token, keep only the secret id.
  const { data: sec, error: secErr } = await admin
    .from("vault")
    .insert({ secret: accessToken, name: `notion:${workspaceId}:${notionWsId}` })
    .select("id")
    .single();
  if (secErr || !sec) return bad("Could not store the Notion token.", 500);
  const secretId = String((sec as { id: string }).id);

  // Replace any previous connection to the same Notion workspace.
  const { data: prev } = await admin
    .from("notion_connections")
    .select("id, access_secret_id")
    .eq("workspace_id", workspaceId)
    .eq("notion_workspace_id", notionWsId)
    .maybeSingle();
  if (prev) {
    const p = prev as { id: string; access_secret_id: string };
    await admin.rpc("vault_delete_secret", { secret_id: p.access_secret_id });
    await admin
      .from("notion_connections")
      .update({
        access_secret_id: secretId,
        notion_workspace_name: notionWsName,
        bot_id: botId,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    return Response.json({ ok: true, reconnected: true }, { headers: CORS });
  }

  const { error: insErr } = await admin.from("notion_connections").insert({
    workspace_id: workspaceId,
    created_by: user.id,
    notion_workspace_id: notionWsId,
    notion_workspace_name: notionWsName,
    bot_id: botId,
    access_secret_id: secretId,
  });
  if (insErr) {
    await admin.rpc("vault_delete_secret", { secret_id: secretId });
    return bad("Could not save the connection.", 500);
  }
  return Response.json({ ok: true }, { headers: CORS });
});
