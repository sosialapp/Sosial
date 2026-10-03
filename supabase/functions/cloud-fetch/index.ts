// cloud-fetch · byte proxy for media-source downloads (web picker)
//
// Google Photos original URLs live on lh3.googleusercontent.com, which does
// not send CORS headers — the browser cannot fetch them directly. This fn
// streams the bytes through (host-allowlisted, signed-URL only). NOTHING is
// persisted: bytes pass through to the signed-in caller and are forgotten.
//
// POST { url }
// → 200 <bytes> (content-type + filename preserved)
//   · 401 unauthenticated · 403 host not allow-listed
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const ALLOWED = /(^|\.)googleusercontent\.com$/i;

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
  const raw = typeof body["url"] === "string" ? body["url"] : "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return bad("url must be absolute https.");
  }
  if (u.protocol !== "https:" || !ALLOWED.test(u.hostname)) {
    return bad("That host is not fetchable.", 403);
  }

  try {
    const r = await fetch(u.toString(), { redirect: "follow" });
    if (!r.ok || !r.body) throw new Error(`The file host refused (HTTP ${r.status}).`);
    const kind = (r.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
    const headers = new Headers(CORS);
    headers.set("Content-Type", kind);
    return new Response(r.body, { headers });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Fetch failed.", 502);
  }
});
