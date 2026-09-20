import { THREAD_CAPS } from '../thread';
import { getAiKey } from './key';

/**
 * Caption + thread generator. Same contract as the carousel engine: real model
 * when the user has a Gemini key, deterministic offline engine otherwise, and
 * every result is clamped to the platform caps afterwards — never trusted.
 *
 * The thread mode is written for natural storytelling: one idea per post, a
 * real hook, a payoff, and no "1/", "🧵" or "thread" markers.
 */

const MODEL = 'gemini-3.8-flash';
const endpoint = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

export type SocialPlatform = 'any' | 'x' | 'bluesky' | 'threads' | 'mastodon';

export type SocialTone = 'story' | 'punchy' | 'friendly' | 'professional' | 'bold';

export const SOCIAL_TONES: { id: SocialTone; label: string }[] = [
  { id: 'story', label: 'Story' },
  { id: 'punchy', label: 'Punchy' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'professional', label: 'Pro' },
  { id: 'bold', label: 'Bold' },
];

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: 'any', label: 'Anywhere' },
  { id: 'x', label: 'X' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'threads', label: 'Threads' },
  { id: 'mastodon', label: 'Mastodon' },
];

export type SocialStyle =
  | 'auto' | 'breaking' | 'thread' | 'listicle' | 'teardown' | 'deepdive'
  | 'compare' | 'casestudy' | 'postmortem' | 'roundup' | 'hottake';

export const SOCIAL_STYLES: { id: SocialStyle; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Pick the best fit' },
  { id: 'breaking', label: 'Breaking', hint: 'Urgent news update' },
  { id: 'thread', label: 'Deep thread', hint: 'Story, one idea per post' },
  { id: 'listicle', label: 'Listicle', hint: 'Saveable value stack' },
  { id: 'teardown', label: 'Teardown', hint: 'Feature → business value' },
  { id: 'deepdive', label: 'Tech dive', hint: 'How it works, in layers' },
  { id: 'compare', label: 'X vs Y', hint: 'Old way vs modern way' },
  { id: 'casestudy', label: 'Case study', hint: 'Metric-led social proof' },
  { id: 'postmortem', label: 'Post-mortem', hint: 'Honest failure lesson' },
  { id: 'roundup', label: 'Roundup', hint: 'Curated resource vault' },
  { id: 'hottake', label: 'Hot take', hint: 'Debate-sparking opinion' },
];

/** Styles that only make sense as multi-post threads. */
export const THREAD_STYLES: SocialStyle[] = ['thread', 'deepdive'];

export interface SocialBrief {
  prompt: string;
  language: string;
  tone: SocialTone;
  /** true = write a connected thread; false = one caption */
  thread: boolean;
  /** target number of thread posts */
  parts: number;
  hashtags: boolean;
  platform: SocialPlatform;
  /** content playbook; 'auto' lets the model commit to the best fit */
  style: SocialStyle;
}

export interface SocialResult {
  /** single-post copy (when thread mode, this is the head post) */
  caption: string;
  /** thread segments, in order (empty when not threading) */
  thread: string[];
  hashtags: string[];
  provider: string;
  warnings: string[];
}

export const DEFAULT_SOCIAL_BRIEF: SocialBrief = {
  prompt: '',
  language: 'English',
  tone: 'story',
  thread: true,
  parts: 5,
  hashtags: true,
  platform: 'any',
  style: 'auto',
};

/** Strictest cap a segment has to fit: the chosen platform, or X's 280 for "any". */
export function capFor(platform: SocialPlatform): number {
  if (platform === 'any') return THREAD_CAPS.x;
  return THREAD_CAPS[platform] ?? 280;
}

const CAPTION_MAX = 2200;

const clean = (s: unknown): string => (typeof s === 'string' ? s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim() : '');
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Trim to `limit` characters on a word boundary, adding an ellipsis only when cut. */
function clampChars(s: string, limit: number): string {
  const t = clean(s);
  if (t.length <= limit) return t;
  const cut = t.slice(0, Math.max(0, limit - 1));
  const at = cut.lastIndexOf(' ');
  return (at > limit * 0.6 ? cut.slice(0, at) : cut).trimEnd() + '…';
}

