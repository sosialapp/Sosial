// generate-captions · AI copy for single posts, chains and per-channel variants
//
// POST { topic, platforms, thread?, parts?, tone?, language?, style?,
//        instructions?, emoji?, cta?, hashtags? }
//   → 200 { variants: [{ platform, posts: ["..."], hashtags: ["..."] }] }
// POST { posts, platform, thread?, language?, op }  · rewrite mode
//   op: shorter | punchier | natural | context | tone | style
//   → 200 { posts: ["..."] }
//   · 401 unauthenticated · 402 AI not configured · 502 upstream failure
//
// Any signed-in user may call it (composing is a member action); the key
// lives server-side. Caps mirror the mobile app (thread.ts / social.ts) so
// copy never exceeds the strictest picked channel — the model adapts the
// wording per channel while keeping the facts identical. The model returns
// JSON; we clamp server-side on a word boundary as a second guard.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { CONTENT_RULES } from "../_shared/content_rules.ts";
import { gateAiGeneration } from "../_shared/usage.ts";

/** Caption limits for channels that aren't chain-capable (joined text). */
const TEXT_CAPS: Record<string, number> = {
  facebook: 63206,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 800,
};

/** Native reply-chain caps (strictest wins across picked chain channels). */
const THREAD_CAPS: Record<string, number> = {
  x: 280,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
};

const CAPTION_MAX = 2200;

const PLATFORM_IDS = [
  "any", "x", "bluesky", "threads", "mastodon", "facebook",
  "instagram", "tiktok", "linkedin", "youtube", "pinterest",
] as const;

const THREAD_PLATFORM_IDS = ["x", "threads", "mastodon", "bluesky"];

/** How each destination wants to be written — the core message stays identical. */
const PLATFORM_ADAPT: Record<string, string> = {
  any: "write for a general social feed",
  x: "concise and punchy, one idea, no wasted words",
  threads: "conversational and warm, thread-native, room to breathe",
  bluesky: "casual and curious, community-minded, low hype",
  mastodon: "thoughtful and grounded, no engagement-bait, no growth-hack tone",
  linkedin: "professional and insight-led, land the business implication",
  facebook: "readable and conversational for a broad audience",
  instagram: "caption-friendly with clean line breaks, strong first line",
  tiktok: "hook-led spoken-script energy, says it out loud well",
  youtube: "title/description friendly, searchable phrasing, plain sentences",
  pinterest: "descriptive and keyword-rich, idea-led, no slang",
};

const TONES = ["auto", "story", "punchy", "friendly", "professional", "bold", "funny"] as const;
const EMOJIS = ["auto", "on", "off"] as const;

const REWRITE_ASKS: Record<string, string> = {
  shorter: "Make every post noticeably shorter. Cut filler, keep every fact.",
  punchier: "Make it punchier: stronger verbs, tighter lines, sharper first words. Keep the meaning.",
  natural: "Make it sound more natural and human — vary sentence length, remove anything that reads like AI.",
  context: "Add useful context or a concrete example to each point. Do not invent facts.",
  tone: "Rewrite with a different, more fitting voice for this idea and platform.",
  style: "Restructure it with a different approach while keeping the same facts and message.",
};

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

function capFor(platform: string, thread: boolean): number {
  if (platform === "any") return thread ? THREAD_CAPS.x : CAPTION_MAX;
  if (thread) return THREAD_CAPS[platform] ?? TEXT_CAPS[platform] ?? 280;
  return TEXT_CAPS[platform] ?? THREAD_CAPS[platform] ?? CAPTION_MAX;
}

/** Deduped, validated destinations. Falls back to ['any'] so generation always has a target. */
function activePlatforms(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of list) {
    const id = p.toLowerCase();
    if (!(PLATFORM_IDS as readonly string[]).includes(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id === "any" ? "any" : id);
  }
  // 'any' excludes everything else, like the mobile picker.
  return out.includes("any") ? ["any"] : out.length ? out : ["any"];
}

function normHashtags(list: unknown): string[] {
  return (Array.isArray(list) ? list : [])
    .filter((h): h is string => typeof h === "string")
    .map((h) => h.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, ""))
    .filter((h) => h.length > 0 && h.length <= 30)
    .slice(0, 8);
}

