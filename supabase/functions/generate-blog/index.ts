// generate-blog -- SEO blog drafting for the Owner console.
//
// POST { ideas: string[], tone?, audience?, keywords? }
//   -> { drafts: [{ title, description, tag, minutes, slug_hint, blocks,
//                  cover: { url, alt }, images_used: number }] }
//
// One draft per idea, Google's SEO checklist baked into the prompt: one
// H1 (the title), H2 sections, natural keyword use, meta description under
// 160 chars, FAQ close. Bodies come back as legacy Block[] -- the same
// model blog_posts stores and the TipTap editor normalizes -- so the web
// route can insert straight into the drafts list.
//
// Images: Openverse (keyless, commercial-licensed) -- a cover plus up to
// two inline images dropped into the body. Admin-only edge, no credits:
// this drafts the sosial.app marketing blog, not tenant content.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENVERSE_URL = "https://api.openverse.org/v1/images/";

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function bad(msg: string, status = 400) {
  return json({ error: msg }, status);
}

const TAGS = ["Publishing", "Strategy", "AI", "Teams", "Growth", "Product"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });

    if (req.method !== "POST") return bad("POST only.", 405);

    const supaUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!supaUrl || !anonKey || !serviceKey || !apiKey) {
      return bad("AI is not configured yet, an owner runs: supabase secrets set OPENAI_API_KEY=sk-...", 500);
    }

    // Caller must be an app admin (app_admins is service_role-only; the
    // service client bypasses RLS, so this row check IS the gate).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ud, error: uErr } = await userClient.auth.getUser();
    const user = ud?.user;
    if (uErr || !user) return bad("Sign in first.", 401);
    const admin = createClient(supaUrl, serviceKey);
    const { data: adm } = await admin
      .from("app_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1);
    if (!adm || adm.length === 0) return bad("Admins only.", 403);

    let body: { ideas?: unknown; tone?: unknown; audience?: unknown; keywords?: unknown };
    try {
      body = await req.json();
    } catch {
      return bad("Body must be JSON.");
    }

    const rawIdeas = Array.isArray(body.ideas) ? body.ideas : [];
    const ideas = rawIdeas
      .filter((i): i is string => typeof i === "string")
      .map((i) => i.trim().slice(0, 160))
      .filter(Boolean)
      .slice(0, 3);
    if (ideas.length === 0) return bad("Add at least one idea to draft.");
    const tone = typeof body.tone === "string" ? body.tone.trim().slice(0, 40) : "";
    const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 120) : "";
    const keywords = typeof body.keywords === "string" ? body.keywords.trim().slice(0, 200) : "";

    const drafts: unknown[] = [];
    for (const idea of ideas) {
      const prompt = `You are Sosial's SEO content strategist. Sosial (sosial.app) is a multi-platform social media scheduler: plan, preview, approve and auto-publish to 18 channels (TikTok, Instagram, Facebook, Threads, X, Bluesky, Mastodon, Telegram, Discord, VK, LinkedIn, YouTube, Pinterest, Google Business Profile, WordPress, Dev.to, Hashnode, Ghost) from one dashboard, with AI caption writing and a team approval mode.

Draft ONE SEO blog article idea: "${idea}"
Target audience: ${audience || "small business owners, creators and busy social media managers"}.
Tone of voice: ${tone || "smart, direct, practical"}.
${keywords ? `Primary keywords to weave in naturally: ${keywords}.` : ""}
Language: English.

Hard SEO rules:
- title (the H1): under 60 characters, includes the primary keyword, no clickbait.
- description: one 140-160 char meta description including the keyword.
- tag: exactly one of ${JSON.stringify(TAGS)}, the best fit.
- minutes: reading time estimate 4-10.
- Structure: 6-9 H2 sections ("h") in SEO-sensible order, short paragraphs 40-60 words, bullet lists ("ul") where scannability helps, at most one markdown-style comparison "table". Use "quote" sparingly at most once. NO markdown inside any string, plain sentences only. Do not use headings inside the c value of p blocks.
- Include a closing FAQ section: an "h" like "Frequently asked questions" then 3-4 h+p question/answer pairs phrased as real search queries.
- End with one final "p" conclusion that mentions sosial.app (the product) naturally with a soft call to action.
- Facts: reference the channel list, scheduling, approval workflow and AI features only. Never invent prices, numbers of users or funding.

Respond ONLY as JSON: {"title": string, "description": string, "tag": string, "minutes": number, "slug_hint": string, "blocks": block[]}
where block is one of {"t":"p","c":string} | {"t":"h","c":string} | {"t":"ul","c":string[]} | {"t":"quote","c":string} | {"t":"table","head":true,"c":string[][]}. All c strings are plain text.`;

      let parsed: Record<string, unknown>;
      try {
        const res = await fetch(OPENAI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) {
          const t = await res.text();
          return bad(`OpenAI said ${res.status}. ${t.slice(0, 200)}`, 502);
        }
        const j = await res.json();
        parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
      } catch (e) {
        return bad(e instanceof Error ? e.message : "AI call failed.", 502);
      }

      const blocksRaw = Array.isArray(parsed.blocks) ? (parsed.blocks as Record<string, unknown>[]) : [];
      const blocks: Record<string, unknown>[] = [];
      for (const b of blocksRaw) {
        if (!b || typeof b !== "object") continue;
        const t = b.t;
        if (t === "p" && typeof b.c === "string" && b.c.trim()) blocks.push({ t: "p", c: b.c.trim().slice(0, 2000) });
        else if (t === "h" && typeof b.c === "string" && b.c.trim()) blocks.push({ t: "h", c: b.c.trim().slice(0, 200) });
        else if (t === "ul" && Array.isArray(b.c)) {
          const items = b.c.filter((x): x is string => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 400)).slice(0, 12);
          if (items.length) blocks.push({ t: "ul", c: items });
        } else if (t === "quote" && typeof b.c === "string" && b.c.trim()) blocks.push({ t: "quote", c: b.c.trim().slice(0, 600) });
        else if (t === "table" && Array.isArray(b.c)) {
          const rows = b.c
            .filter((r): r is string[] => Array.isArray(r))
            .map((r) => r.map((cell) => (typeof cell === "string" ? cell.slice(0, 200) : "")))
            .filter((r) => r.length > 0)
            .slice(0, 8);
          if (rows.length) blocks.push({ t: "table", c: rows, head: true });
        }
      }
      const withBody = blocks.filter((b) => b.t === "p" || b.t === "h" || b.t === "ul").length;
      if (withBody < 6) return bad(`Draft for "${idea}" came back too thin, retry.`, 502);

      const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 110) : "";
      if (!title) return bad(`Draft for "${idea}" had no title, retry.`, 502);
      const description =
        typeof parsed.description === "string" && parsed.description.trim()
          ? parsed.description.trim().slice(0, 160)
          : "";
      const tag = TAGS.includes(String(parsed.tag)) ? String(parsed.tag) : "Strategy";
      const minutes =
        typeof parsed.minutes === "number" ? Math.max(3, Math.min(12, Math.round(parsed.minutes))) : 6;
      const slugHint = typeof parsed.slug_hint === "string" && parsed.slug_hint.trim()
        ? parsed.slug_hint.trim().slice(0, 80)
        : title;

      // Images: commercial-licensed, wide enough. Cover for the card, two
      // dropped into the body: one right after the lead, one before the FAQ.
      const imageQuery = idea.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter((w) => w.length > 2).slice(0, 5).join(" ") || "social media marketing";
      let images: { url: string; alt: string }[] = [];
      try {
        const res = await fetch(
          `${OPENVERSE_URL}?q=${encodeURIComponent(imageQuery)}&license_type=commercial&page_size=8`,
          { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "sosial-blog-gen/1" } },
        );
        if (res.ok) {
          const j = await res.json();
          const candidates = Array.isArray(j.results) ? (j.results as Record<string, unknown>[]) : [];
          images = candidates
            .filter((r) => {
              const u = typeof r.url === "string" ? r.url : "";
              const w = typeof r.width === "number" ? r.width : 0;
              return /^https:\/\//.test(u) && w >= 900;
            })
            .slice(0, 2)
            .map((r) => ({
              url: String(r.url),
              alt: String(r.title ?? imageQuery).slice(0, 120),
            }));
        }
      } catch {
        // images are a garnish, generation continues without them
      }
      if (images.length > 0) {
        const firstP = blocks.findIndex((b) => b.t === "p");
        if (firstP >= 0) {
          blocks.splice(firstP + 1, 0, { t: "img", c: images[0].url, alt: images[0].alt });
        }
        if (images[1]) {
          const faqH = blocks.findIndex((b) => b.t === "h" && /(faq|questions)/i.test(String(b.c)));
          const at = faqH >= 0 ? faqH : Math.min(blocks.length, 6);
          blocks.splice(at, 0, { t: "img", c: images[1].url, alt: images[1].alt });
        }
      }

      drafts.push({
        title,
        description,
        tag,
        minutes,
        slug_hint: slugHint,
        blocks,
        cover: images[0] ?? null,
      });
    }

    return json({ drafts });
  });