/** Strip leading list markers ("1/", "2.", "3)") a model may sneak in. */
function stripNumbering(s: string): string {
  return s.replace(/^\s*\(?\d{1,2}\s*[\/.)\]:-]\s*/, '').replace(/^\s*[-•]\s*/, '').trim();
}

const HASH_STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'about', 'from', 'into', 'when',
  'what', 'how', 'why', 'are', 'was', 'were', 'will', 'can', 'not', 'but', 'our', 'their', 'them',
  'have', 'has', 'had', 'been', 'just', 'like', 'more', 'most', 'some', 'one', 'out', 'get', 'got',
]);

function deriveHashtags(prompt: string, n = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words(prompt.toLowerCase()).map((x) => x.replace(/[^a-z0-9]/g, ''))) {
    if (!w || w.length < 4 || HASH_STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push('#' + w);
    if (out.length >= n) break;
  }
  return out;
}

function normHashtags(raw: unknown, brief: SocialBrief): string[] {
  if (!brief.hashtags) return [];
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    let t = clean(item).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, '');
    if (!t) continue;
    const tag = '#' + t;
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= 5) break;
  }
  return out;
}

/** Clamp a model/offline response into something the composer can always use. */
export function normalizeSocial(raw: any, brief: SocialBrief, provider: string): SocialResult {
  const warnings: string[] = [];
  const limit = capFor(brief.platform);

  let thread: string[] = Array.isArray(raw?.thread)
    ? raw.thread.map((s: unknown) => stripNumbering(clean(s))).filter(Boolean)
    : [];
  let caption = stripNumbering(clean(raw?.caption));

  if (brief.thread) {
    if (thread.length < 2 && caption) thread = [caption];
    const maxParts = Math.max(2, Math.min(12, brief.parts));
    if (thread.length > maxParts) {
      thread = thread.slice(0, maxParts);
      warnings.push(`Trimmed the thread to ${maxParts} posts.`);
    }
    let clamped = false;
    thread = thread.map((s) => {
      if (s.length <= limit) return s;
      clamped = true;
      return clampChars(s, limit);
    });
    if (clamped) warnings.push(`Some posts were trimmed to fit ${limit} characters.`);
    if (!caption) caption = thread[0] ?? '';
    else if (caption.length <= limit) caption = clampChars(caption, limit);
  } else {
    thread = [];
    if (!caption && Array.isArray(raw?.thread)) caption = raw.thread.map((s: unknown) => clean(s)).filter(Boolean).join('\n\n');
    if (caption.length > CAPTION_MAX) {
      caption = clampChars(caption, CAPTION_MAX);
      warnings.push('The caption was trimmed — it was longer than any platform accepts.');
    }
  }

  const hashtags = normHashtags(raw?.hashtags, brief);
  if (outEmpty(caption, thread, hashtags)) warnings.push('Nothing usable came back — try rephrasing the idea.');

  return { caption, thread, hashtags, provider, warnings };
}

const outEmpty = (caption: string, thread: string[], hashtags: string[]) =>
  !caption && thread.length === 0 && hashtags.length === 0;

/* ---------------- model path ---------------- */

