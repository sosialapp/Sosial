// unsplash-download · download-tracking event (Unsplash production requirement)
//
// "When a user in your application uses a photo, it triggers an event to the
// download endpoint." Called by both clients when an Unsplash photo is
// attached to a post. The access key stays server-side.
//
// POST { id }
// → 200 { url } (the tracked download URL)
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
  const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? "";
  if (!supaUrl || !anonKey) return bad("Function misconfigured.", 500);
  if (!accessKey) return bad("Unsplash is not configured yet.", 402);

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
  const id = typeof body["id"] === "string" ? body["id"].trim() : "";
  if (!id || !/^[A-Za-z0-9_-]{5,30}$/.test(id)) return bad("Valid photo id required.");

  try {
    const r = await fetch(`https://api.unsplash.com/photos/${encodeURIComponent(id)}/download`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.url) throw new Error(`Unsplash refused the tracking event (HTTP ${r.status}).`);
    return Response.json({ url: String(j.url) }, { headers: CORS });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Tracking failed.", 502);
  }
});