async function chat(apiKey: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI provider refused the request (${res.status}). ${t.slice(0, 120)}`);
  }
  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? "");
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

  // Monthly AI allowance (free = none). The usage month is a calendar month
  // even for annual subscribers — the billing interval only changes billing.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey) {
    const gate = await gateAiGeneration(supaUrl, serviceKey, authHeader, anonKey);
    if (!gate.ok) return bad(gate.message ?? "AI allowance reached.", gate.status ?? 402);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return bad(
      "AI is not configured yet — an owner runs: supabase secrets set OPENAI_API_KEY=sk-...",
      402,
    );
  }

  const language = typeof body["language"] === "string" ? body["language"].trim().slice(0, 40) : "auto";
  const languageRule = language && language !== "auto" ? ` Write in ${language}.` : " Match the idea's language.";

  /* ------------------------- rewrite mode ------------------------- */

  if (Array.isArray(body["posts"])) {
    const posts = (body["posts"] as unknown[])
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (!posts.length) return bad("posts is required for rewrites.");
    const opRaw = typeof body["op"] === "string" ? body["op"] : "";
    const ask = REWRITE_ASKS[opRaw];
    if (!ask) return bad("Unknown rewrite op.");
    const thread = body["thread"] === true;
    const platforms = activePlatforms(body["platform"]);
    const limit = Math.min(...platforms.map((p) => capFor(p, thread)));
    const system =
      "You are Sosial's social copy editor. Reply with JSON only, no markdown, " +
      'shape {"posts":["..."]}. ' +
      "Preserve ALL facts, names, numbers and meaning." +
      languageRule +
      ` Edit instruction: ${ask} ` +
      `Keep every post under ${limit} characters. Keep the same number of parts unless the instruction says otherwise.` +
      " No numbering, no bullet prefixes.\n" +
      CONTENT_RULES;
    try {
      const raw = await chat(
        apiKey,
        system,
        "Current posts:\n" + posts.map((p, i) => `${i + 1}. ${p}`).join("\n"),
        400 + posts.length * 350,
      );
      const parsed = JSON.parse(raw) as { posts?: unknown };
      const out = (Array.isArray(parsed.posts) ? parsed.posts : [])
        .filter((p): p is string => typeof p === "string")
        .map((p) => clamp(p, limit));
      if (!out.length || !out.some((p) => p.trim())) {
        return bad("The rewrite came back empty.", 502);
      }
      return Response.json({ posts: out }, { headers: CORS });
    } catch (e) {
      return bad(`${String(e instanceof Error ? e.message : e).slice(0, 160)}`, 502);
    }
  }

  /* ------------------------ generation mode ------------------------ */

  const topic = typeof body["topic"] === "string" ? body["topic"].trim() : "";
  if (!topic) return bad("topic is required.");
  if (topic.length > 500) return bad("topic ≤ 500 chars.");

  const thread = body["thread"] === true;
  const countRaw = typeof body["parts"] === "number" ? Math.floor(body["parts"]) : 1;
  const parts = Math.min(12, Math.max(1, countRaw));
  const toneRaw = typeof body["tone"] === "string" ? body["tone"] : "auto";
  const tone = (TONES as readonly string[]).includes(toneRaw) ? toneRaw : "auto";
  const style = typeof body["style"] === "string" ? body["style"].trim().slice(0, 40) : "auto";
  const instructions = typeof body["instructions"] === "string" ? body["instructions"].trim().slice(0, 500) : "";
  const emojiRaw = typeof body["emoji"] === "string" ? body["emoji"] : "auto";
  const emoji = (EMOJIS as readonly string[]).includes(emojiRaw) ? emojiRaw : "auto";
  const cta = body["cta"] !== false;
  const hashtagsWanted = body["hashtags"] === true;

  // Threads only publish as chains on four channels — narrow like the mobile picker.
  let platforms = activePlatforms(body["platforms"] ?? body["providers"]);
  if (thread) {
    const kept = platforms.filter((p) => p === "any" || THREAD_PLATFORM_IDS.includes(p));
    platforms = kept.length ? kept : ["x"];
  }

  const chain = thread && parts > 1;
  const adapt = platforms.length > 1;

  const shared =
    (tone === "auto" ? "Match the topic's natural tone." : `Tone: ${tone}.`) +
    languageRule +
    (style && style !== "auto" ? ` Structure it as ${style}.` : "") +
    (instructions ? ` Extra direction: ${instructions}` : "") +
    (emoji === "off" ? " No emojis at all." : emoji === "on" ? " Include a few fitting emojis." : " No emojis unless the topic begs for them.") +
    (cta ? "" : " No call-to-action.") +
    (hashtagsWanted
      ? " Hashtags: 3-8 lowercase topical tags WITHOUT the # sign, kept separate from the copy."
      : ' Hashtags arrays are always empty [].') +
    " No numbering, no bullet prefixes.";

  const chainShape = chain
    ? `Write a ${parts}-part threaded chain on the topic: part 1 is the hook, middle parts build the idea, last part lands the takeaway + a soft CTA. Each part stands alone and flows into the next.`
    : "Write one sharp caption on the topic: hook first, one idea, soft CTA.";

  try {
    if (adapt) {
      // Same facts everywhere — the wording adapts to each channel.
      const lines = platforms.map((p) => `- ${p}: ${PLATFORM_ADAPT[p] ?? "general social feed"}`);
      const per = platforms.map((p) => capFor(p, thread));
      const system =
        "You are Sosial's social copywriter. Reply with JSON only, no markdown, " +
        'shape {"variants":[{"platform":"...","posts":["..."],"hashtags":["..."]}]}. ' +
        chainShape +
        " Write one variant per destination platform — the facts, names and numbers stay identical, only the wording and shape adapt:" +
        `\n${lines.join("\n")}\n` +
        `Character caps per platform (including spaces): ${platforms.map((p, i) => `${p} ≤ ${per[i]}`).join(", ")}. ` +
        (chain ? "Every variant uses the same number of parts." : "Every variant is a single post.") +
        shared +
        "\n" +
        CONTENT_RULES;
      const raw = await chat(
        apiKey,
        system,
        `Topic: ${topic}\nPlatforms: ${platforms.join(", ")}\nParts: ${chain ? parts : 1}`,
        600 + (chain ? parts : 2) * 320 * platforms.length,
      );
      const parsed = JSON.parse(raw) as {
        variants?: { platform?: unknown; posts?: unknown; hashtags?: unknown }[];
      };
      const variants = (Array.isArray(parsed.variants) ? parsed.variants : [])
        .map((v) => {
          const p = typeof v.platform === "string" ? v.platform.toLowerCase() : "";
          const cap = capFor(p, thread);
          return {
            platform: p,
            posts: (Array.isArray(v.posts) ? v.posts : [])
              .filter((s): s is string => typeof s === "string")
              .map((s) => clamp(s, cap))
              .slice(0, chain ? parts : 1),
            hashtags: normHashtags(v.hashtags),
          };
        })
        .filter((v) => (PLATFORM_IDS as readonly string[]).includes(v.platform) && v.posts.some((s) => s.trim()));
      if (!variants.length) return bad("AI returned an unusable reply — try again.", 502);
      return Response.json({ variants }, { headers: CORS });
    }

    // Single destination — one variant.
    const cap = capFor(platforms[0], thread);
    const system =
      "You are Sosial's social copywriter. Reply with JSON only, no markdown, " +
      'shape {"posts":["..."],"hashtags":["..."]}. ' +
      chainShape +
      ` Each post ≤ ${cap} characters including spaces. ` +
      shared +
      "\n" +
      CONTENT_RULES;
    const raw = await chat(
      apiKey,
      system,
      `Topic: ${topic}\nPlatform: ${platforms[0]}\nParts: ${chain ? parts : 1}`,
      400 + (chain ? parts : 1) * 350,
    );
    const parsed = JSON.parse(raw) as { posts?: unknown; hashtags?: unknown };
    const posts = (Array.isArray(parsed.posts) ? parsed.posts : [])
      .filter((s): s is string => typeof s === "string")
      .map((s) => clamp(s, cap))
      .slice(0, chain ? parts : 1);
    if (!posts.some((s) => s.trim())) return bad("AI returned an unusable reply — try again.", 502);
    return Response.json(
      { variants: [{ platform: platforms[0], posts, hashtags: normHashtags(parsed.hashtags) }] },
      { headers: CORS },
    );
  } catch (e) {
    return bad(`${String(e instanceof Error ? e.message : e).slice(0, 160)}`, 502);
  }
});