const STYLE_BLOCKS: Record<Exclude<SocialStyle, 'auto'>, string> = {
  breaking: [
    'STYLE: breaking news update. Open with an alert marker (JUST IN / BREAKING / UPDATE) + the headline.',
    'Then 1-2 sentences of fact, one line on why it matters right now, and end with a [Source: link] placeholder.',
    'Only use facts present in the idea. If something is unconfirmed, say so — never fill gaps with invented detail.',
  ].join(' '),
  thread: [
    'STYLE: educational thread. Open with a hook that promises a payoff worth reading for.',
    'Move ONE idea per post in rising order; the last post lands a real takeaway or call-to-action.',
  ].join(' '),
  listicle: [
    'STYLE: listicle / value stack. Hook with a concrete promise ("5 tools that cut my editing time in half").',
    'Scannable items as "Name — one line on why it matters". Close with one save/share prompt.',
  ].join(' '),
  teardown: [
    'STYLE: feature teardown. Open on the workflow pain, then the feature in ONE sentence.',
    'Follow with 2-3 metric-led value bullets and a single try-it call-to-action.',
    'Use only numbers from the idea — if there are none, write the value without numbers. Never invent metrics.',
  ].join(' '),
  deepdive: [
    'STYLE: technical deep-dive thread. Hook with the architectural puzzle ("How X handles Y without falling over").',
    'Unpack in layers, in order: inputs → processing → storage/caching → edge cases. Close with a docs/blog pointer placeholder.',
    'Explain like a senior to a smart junior: precise, no jargon walls, no hand-waving.',
  ].join(' '),
  compare: [
    'STYLE: old-way vs modern-way comparison. Hook: "The difference between A and B:".',
    'Then the legacy flaws (2-3, marked ❌) against the modern habits (2-3, marked ✅).',
    'Close with ONE sentence naming the mindset shift. Steelman the old way — no strawmen.',
  ].join(' '),
  casestudy: [
    'STYLE: metric-led case study. Hook with the headline result ("How a 12-person SaaS cut churn 31% in 60 days").',
    'Then the bottleneck, the 2-4 implementation steps, and 3 hard-number bullets.',
    'Use only numbers from the idea. If the idea has no numbers, write it as a process story, not a results story.',
  ].join(' '),
  postmortem: [
    'STYLE: founder post-mortem. Open with the failure, plainly owned — no humblebrag.',
    'Then what actually went wrong, the structural fix that followed, and one open question inviting shared experiences.',
  ].join(' '),
  roundup: [
    'STYLE: resource roundup. Hook with invested effort ("I spent 6 years on X. These N resources save you 100+ hours:").',
    'Group items by category, each as "Name — what it does in one line". Close with one bookmark prompt.',
  ].join(' '),
  hottake: [
    'STYLE: contrarian take. Open with the unpopular claim, stated cleanly — no insults, no dunking on real people.',
    'Then 2-3 myth-vs-reality beats, and close with a genuine agree/disagree question.',
  ].join(' '),
};

const HUMAN_RULES = [
  'HUMAN VOICE (non-negotiable): you sound like a person, never a brand deck.',
  'Banned words — never emit: delve, unpack, tapestry, landscape, paradigm, beacon, game-changer, revolutionary, testament, elevate, foster, seamless, unlock/unlocking, next-gen, synergize, supercharge, "in an era of", "in today\'s fast-paced world", "let\'s dive in".',
  'Banned constructions: "It\'s not X, it\'s Y" contrasts, "Here\'s the truth:" throat-clearing, "Ever wondered…?" openers, and "whether X, Y, or Z" triplets.',
  'Rhythm: alternate short punchy lines with medium explainers; break lines liberally; no paragraph longer than 3 lines.',
  'Always use contractions (it\'s, don\'t, can\'t, you\'re, we\'ve). Open sentences with verbs or natural transitions (Look, Here\'s the thing, Honestly, Turns out).',
  'Show, don\'t tell: concrete specifics over adjectives ("cut render time from 450ms to 42ms", not "blazing fast").',
  'Emoji: at most ONE per post, structural only (🚨 ❌ ✅ 👇 where the style calls for one). Never mid-sentence, never as word substitutes.',
  'At most ONE call-to-action per post or thread-close, and keep it soft — an invitation, not a demand.',
].join('\n');

const HONESTY_RULES = [
  'HONESTY: never invent metrics, quotes, names, studies, or links.',
  'If the idea gives you numbers, use them; if not, write around them — never fabricate.',
  'News-style output ends with a [Source: link] placeholder for the user to fill.',
].join('\n');

