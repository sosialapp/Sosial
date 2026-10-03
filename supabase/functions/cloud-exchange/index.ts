// cloud-exchange · OAuth code/refresh swap for media sources (web picker)
//
// Dropbox + Google (Drive/Photos read-only) secrets live here server-side.
// NOTHING is persisted: tokens go straight back to the browser, which keeps
// them in sessionStorage (device-only — our DB never sees them). The web
// dialog then calls Drive/Photos/Dropbox REST directly.
//
// POST { provider: 'dropbox'|'google'|'canva', code?, refresh_token?, redirect_uri?, code_verifier? }
// → 200 { access_token, refresh_token?, expires_in }
//   · 401 unauthenticated
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supaUrl || !anonKey) return bad("Function misconfigured.", 500);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  try {
    const me = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!me.ok) return bad("Sign in first.", 401);
  } catch {
    return bad("Sign in first.", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const provider = body["provider"];
  if (provider !== "dropbox" && provider !== "google" && provider !== "canva") {
    return bad("provider must be dropbox|google|canva.");
  }
  const code = typeof body["code"] === "string" ? body["code"] : "";
  const refreshToken = typeof body["refresh_token"] === "string" ? body["refresh_token"] : "";
  if (!code && !refreshToken) return bad("code or refresh_token required.");
  const redirectUri = typeof body["redirect_uri"] === "string" ? body["redirect_uri"] : "";
  const codeVerifier = typeof body["code_verifier"] === "string" ? body["code_verifier"] : "";

  try {
    let tokenUrl: string;
    const params: Record<string, string> = {};
    let basic: string | null = null;
    if (provider === "canva") {
      const id = Deno.env.get("CANVA_CLIENT_ID") ?? "";
      const secret = Deno.env.get("CANVA_CLIENT_SECRET") ?? "";
      if (!id || !secret) return bad("Canva is not configured yet.", 402);
      tokenUrl = "https://api.canva.com/rest/v1/oauth/token";
      basic = btoa(`${id}:${secret}`);
      if (code) {
        if (!codeVerifier) return bad("code_verifier required for Canva.");
        params["grant_type"] = "authorization_code";
        params["code"] = code;
        params["code_verifier"] = codeVerifier;
        if (redirectUri) params["redirect_uri"] = redirectUri;
      } else {
        params["grant_type"] = "refresh_token";
        params["refresh_token"] = refreshToken;
      }
    } else if (provider === "dropbox") {
      const key = Deno.env.get("DROPBOX_APP_KEY") ?? "";
      const secret = Deno.env.get("DROPBOX_APP_SECRET") ?? "";
      if (!key || !secret) return bad("Dropbox is not configured yet.", 402);
      tokenUrl = "https://api.dropboxapi.com/oauth2/token";
      params["client_id"] = key;
      params["client_secret"] = secret;
      if (code) {
        params["code"] = code;
        params["grant_type"] = "authorization_code";
        if (redirectUri) params["redirect_uri"] = redirectUri;
      } else {
        params["refresh_token"] = refreshToken;
        params["grant_type"] = "refresh_token";
      }
    } else {
      const id = Deno.env.get("YT_CLIENT_ID") ?? Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
      const secret = Deno.env.get("YT_CLIENT_SECRET") ?? Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
      if (!id || !secret) return bad("Google is not configured yet.", 402);
      tokenUrl = "https://oauth2.googleapis.com/token";
      params["client_id"] = id;
      params["client_secret"] = secret;
      if (code) {
        params["code"] = code;
        params["grant_type"] = "authorization_code";
        if (redirectUri) params["redirect_uri"] = redirectUri;
      } else {
        params["refresh_token"] = refreshToken;
        params["grant_type"] = "refresh_token";
      }
    }
    const r = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(basic ? { Authorization: `Basic ${basic}` } : {}),
      },
      body: new URLSearchParams(params).toString(),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.access_token) {
      const detail = String(j?.error_description ?? j?.error ?? `HTTP ${r.status}`).slice(0, 140);
      throw new Error(`The provider refused the login (${detail}).`);
    }
    return Response.json(
      {
        access_token: String(j.access_token),
        ...(j?.refresh_token ? { refresh_token: String(j.refresh_token) } : {}),
        expires_in: Number(j?.expires_in ?? 14400),
      },
      { headers: CORS },
    );
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Exchange failed.", 502);
  }
});
