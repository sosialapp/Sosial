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

const TYPES = ["free", "bullets", "numbered", "table", "bar", "vbar", "pie"] as const;

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
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
    "You write social-media carousel copy. Every card must serve the user's idea directly — no generic filler, no invented facts, no examples dragged in from other topics.",
    languageLine(brief.language),
    `User's idea: ${brief.prompt}`,
    `Produce exactly ${brief.pages} cards with fixed roles: card 1 is the hook (restate the idea's core in at most 8 words that earn the next swipe, TEXT only), middle cards each carry ONE idea, the last card is the takeaway (one reusable line, TEXT only).`,
    `At most ${brief.maxBlocksPerPage} blocks per card: a TEXT block first (heading of at most 6 words + 1-2 short description lines), then at most ONE supporting block — and only when the card earns it:`,
    "COMPARISON (old-vs-new, A-vs-B, pros-vs-cons) → small TABLE, 2-3 columns, at most 4 rows, cells of at most 4 words.",
    'REAL NUMBERS from the idea (rankings, shares, change over time) → ONE chart: "bar" for rankings, "pie" for shares of a whole, "vbar" for change. At most 5 points, labels of at most 3 words, plain numbers as values.',
    "STEPS or a process → NUMBERED steps, at most 5. Tips or a list → BULLETS, at most 5.",
    "Cards with no comparison, numbers, steps or list stay TEXT ONLY. Never invent numbers, quotes, names or facts to fill a chart or table — if the idea gives you no data, write prose.",
    "Never repeat a heading or a line twice across the whole carousel. Every card must read complete on its own.",
    `Hard limits: heading at most 6 words, text lines at most 12 words, at most ${brief.maxWordsPerPage} words per card.`,
    "Do not emit image blocks — photos are added by the user in the editor.",
    'Return ONLY JSON: {"pages":[{"blocks":[{"type":"free","heading":"...","lines":["..."]}]}]}.',
  ].join("\n");
}

serve(async (req: Request): Promise<Response> => {
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
  const prompt = typeof body["prompt"] === "string" ? body["prompt"].trim() : "";
  if (!prompt) return bad("prompt is required.");
  if (prompt.length > 2000) return bad("prompt ≤ 2000 chars.");
  const language = typeof body["language"] === "string" ? body["language"].trim().slice(0, 40) : "auto";
  const pagesRaw = typeof body["pages"] === "number" ? Math.floor(body["pages"]) : 3;
  const wordsRaw = typeof body["maxWordsPerPage"] === "number" ? Math.floor(body["maxWordsPerPage"]) : 60;
  const blocksRaw = typeof body["maxBlocksPerPage"] === "number" ? Math.floor(body["maxBlocksPerPage"]) : 2;
  const pages = Math.min(10, Math.max(1, pagesRaw));
  const maxWordsPerPage = Math.min(200, Math.max(10, wordsRaw));
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
        max_tokens: 500 + pages * 400,
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

  return Response.json({ pages: out });
});
