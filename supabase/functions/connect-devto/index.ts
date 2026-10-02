// connect-devto · API key connect (Phase 1 integration #4)
//
// Dev.to has no OAuth: the user mints a key at Settings → Extensions.
// Validated with GET /api/users/me, stored through import-channel-token.
//
// POST { workspace_id, api_key }
// → 200 { ok, channel_id, title }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API = "https://dev.to/api";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured — missing Supabase env.", 500);

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
  const api_key = body["api_key"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof api_key !== "string" || !api_key.trim()) return bad("API key required.");
  const key = api_key.trim();

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const { data: member } = await admin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (member as { role?: string; status?: string } | null)?.role;
  if (!member || member.status !== "active" || (role !== "owner" && role !== "admin")) {
    return bad("Only workspace owners and admins can connect channels.", 403);
  }

  let me: { id: number; username?: string; name?: string; profile_image?: string; profile_image_90?: string };
  try {
    const res = await fetch(`${API}/users/me`, { headers: { "api-key": key } });
    const json = (await res.json().catch(() => null)) as typeof me & { error?: string };
    if (!res.ok || !json || !json.id) {
      throw new Error(
        typeof json?.error === "string" && json.error ? json.error : `HTTP ${res.status}`,
      );
    }
    me = json;
  } catch (e) {
    return bad(
      `Dev.to rejected that API key: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Mint one at dev.to → Settings → Extensions.",
    );
  }

  const avatar =
    typeof me.profile_image_90 === "string" && me.profile_image_90
      ? me.profile_image_90
      : typeof me.profile_image === "string" && me.profile_image
        ? me.profile_image
        : undefined;

  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workspace_id,
      provider: "devto",
      external_id: String(me.id),
      display_name: me.name || me.username || "Dev.to",
      handle: me.username ? `@${me.username}` : null,
      metadata: { username: me.username ?? "", ...(avatar ? { avatar } : {}) },
      access_token: key,
      token_type: "ApiKey",
      scopes: [],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the Dev.to account.", 500);
  }

  return Response.json({
    ok: true,
    channel_id: importJson.channel_id,
    title: me.name || me.username || "Dev.to",
  });
});
