// connect-ghost · Admin API key connect (Phase 1 integration #6, last one)
//
// Ghost has no central OAuth: each site issues its own key under Ghost
// Admin → Integrations. Validated with GET /ghost/api/admin/site/ (proves
// the key and names the publication), stored through import-channel-token.
//
// POST { workspace_id, site_url, admin_key }
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

function b64url(input: string | Uint8Array): string {
  let bin: string;
  if (typeof input === "string") {
    bin = unescape(encodeURIComponent(input));
  } else {
    bin = Array.from(input).map((b) => String.fromCharCode(b)).join("");
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0 || clean.length === 0) {
    throw new Error("Admin API key looks wrong (expected id:secret).");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function ghostJwt(adminKey: string): Promise<string> {
  const sep = adminKey.indexOf(":");
  if (sep < 1) throw new Error("Admin API key looks wrong (expected id:secret).");
  const id = adminKey.slice(0, sep);
  const secret = hexToBytes(adminKey.slice(sep + 1));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const payload = b64url(JSON.stringify({ iat: now, exp: now + 5 * 60, aud: "/admin/" }));
  const key = await crypto.subtle.importKey("raw", secret.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  const sigB64 = b64url(sig).replace(/=+$/, "");
  return `${header}.${payload}.${sigB64}`;
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
  const admin_key = body["admin_key"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof site_url !== "string" || !site_url.trim()) return bad("Site URL required.");
  if (typeof admin_key !== "string" || !admin_key.trim()) return bad("Admin API key required.");
  const key = admin_key.trim();

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

  let token: string;
  try {
    token = await ghostJwt(key);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Bad Admin API key.");
  }
  let siteTitle = base.replace(/^https?:\/\//i, "");
  try {
    const res = await fetch(`${base}/ghost/api/admin/site/`, {
      headers: { Authorization: `Ghost ${token}` },
    });
    const json = (await res.json().catch(() => null)) as { site?: { title?: string }; errors?: { message?: string }[] } | null;
    const err = json?.errors?.[0]?.message;
    if (!res.ok || err) throw new Error(err ?? `HTTP ${res.status}`);
    if (json?.site?.title) siteTitle = json.site.title;
  } catch (e) {
    return bad(
      `Ghost rejected those credentials: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Check Integrations → your key in Ghost Admin, and that /ghost/api/ is reachable.",
    );
  }

  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workspace_id,
      provider: "ghost",
      external_id: base.toLowerCase(),
      display_name: siteTitle,
      handle: null,
      instance_url: base,
      metadata: {},
      access_token: key,
      token_type: "AdminKey",
      scopes: [],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the Ghost site.", 500);
  }

  return Response.json({ ok: true, channel_id: importJson.channel_id, title: siteTitle });
});
