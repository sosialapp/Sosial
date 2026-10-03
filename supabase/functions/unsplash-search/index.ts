// unsplash-search · stock photo search (any signed-in member)
//
// Unsplash Access Key lives in Supabase secrets (UNSPLASH_ACCESS_KEY).
// Photos only (Unsplash has no video API). LICENSE TERMS ARE LOAD-BEARING:
// every photo used MUST credit the photographer + link back — the clients
// auto-append "📷 {author} on Unsplash ({url})" to the caption at attach
// time, non-optional. Only full-size `raw`/`full` URLs are handed out.

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

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? "";
  if (!supaUrl || !anonKey) return bad("Function misconfigured.", 500);
  if (!accessKey) return bad("Stock search is not configured yet.", 402);

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
  const query = typeof body["query"] === "string" ? body["query"].trim() : "";
  if (!query) return bad("query required.");
  const perPage = Math.max(1, Math.min(Number(body["per_page"] ?? 12) || 12, 30));
  const page = Math.max(1, Number(body["page"] ?? 1) || 1);

  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?${new URLSearchParams({
        query,
        per_page: String(perPage),
        page: String(page),
        content_filter: "high",
      })}`,
      { headers: { Authorization: `Client-ID ${accessKey}` } },
    );
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Unsplash refused the search (HTTP ${r.status}).`);
    const items = ((j?.results ?? []) as any[]).map((p: any) => ({
      id: String(p?.id ?? ""),
      kind: "image",
      thumb: String(p?.urls?.small ?? p?.urls?.thumb ?? ""),
      full: String(p?.urls?.full ?? p?.urls?.raw ?? ""),
      width: Number(p?.width ?? 0),
      height: Number(p?.height ?? 0),
      author: String(p?.user?.name ?? "Unsplash"),
      authorUrl: String(p?.user?.links?.html ?? "https://unsplash.com"),
    })).filter((x: any) => x.id && x.full);
    return Response.json({ items }, { headers: CORS });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Stock search failed.", 502);
  }
});
