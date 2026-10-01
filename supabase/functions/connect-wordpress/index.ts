// connect-wordpress · Application Password connect (Phase 1 integration #3)
//
// WordPress has no central OAuth: each site mints its own Application
// Password (Users → Profile, WP 5.6+). This function validates the triple
// (site + username + password) against the site's own REST API, then stores
// through the existing import path (Vault + connected_channels).
//
// POST { workspace_id, site_url, username, app_password }
// → 200 { ok, channel_id, title }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

function siteBase(raw: string): string {
  const base = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("Site URL must start with http(s).");
  return base;
}

async function wp<T>(base: string, auth: string, path: string): Promise<T> {
  const res = await fetch(`${base}/wp-json${path}`, {
    headers: { Authorization: auth },
  });
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) {
    throw new Error(
      typeof json?.message === "string" && json.message ? json.message : `HTTP ${res.status}`,
    );
  }
  return json;
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
  const site_url = body["site_url"];
  const username = body["username"];
  const app_password = body["app_password"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof site_url !== "string" || !site_url.trim()) return bad("Site URL required.");
  if (typeof username !== "string" || !username.trim()) return bad("Username required.");
  if (typeof app_password !== "string" || !app_password.trim()) {
    return bad("Application password required.");
  }

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

  let base: string;
  try {
    base = siteBase(site_url);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Bad site URL.");
  }
  const wpUser = username.trim();
  const auth = `Basic ${btoa(`${wpUser}:${(app_password as string).trim()}`)}`;

  let userId: string;
  try {
    const me = await wp<{ id: number }>(base, auth, "/wp/v2/users/me");
    userId = String(me.id);
  } catch (e) {
    return bad(
      `WordPress rejected those credentials: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Check Users → Profile → Application Passwords (needs WP 5.6+) and that /wp-json/ is reachable.",
    );
  }
  let siteName = base.replace(/^https?:\/\//i, "");
  try {
    const root = await wp<{ name?: string }>(base, auth, "/");
    if (root.name) siteName = root.name;
  } catch {
    /* display-only */
  }

  const host = base.replace(/^https?:\/\//i, "").toLowerCase();
  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workspace_id,
      provider: "wordpress",
      external_id: `${host}::${wpUser}`,
      display_name: siteName,
      handle: wpUser,
      instance_url: base,
      metadata: { username: wpUser },
      access_token: (app_password as string).trim(),
      token_type: "Basic",
      scopes: [],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the WordPress site.", 500);
  }

  return Response.json({ ok: true, channel_id: importJson.channel_id, title: siteName });
});
