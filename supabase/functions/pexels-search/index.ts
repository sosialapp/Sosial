// pexels-search · stock photo/video search (any signed-in member)
//
// Pexels API key lives in Supabase secrets (PEXELS_API_KEY) — never shipped
// to clients, and the same endpoint serves web (CORS) + mobile uniformly.
// Photos AND videos; attribution appreciated but not required.
//
// POST { query, type?: 'photo'|'video', per_page?, page? }
// → 200 { items: [{ id, kind, thumb, full, width, height, author, authorUrl }] }

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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const apiKey = Deno.env.get("PEXELS_API_KEY") ?? "";
  if (!supaUrl || !anonKey) return bad("Function misconfigured.", 500);
  if (!apiKey) return bad("Stock search is not configured yet.", 402);

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
  const type = body["type"] === "video" ? "video" : "photo";
  const perPage = Math.max(1, Math.min(Number(body["per_page"] ?? 12) || 12, 30));
  const page = Math.max(1, Number(body["page"] ?? 1) || 1);

  const headers = { Authorization: apiKey };
  try {
    if (type === "video") {
      const r = await fetch(
        `https://api.pexels.com/videos/search?${new URLSearchParams({ query, per_page: String(perPage), page: String(page) })}`,
        { headers },
      );
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`Pexels refused the search (HTTP ${r.status}).`);
      const items = ((j?.videos ?? []) as any[]).map((v: any) => {
        const files = (v?.video_files ?? []) as any[];
        const mp4 = files.filter((f: any) => f?.file_type === "video/mp4" && f?.link);
        const best =
          mp4.find((f: any) => f?.width >= 720 && f?.width <= 1920) ??
          mp4.sort((a: any, b: any) => (a?.width ?? 0) - (b?.width ?? 0))[0];
        return {
          id: String(v?.id ?? ""),
          kind: "video",
          thumb: String(v?.image ?? ""),
          full: String(best?.link ?? ""),
          width: Number(best?.width ?? v?.width ?? 0),
          height: Number(best?.height ?? v?.height ?? 0),
          author: String(v?.user?.name ?? "Pexels"),
          authorUrl: String(v?.user?.url ?? "https://www.pexels.com"),
        };
      }).filter((x: any) => x.id && x.full);
      return Response.json({ items }, { headers: CORS });
    }
    const r = await fetch(
      `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(perPage), page: String(page) })}`,
      { headers },
    );
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Pexels refused the search (HTTP ${r.status}).`);
    const items = ((j?.photos ?? []) as any[]).map((p: any) => ({
      id: String(p?.id ?? ""),
      kind: "image",
      thumb: String(p?.src?.medium ?? p?.src?.small ?? ""),
      full: String(p?.src?.large2x ?? p?.src?.large ?? p?.src?.original ?? ""),
      width: Number(p?.width ?? 0),
      height: Number(p?.height ?? 0),
      author: String(p?.photographer ?? "Pexels"),
      authorUrl: String(p?.photographer_url ?? "https://www.pexels.com"),
    })).filter((x: any) => x.id && x.full);
    return Response.json({ items }, { headers: CORS });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Stock search failed.", 502);
  }
});
