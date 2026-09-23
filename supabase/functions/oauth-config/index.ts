// oauth-config · public OAuth client ids for the web start route
//
// The browser/server routes need the PUBLIC client ids to build consent
// URLs, but those must not live in Vercel env (one more dashboard to keep in
// sync — the exact failure the web connect shipped with). Single source of
// truth: Supabase secrets, mirrored from the mobile app's credentials.
// Secrets (the private halves) are NEVER returned here.
//
// GET → 200 { tiktok: { client_key }, instagram: { app_id },
//             facebook: { app_id }, x: { client_id }, youtube: { client_id },
//             linkedin: { client_id } } (unconfigured providers are omitted)
//   · 401 unauthenticated

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") {
    return Response.json({ error: "GET only" }, { status: 405, headers: CORS });
  }

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supaUrl || !anonKey) {
    return Response.json({ error: "Function misconfigured." }, { status: 500, headers: CORS });
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return Response.json({ error: "Sign in first." }, { status: 401, headers: CORS });
  }
  try {
    const me = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!me.ok) {
      return Response.json({ error: "Sign in first." }, { status: 401, headers: CORS });
    }
  } catch {
    return Response.json({ error: "Sign in first." }, { status: 401, headers: CORS });
  }

  const get = (k: string): string => Deno.env.get(k) ?? "";
  const out: Record<string, Record<string, string>> = {};
  const put = (provider: string, field: string, value: string) => {
    if (value) out[provider] = { ...(out[provider] ?? {}), [field]: value };
  };
  put("tiktok", "client_key", get("TT_CLIENT_KEY"));
  put("instagram", "app_id", get("IG_APP_ID"));
  put("facebook", "app_id", get("META_APP_ID"));
  put("x", "client_id", get("X_CLIENT_ID"));
  put("youtube", "client_id", get("YT_CLIENT_ID"));
  put("linkedin", "client_id", get("LI_CLIENT_ID"));
  return Response.json(out, { headers: CORS });
});
