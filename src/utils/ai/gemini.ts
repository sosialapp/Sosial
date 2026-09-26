import { ContentBrief, languageLine } from './types';

/**
 * Carousel prompt builder. The prompt is written on-device and sent to the
 * generate-social Edge Function, which runs the model and meters the credits —
 * no provider key lives in the app.
 */
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
