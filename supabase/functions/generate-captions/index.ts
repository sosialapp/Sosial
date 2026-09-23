// generate-captions · AI captions + hashtags for single posts and chains
//
// POST { topic, providers, count?, tone?, language?, style?, instructions?, emoji?, cta? } → 200 { segments: [{ caption, hashtags }] }
//   · 401 unauthenticated · 402 AI not configured · 502 upstream failure
//
// Any signed-in user may call it (composing is a member action); the key
// lives server-side. Set it once: supabase secrets set OPENAI_API_KEY=sk-...
// Caps mirror apps/web PROVIDER_META limits so a caption never exceeds the
// strictest picked channel. The model returns JSON; we clamp server-side on
// a word boundary as a second guard.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok: 2200,
  x: 280,
  facebook: 63206,
  youtube: 5000,
  threads: 500,
  linkedin: 3000,
  bluesky: 300,
  mastodon: 500,
  pinterest: 500,
};

const TONES = ["auto", "story", "punchy", "friendly", "professional", "bold", "funny"] as const;
const EMOJIS = ["auto", "on", "off"] as const;

// Browser preflight must pass before supabase-js can POST at all — without
// these headers fetch throws and the client sees "Failed to send a request
// to the Edge Function" (native apps don't preflight, which is why mobile
// never noticed).
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

function clamp(s: string, limit: number): string {
  const t = s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (t.length <= limit) return t;
  const cut = t.slice(0, Math.max(0, limit - 1));
  const at = cut.lastIndexOf(" ");
  return (at > limit * 0.6 ? cut.slice(0, at) : cut).trimEnd() + "…";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supaUrl || !anonKey) return bad("Function misconfigured.", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  // No supabase-js dependency (keeps the bundle immune to registry
  // hiccups): verify the caller's JWT straight against GoTrue.
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
  const providers = Array.isArray(body["providers"])
    ? (body["providers"] as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const countRaw = typeof body["count"] === "number" ? Math.floor(body["count"]) : 1;
  const toneRaw = typeof body["tone"] === "string" ? body["tone"] : "auto";
  if (!topic) return bad("topic is required.");
  if (topic.length > 500) return bad("topic ≤ 500 chars.");
  if (!providers.length) return bad("providers is required.");
  const count = Math.min(8, Math.max(1, countRaw));
  const tone = (TONES as readonly string[]).includes(toneRaw) ? toneRaw : "auto";
  const language = typeof body["language"] === "string" ? body["language"].trim().slice(0, 40) : "auto";
  const style = typeof body["style"] === "string" ? body["style"].trim().slice(0, 40) : "auto";
  const instructions = typeof body["instructions"] === "string" ? body["instructions"].trim().slice(0, 500) : "";
  const emojiRaw = typeof body["emoji"] === "string" ? body["emoji"] : "auto";
  const emoji = (EMOJIS as readonly string[]).includes(emojiRaw) ? emojiRaw : "auto";
  const cta = typeof body["cta"] === "boolean" ? body["cta"] : true;

  const cap = Math.min(...providers.map((p) => LIMITS[p] ?? 2200));

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return bad(
      "AI is not configured yet — an owner runs: supabase secrets set OPENAI_API_KEY=sk-...",
      402,
    );
  }

  const chain = count > 1;
  const system =
    "You are Sosial's social copywriter. Reply with JSON only, no markdown, " +
    `shape {"segments":[{"caption":"...","hashtags":["..."]}]}. ` +
    (chain
      ? `Write a ${count}-part threaded chain on the topic: part 1 is the hook, middle parts build the idea, last part lands the takeaway + a soft CTA. Each part stands alone and flows into the next.`
      : "Write one sharp caption on the topic: hook first, one idea, soft CTA.") +
    ` Each caption ≤ ${cap} characters including spaces. ` +
    "Each hashtags array holds 3-8 lowercase tags WITHOUT the # sign, topical and platform-safe. " +
    (tone === "auto" ? "Match the topic's natural tone." : `Tone: ${tone}.`) +
    (language && language !== "auto" ? ` Write in ${language}.` : " Match the idea's language.") +
    (style && style !== "auto" ? ` Structure it as ${style}.` : "") +
    (instructions ? ` Extra direction: ${instructions}` : "") +
    (emoji === "off" ? " No emojis at all." : emoji === "on" ? " Include a few fitting emojis." : " No emojis unless the topic begs for them.") +
    (cta ? "" : " No call-to-action.") +
    " No numbering, no bullet prefixes.";

  let raw = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 400 + count * 350,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Topic: ${topic}\nPlatforms: ${providers.join(", ")}\nParts: ${count}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return bad(`AI provider refused the request (${res.status}). ${t.slice(0, 120)}`, 502);
    }
    const json = await res.json();
    raw = String(json?.choices?.[0]?.message?.content ?? "");
  } catch (e) {
    return bad(`AI provider unreachable (${String(e).slice(0, 120)}).`, 502);
  }

  let segments: { caption: string; hashtags: string[] }[];
  try {
    const parsed = JSON.parse(raw) as {
      segments?: { caption?: unknown; hashtags?: unknown }[];
    };
    const list = Array.isArray(parsed.segments) ? parsed.segments : [];
    if (!list.length) throw new Error("empty");
    segments = list.slice(0, count).map((s) => ({
      caption: clamp(String(s.caption ?? ""), cap),
      hashtags: (Array.isArray(s.hashtags) ? s.hashtags : [])
        .filter((h): h is string => typeof h === "string")
        .map((h) => h.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, ""))
        .filter((h) => h.length > 0 && h.length <= 30)
        .slice(0, 8),
    }));
    if (!segments.some((s) => s.caption)) throw new Error("empty");
  } catch {
    return bad("AI returned an unusable reply — try again.", 502);
  }

  return Response.json({ segments }, { headers: CORS });
});
