import { ContentBrief, languageLine } from './types';

const MODEL = 'gemini-3.8-flash';
const endpoint = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

/** Loose object schema — every field optional except `type`; rules.ts clamps it all. */
const SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['free', 'bullets', 'numbered', 'table', 'bar', 'vbar', 'pie'] },
                heading: { type: 'string' },
                lines: { type: 'array', items: { type: 'string' } },
                items: { type: 'array', items: { type: 'string' } },
                columns: { type: 'array', items: { type: 'string' } },
                rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
                series: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { label: { type: 'string' }, value: { type: 'number' } },
                    required: ['label', 'value'],
                  },
                },
              },
              required: ['type'],
            },
          },
        },
        required: ['blocks'],
      },
    },
  },
  required: ['pages'],
};

/** Shared carousel prompt — the OpenAI engine reuses it so both models play the same game. */
export function buildCarouselPrompt(brief: ContentBrief): string {
  return [
    'You write social-media carousel copy with the same storytelling quality as Sosial\'s post writer: find the story in the idea, open with a hook, build with real substance, land a payoff. Every card must serve the user\'s idea directly — no generic filler, no invented facts.',
    languageLine(brief.language),
    `User's idea: ${brief.prompt}`,
    `Produce exactly ${brief.pages} cards with this anatomy:`,
    `CARD 1 (cover): heading of at most 8 words that earns the next swipe + 1-2 short supporting lines. This card keeps the design's title and social footer.`,
    `MIDDLE CARDS (full-bleed content): these cards render with NO heading and NO social footer — the content IS the card. Write flowing prose as one "free" block: 4-7 lines, each at most 12 words, building the story with context, evidence, examples or consequences. A middle card may instead be bullets/numbered/table/chart when the idea genuinely provides them.`,
    `LAST CARD (payoff): no heading — one "free" block of 2-4 lines that lands the takeaway, ends with a natural closing line (a takeaway or soft question, never "follow me").`,
    'Charts/tables only when the idea provides real numbers (at most 5 points, labels of at most 3 words). Never invent numbers, quotes, names or facts to fill a chart or table.',
    'Never repeat a heading or a line twice across the whole carousel. Every card must read complete on its own.',
    `Hard limits: at most ${brief.maxWordsPerPage} words per card.`,
    'Do not emit image blocks — photos are added by the user in the editor.',
    'Return ONLY JSON: {"pages":[{"blocks":[{"type":"free","heading":"...","lines":["..."]}]}]} (heading optional — omit it on middle and last cards).',
  ].join('\n');
}

/**
 * One call returns all cards. `grounding` adds Google Search so the copy can
 * reference current facts — costs extra per call, so the UI gates it behind
 * an explicit toggle. Everything returned still passes through normalizeResult.
 */
export async function geminiRaw(brief: ContentBrief, key: string, grounding: boolean): Promise<any[]> {
  const body: any = {
    systemInstruction: { parts: [{ text: 'You output strict JSON only. No markdown fences, no commentary.' }] },
    contents: [{ role: 'user', parts: [{ text: buildCarouselPrompt(brief) }] }],
    // NOTE: Gemini 3.6+ dropped the sampling knobs (temperature/top_p/top_k) —
    // sending them returns 400, so only schema + token budget go out.
    generationConfig: grounding
      ? { responseMimeType: 'text/plain', maxOutputTokens: 4096 }
      : { responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 4096 },
  };
  if (grounding) body.tools = [{ google_search: {} }];

  const r = await fetch(endpoint(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(humanErr(j));
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
  const pages = extractPages(text);
  if (!pages) throw new Error('The model returned unusable JSON — try again.');
  return pages;
}

function extractPages(text: string): any[] | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (o && Array.isArray(o.pages)) return o.pages;
    if (Array.isArray(o)) return o;
    return null;
  } catch {
    return null;
  }
}

function humanErr(j: any): string {
  const msg = String(j?.error?.message ?? '');
  if (/API key/i.test(msg)) return 'That API key was rejected — check it and try again.';
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(msg)) return 'Rate limit hit — wait a minute and retry.';
  return msg || 'Gemini request failed.';
}