function buildPrompt(brief: SocialBrief, limit: number): string {
  const lines = [
    'You are a sharp social-media copywriter who sounds like a real person, never like a brand or a press release.',
    `Language: ${brief.language}. Tone: ${brief.tone}.`,
    `The user's raw idea: "${brief.prompt}"`,
    brief.style === 'auto'
      ? 'Pick the best-fit playbook for this idea from: breaking news, educational thread, listicle, feature teardown, technical deep-dive, comparison, case study, post-mortem, resource roundup, or hot take — and commit to it fully.'
      : STYLE_BLOCKS[brief.style],
    HUMAN_RULES,
    HONESTY_RULES,
  ];
  if (brief.thread) {
    lines.push(
      `Write it as a NATURAL THREAD of about ${brief.parts} connected posts.`,
      'Open with a hook that earns the next tap. Move ONE idea per post, in a rising order, and land a real payoff in the last one.',
      'Each post must stand on its own but pull the reader forward. Write like you talk.',
      `Never number the posts, never write "1/", never use "🧵", never say "thread", "in this thread", or "let me explain". (Numbering breaks character budgets and cross-posting — the app strips it anyway.) No hashtags inside the posts.`,
      `Keep every post under ${limit} characters.`,
      'Set "caption" to the first post.',
    );
  } else {
    lines.push(
      'Write ONE tight caption — a hook line, one or two beats of value, and a soft close. No numbered lists unless the idea is genuinely a list.',
      `Keep it under ${CAPTION_MAX} characters, but shorter is better.`,
      'Set "thread" to an empty array.',
    );
  }
  lines.push(
    brief.hashtags
      ? 'Return 3-5 relevant hashtags separately (no more): a mix of broad reach and niche tags, no camel-case stuffing.'
      : 'Return an empty hashtags array.',
    'Return ONLY JSON: {"caption":"...","thread":["..."],"hashtags":["..."]}.',
  );
  return lines.join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    caption: { type: 'string' },
    thread: { type: 'array', items: { type: 'string' } },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
  required: ['caption'],
};

export async function geminiSocial(brief: SocialBrief, key: string): Promise<any> {
  const limit = capFor(brief.platform);
  const body = {
    systemInstruction: { parts: [{ text: 'You output strict JSON only. No markdown fences, no commentary.' }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(brief, limit) }] }],
    // NOTE: Gemini 3.6+ dropped the sampling knobs (temperature/top_p/top_k) —
    // sending them returns 400, so only schema + token budget go out.
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 2048 },
  };
  const r = await fetch(endpoint(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(humanErr(j));
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The model returned unusable JSON — try again.');
  return JSON.parse(m[0]);
}

function humanErr(j: any): string {
  const msg = String(j?.error?.message ?? '');
  if (/API key/i.test(msg)) return 'That API key was rejected — check it and try again.';
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(msg)) return 'Rate limit hit — wait a minute and retry.';
  return msg || 'Gemini request failed.';
}

/* ---------------- offline path ---------------- */

/** Deterministic, human-sounding stand-in so the flow works with no key. */
export function mockSocial(brief: SocialBrief): any {
  const topic = clean(brief.prompt) || 'your idea';
  const t = topic.replace(/[.!?]+$/, '');
  const hooks: Record<SocialTone, string> = {
    story: `Let me tell you about ${t}.`,
    punchy: `${cap(t)} — but not how you think.`,
    friendly: `Okay, let's actually talk about ${t}.`,
    professional: `A quick note on ${t}.`,
    bold: `Most advice about ${t} is wrong.`,
  };
  const beats = [
    hooks[brief.tone] ?? hooks.story,
    `For a long time I treated ${t} like a checklist. More effort, more tabs open, more noise. It didn't work.`,
    `What finally moved things was smaller than I expected: one habit, done on the days I didn't feel like it.`,
    `Here's the part most people skip — you don't need a new system. You need to keep the one you have for longer than it feels exciting.`,
    `So pick the smallest version, attach it to something you already do, and let it be boring for a while.`,
    `If ${t} has been on your mind, save this and start today.`,
  ];
  if (!brief.thread) {
    return {
      caption: [beats[0], beats[2], beats[4]].join('\n\n'),
      thread: [],
      hashtags: deriveHashtags(topic),
    };
  }
  const n = Math.max(2, Math.min(beats.length, brief.parts));
  return { caption: beats[0], thread: beats.slice(0, n), hashtags: deriveHashtags(topic) };
}

/* ---------------- entry point ---------------- */

export async function generateSocial(brief: SocialBrief): Promise<SocialResult> {
  const key = await getAiKey();
  if (key) {
    try {
      const raw = await geminiSocial(brief, key);
      return normalizeSocial(raw, brief, 'Gemini 3.8 Flash');
    } catch (e: any) {
      return { caption: '', thread: [], hashtags: [], provider: 'Gemini 3.8 Flash', warnings: [e?.message ?? 'Generation failed.'] };
    }
  }
  await new Promise((r) => setTimeout(r, 500));
  return normalizeSocial(mockSocial(brief), brief, 'Draft engine (offline)');
}
