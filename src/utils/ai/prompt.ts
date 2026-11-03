/**
 * One-box AI prompt helpers, shared verbatim by web (apps/web/src/lib/aiPrompt.ts)
 * and mobile (src/utils/ai/prompt.ts); src/utils/ai/prompt.test.ts fails if they drift.
 *
 * The prompt box is the brief. These read the few things a casual prompt
 * already says ("3 posts…", "a 5-part thread…") so the inline chips can follow
 * it, and give each post in a set its own angle so N calls never read alike.
 */

export const MAX_PROMPT = 500;
export const MAX_POSTS = 5;
export const MIN_PARTS = 3;
export const MAX_PARTS = 12;

export interface PromptHints {
  /** true when the prompt asks for a thread / chain. */
  thread?: boolean;
  /** How many separate posts (1..MAX_POSTS), when the prompt names a number. */
  count?: number;
  /** Thread length (MIN_PARTS..MAX_PARTS), when a thread prompt names a number. */
  parts?: number;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10,
  une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, dix: 10,
  ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, zehn: 10,
};

const THREAD_RE = /\b(thread|threads|hilo|hilos|fil|faden)\b|スレッド|스레드|串文|推文串|帖子串/i;

const UNIT = '(?:posts?|captions?|tweets?|toots?|updates?|variations?|versions?|options?|ideas?|parts?|publicaci[oó]n(?:es)?|publications?|beitr[aä]ge?|teil(?:e|en)?|partes?|parties?)';
const LATIN_COUNT_RE = new RegExp(
  `(?:^|[^A-Za-zÀ-ÿ\\d])(\\d{1,2}|${Object.keys(WORD_NUMBERS).join('|')})(?:\\s*-\\s*|\\s+)(?:\\S+\\s+){0,2}?${UNIT}\\b`,
  'i',
);
const CJK_COUNT_RE = /(\d{1,2})\s*(?:つの|個の|件の|本の|개의|개|편의|편|条|篇|個|个|則|件)?\s*(?:投稿|ポスト|게시물|포스트|帖子|贴文|貼文|文案|推文)/;
/** Korean / Japanese order: unit first, then the number ("게시물 3개", "投稿を3つ"). */
const CJK_COUNT_AFTER_RE = /(?:投稿|ポスト|게시물|포스트|帖子|贴文|貼文|文案|推文)\s*(?:を|은|을|를)?\s*(\d{1,2})\s*(?:つ|個|件|本|개|편|条|篇|个|則)/;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** What the prompt already says about shape. Unknown → undefined, the chips keep their value. */
export function readPromptHints(text: string): PromptHints {
  const s = text.trim();
  if (!s) return {};
  const thread = THREAD_RE.test(s);
  let n: number | undefined;
  const latin = LATIN_COUNT_RE.exec(s);
  if (latin) {
    const raw = latin[1].toLowerCase();
    n = /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw];
  } else {
    const cjk = CJK_COUNT_RE.exec(s) ?? CJK_COUNT_AFTER_RE.exec(s);
    if (cjk) n = Number(cjk[1]);
  }
  const out: PromptHints = {};
  if (thread) out.thread = true;
  if (n && n > 0) {
    if (thread) out.parts = clamp(n, MIN_PARTS, MAX_PARTS);
    else out.count = clamp(n, 1, MAX_POSTS);
  }
  return out;
}

/** Distinct openings so a set of posts on one brief never reads alike. */
const ANGLES = [
  'Lead with the main point or offer, stated plainly.',
  'Lead with a relatable moment or a short story.',
  'Lead with a question or a surprising detail.',
  'Lead with urgency or a clear reason to act now.',
  'Lead with a behind-the-scenes or customer angle.',
];

/**
 * Writer direction for post `index` of `total` (0-based). A lone post gets none
 * unless it is a re-roll, then it is asked for a fresh take.
 */
export function angleFor(index: number, total: number, fresh = false): string | undefined {
  const parts: string[] = [];
  if (total > 1) {
    parts.push(`This is post ${index + 1} of ${total} written from the same brief; it must read clearly different from the others.`);
    parts.push(ANGLES[index % ANGLES.length]);
  }
  if (fresh) parts.push('Write a fresh take, different from any earlier version.');
  return parts.length ? parts.join(' ') : undefined;
}

/** AI credits one generation run spends (mirrors _shared/aiCredits.ts: post/adapt 2, thread 3). */
export function creditsFor(count: number, thread: boolean): number {
  return (thread ? 3 : 2) * Math.max(1, count);
}
