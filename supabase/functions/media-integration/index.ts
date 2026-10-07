// media-integration · cloud sync for composer media-source logins
//
// Integrations are USER-scoped: connect on web, and the mobile app (or any
// browser) sees the same connection. Refresh/access tokens live in Vault;
// the table stores only secret ids. Clients keep a local cache but the
// cloud row is the source of truth.
//
// POST { provider, access_token, refresh_token, expires_in }  → upsert
// POST { provider, remove: true }                             → delete
// GET  ?provider=google                                       → status (+tokens)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const PROVIDERS = new Set(["google", "dropbox", "canva", "onedrive"]);

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

async function authed(req: Request, url: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const me = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  }).catch(() => null);
  if (!me?.ok) return null;
  const j: any = await me.json().catch(() => null);
  return j?.user?.id ? (j.user as { id: string }) : null;
}

async function statusFor(userId: string, provider: string, admin: any): Promise<Response> {
  const { data: row } = await admin
    .from("media_integrations")
    .select("access_secret_id,refresh_secret_id,expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!row) return Response.json({ connected: false }, { headers: CORS });
  const { data: secrets } = await admin
    .from("vault.decrypted_secrets" as any)
    .select("id,decrypted_secret")
    .in("id", [row.access_secret_id, row.refresh_secret_id] as any);
  const map = new Map<string, string>(
    ((secrets ?? []) as any[]).map((s: any) => [s.id, s.decrypted_secret]),
  );
  const access = map.get(row.access_secret_id) ?? "";
  const refresh = map.get(row.refresh_secret_id) ?? "";
  if (!access || !refresh) return Response.json({ connected: false }, { headers: CORS });
  return Response.json(
    { connected: true, access_token: access, refresh_token: refresh, expires_at: row.expires_at },
    { headers: CORS },
  );
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured.", 500);

  const user = await authed(req, supaUrl, anonKey);
  if (!user) return bad("Sign in first.", 401);
  const admin = createClient(supaUrl, serviceKey);

  if (req.method === "GET") {
    const provider = new URL(req.url).searchParams.get("provider") ?? "";
    if (!PROVIDERS.has(provider)) return bad("Unknown provider.");
    return statusFor(user.id, provider, admin);
  }

  if (req.method !== "POST") return bad("POST only", 405);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const provider = body["provider"];
  if (typeof provider !== "string" || !PROVIDERS.has(provider)) return bad("Unknown provider.");

  // POST { status: true, provider } — same payload as GET, client-friendly.
  if (body["status"] === true) return statusFor(user.id, provider, admin);

  if (body["remove"] === true) {
    const { data: row } = await admin
      .from("media_integrations")
      .select("access_secret_id,refresh_secret_id")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();
    if (row) {
      await admin.from("vault").delete().in("id", [row.access_secret_id, row.refresh_secret_id] as any);
      await admin.from("media_integrations").delete().eq("user_id", user.id).eq("provider", provider);
    }
    return Response.json({ ok: true, removed: true }, { headers: CORS });
  }

  const access = body["access_token"];
  const refresh = body["refresh_token"];
  const expiresIn = Number(body["expires_in"] ?? 14400);
  if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
    return bad("access_token and refresh_token required.");
  }
  const name = `mi:${user.id}:${provider}`;
  const up = async (secret: string, suffix: string) => {
    const { data, error } = await admin
      .from("vault" as any)
      .insert({ secret, name: `${name}:${suffix}` })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Vault write failed: ${error?.message ?? "no id"}`);
    return String((data as { id: string }).id);
  };
  try {
    const accessId = await up(access, "access");
    const refreshId = await up(refresh, "refresh");
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const { error: upErr } = await admin.from("media_integrations").upsert(
      {
        user_id: user.id,
        provider,
        access_secret_id: accessId,
        refresh_secret_id: refreshId,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (upErr) throw new Error(upErr.message);
    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Sync failed.", 500);
  }
});
