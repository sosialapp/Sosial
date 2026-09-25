// generate-studio · AI carousel copy for the web canvas studio
//
// POST { prompt, language?, pages, maxWordsPerPage, maxBlocksPerPage } →
//   200 { pages: [{ blocks: [...] }] }
//   · 401 unauthenticated · 402 AI not configured · 502 upstream failure
//
// Mirror of the mobile carousel writer (src/utils/ai/gemini.ts →
// buildCarouselPrompt): the model only returns words + block shape, never
// ids, colors, sizes or images. The web client runs the same rules clamp
// (apps/web/src/lib/studio/ai.ts) before anything reaches the canvas.
// Key lives server-side: supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { CONTENT_RULES } from "../_shared/content_rules.ts";
import { gateAiGeneration } from "../_shared/usage.ts";

const TYPES = ["free", "bullets", "numbered", "table", "bar", "vbar", "pie"] as const;

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

/** Output-language directive: Auto mirrors the user's prompt language. */
function languageLine(language: string): string {
  if (!language || language === "auto") {
    return "Write in the SAME language as the user's idea below — mirror it exactly (Bahasa Melayu, 中文, Tamil, Manglish or mixed language included). Switch language only if the idea explicitly asks for another.";
  }
  return `Write everything in ${language}.`;
}

function buildPrompt(brief: {
  prompt: string;
  language: string;
  pages: number;
  maxWordsPerPage: number;
  maxBlocksPerPage: number;
}): string {
  return [
    "You write social-media carousel copy with the same storytelling quality as Sosial's post writer: find the story in the idea, open with a hook, build with real substance, land a payoff. Every card must serve the user's idea directly — no generic filler, no invented facts.",
    languageLine(brief.language),
    `User's idea: ${brief.prompt}`,
    `Produce exactly ${brief.pages} cards with this anatomy:`,
    `CARD 1 (cover): heading of at most 8 words that earns the next swipe + 1-2 short supporting lines. This card keeps the design's title and social footer.`,
    `MIDDLE CARDS (full-bleed content): these cards render with NO heading and NO social footer — the content IS the card. Write flowing prose as one "free" block: 4-7 lines, each at most 12 words, building the story with context, evidence, examples or consequences. A middle card may instead be bullets/numbered/table/chart when the idea genuinely provides them.`,
    `LAST CARD (payoff): no heading — one "free" block of 2-4 lines that lands the takeaway, ends with a natural closing line (a takeaway or soft question, never "follow me").`,
    `Charts/tables only when the idea provides real numbers (at most 5 points, labels of at most 3 words). Never invent numbers, quotes, names or facts to fill a chart or table.`,
    "Never repeat a heading or a line twice across the whole carousel. Every card must read complete on its own.",
    `Hard limits: at most ${brief.maxWordsPerPage} words per card.`,
    "Do not emit image blocks — photos are added by the user in the editor.",
    'Return ONLY JSON: {"pages":[{"blocks":[{"type":"free","heading":"...","lines":["..."]}]}]} (heading optional — omit it on middle and last cards).',
    CONTENT_RULES,
  ].join("\n");
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

  // Monthly AI allowance (free = none). Calendar-month window even for
  // annual subscribers — billing interval only changes billing.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey) {
    const gate = await gateAiGeneration(supaUrl, serviceKey, authHeader, anonKey);
    if (!gate.ok) return bad(gate.message ?? "AI allowance reached.", gate.status ?? 402);
  }

  const prompt = typeof body["prompt"] === "string" ? body["prompt"].trim() : "";
  if (!prompt) return bad("prompt is required.");
  if (prompt.length > 2000) return bad("prompt ≤ 2000 chars.");
  const language = typeof body["language"] === "string" ? body["language"].trim().slice(0, 40) : "auto";
  const pagesRaw = typeof body["pages"] === "number" ? Math.floor(body["pages"]) : 3;
  const wordsRaw = typeof body["maxWordsPerPage"] === "number" ? Math.floor(body["maxWordsPerPage"]) : 60;
  const blocksRaw = typeof body["maxBlocksPerPage"] === "number" ? Math.floor(body["maxBlocksPerPage"]) : 2;
  const pages = Math.min(10, Math.max(1, pagesRaw));
  const maxWordsPerPage = Math.min(300, Math.max(10, wordsRaw));
  const maxBlocksPerPage = Math.min(3, Math.max(1, blocksRaw));

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return bad(
      "AI is not configured yet — an owner runs: supabase secrets set OPENAI_API_KEY=sk-...",
      402,
    );
  }

  const system = buildPrompt({ prompt, language, pages, maxWordsPerPage, maxBlocksPerPage });

  let raw = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 800 + pages * 600,
        messages: [
          { role: "system", content: "You output strict JSON only. No markdown fences, no commentary. " + system },
          { role: "user", content: `Idea: ${prompt}\nCards: ${pages}` },
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

  let out: { blocks: unknown[] }[];
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("empty");
    const parsed = JSON.parse(match[0]) as { pages?: { blocks?: unknown[] }[] };
    const list = Array.isArray(parsed.pages) ? parsed.pages : [];
    out = list
      .filter((p) => p && Array.isArray(p.blocks))
      .slice(0, pages)
      .map((p) => ({
        blocks: (p.blocks ?? []).filter(
          (b) => b && typeof (b as { type?: unknown }).type === "string" &&
            (TYPES as readonly string[]).includes((b as { type: string }).type),
        ),
      }))
      .filter((p) => p.blocks.length > 0);
    if (!out.length) throw new Error("empty");
  } catch {
    return bad("AI returned an unusable reply — try again.", 502);
  }

  return Response.json({ pages: out }, { headers: CORS });
});
