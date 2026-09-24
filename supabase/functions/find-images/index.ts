// find-images · real topical photos for the AI picture picker
//
// POST { topic } → 200 { images: [{ title, thumb, url, width, height }], source }
//   · 401 unauthenticated · 502 nothing found
//
// Google Images (Cognify/RapidAPI) first when RAPIDAPI_KEY is set, then
// Openverse (many collections), then Wikimedia Commons. All but the Google
// tier are keyless. Secrets: RAPIDAPI_KEY (optional).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

const HASH_STOP = new Set([
  "the", "and", "for", "with", "that", "this", "your", "you", "about", "from",
  "into", "when", "what", "how", "why", "are", "was", "were", "will", "can",
  "not", "but", "our", "their", "them", "have", "has", "had", "been", "just",
  "like", "more", "most", "some", "one", "out", "get", "got",
]);

/** Meaningful latin-script words, in order of appearance. */
function keywords(topic: string, n: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of topic
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((x) => x.trim())
    .filter((x) => x.length >= 4 && !HASH_STOP.has(x))) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

interface FoundImage {
  title: string;
  thumb: string;
  url: string;
  width: number;
  height: number;
}

function cleanTitle(t: string): string {
  return t.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " ").trim() || "Photo";
}

/**
 * Google Images via Cognify (RapidAPI). Needs RAPIDAPI_KEY — without it this
 * tier is skipped silently and the keyless sources serve instead.
 */
async function searchGoogle(query: string, rapidKey: string): Promise<FoundImage[]> {
  const params = new URLSearchParams({ query, count: "8", imageInfo: "true" });
  const r = await fetch(`https://google-images4.p.rapidapi.com/getGoogleImages?${params.toString()}`, {
    headers: {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": "google-images4.p.rapidapi.com",
    },
  });
  if (!r.ok) return [];
  const j = (await r.json().catch(() => ({}))) as {
    images?: { url?: string; width?: number; height?: number; mime?: string; type?: string }[];
  };
  const out: FoundImage[] = [];
  for (const it of j.images ?? []) {
    const url = typeof it.url === "string" ? it.url : "";
    if (!/^https?:\/\//i.test(url)) continue;
    const mime = String(it.mime ?? "");
    if (/svg|tiff?/i.test(mime) || /\.(svg|tiff?)(\?|#|$)/i.test(url)) continue;
    const width = Number(it.width) || 0;
    const height = Number(it.height) || 0;
    if (width < 400) continue;
    out.push({
      title: cleanTitle(url.split("/").pop()?.split("?")[0] ?? ""),
      thumb: url,
      url,
      width,
      height,
    });
    if (out.length >= 8) break;
  }
  return out;
}

/** Openverse: many collections at once, hotlinkable direct URLs. */
async function searchOpenverse(query: string): Promise<FoundImage[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: "20",
    filter_dead: "false",
  });
  const r = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
    headers: {
      "User-Agent": "SosialApp/1.0 (picture picker)",
      Accept: "application/json",
    },
  });
  if (!r.ok) return [];
  const j = (await r.json().catch(() => ({}))) as {
    results?: {
      title?: string;
      url?: string;
      thumbnail?: string;
      width?: number;
      height?: number;
    }[];
  };
  const out: FoundImage[] = [];
  for (const it of j.results ?? []) {
    const url = typeof it.url === "string" ? it.url : "";
    if (!/^https?:\/\//i.test(url)) continue;
    if (/\.(svg|tiff?)(\?|#|$)/i.test(url)) continue;
    const width = Number(it.width) || 0;
    const height = Number(it.height) || 0;
    if (width < 400) continue;
    out.push({
      title: cleanTitle(String(it.title ?? "")),
      thumb: typeof it.thumbnail === "string" && it.thumbnail ? it.thumbnail : url,
      url,
      width,
      height,
    });
    if (out.length >= 8) break;
  }
  return out;
}

/** Wikimedia Commons: maps, people, places and news topics. */
async function searchCommons(query: string): Promise<FoundImage[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime",
    iiurlwidth: "640",
  });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: { "User-Agent": "SosialApp/1.0 (picture picker)" },
  });
  if (!r.ok) return [];
  const j = (await r.json().catch(() => ({}))) as {
    query?: { pages?: Record<string, {
      title?: string;
      imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number; mime?: string }[];
    }> };
  };
  const pages = j.query?.pages ?? {};
  const out: FoundImage[] = [];
  for (const key of Object.keys(pages)) {
    const p = pages[key];
    const info = p.imageinfo?.[0];
    if (!info?.url) continue;
    const mime = info.mime ?? "";
    if (!mime.startsWith("image/") || mime === "image/svg+xml" || mime === "image/tiff") continue;
    const width = Number(info.width) || 0;
    const height = Number(info.height) || 0;
    if (width < 400) continue;
    out.push({
      title: cleanTitle(String(p.title ?? "")),
      thumb: String(info.thumburl ?? info.url),
      url: String(info.url),
      width,
      height,
    });
    if (out.length >= 8) break;
  }
  return out;
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
  const topic = typeof body["topic"] === "string" ? body["topic"].trim() : "";
  if (!topic) return bad("topic is required.");
  if (topic.length > 500) return bad("topic ≤ 500 chars.");

  const kws = keywords(topic, 3);
  const attempts: string[] = [];
  if (kws.length >= 2) attempts.push(kws.join(" "));
  if (kws.length >= 1) attempts.push(kws[0]);
  const raw = topic.split(/\s+/).slice(0, 6).join(" ");
  if (raw && !attempts.includes(raw)) attempts.push(raw);

  const rapidKey = Deno.env.get("RAPIDAPI_KEY") ?? "";

  for (const q of attempts) {
    if (rapidKey) {
      try {
        const images = await searchGoogle(q, rapidKey);
        if (images.length) {
          return Response.json({ images, source: "google", keywords: kws }, { headers: CORS });
        }
      } catch {
        /* fall through to the keyless sources */
      }
    }
    try {
      const images = await searchOpenverse(q);
      if (images.length) {
        return Response.json({ images, source: "openverse", keywords: kws }, { headers: CORS });
      }
    } catch {
      /* fall through to the next source */
    }
    try {
      const images = await searchCommons(q);
      if (images.length) {
        return Response.json({ images, source: "commons", keywords: kws }, { headers: CORS });
      }
    } catch {
      /* try the next, narrower query */
    }
  }
  return bad("No photos found for that topic — try different words.", 502);
});
