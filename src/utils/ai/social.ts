import * as FileSystem from 'expo-file-system/legacy';
import { THREAD_CAPS } from '../thread';
import { getAiKey, getOpenAiKey } from './key';
import { openaiSocialRaw, openaiChatJson, OPENAI_PROVIDER } from './openai';
import { AiLanguage } from './types';

/**
 * Caption + thread writer.
 *
 * Contract v2 — the model does the thinking, the UI stays quiet:
 *  - one idea in → voice / style / structure / length are inferred (Auto)
 *  - optional multi-platform output: same facts, adapted presentation per channel
 *  - optional live web research (Google Search grounding) for time-sensitive news,
 *    with confirmed-fact vs claim separation and source links
 *  - every result is clamped to platform caps afterwards — never trusted
 *
 * The legacy `caption` / `thread` / `hashtags` fields stay on SocialResult so the
 * composer keeps working untouched.
 */

const MODEL = 'gemini-3.8-flash';
const endpoint = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

export type SocialPlatform =
  | 'any' | 'x' | 'bluesky' | 'threads' | 'mastodon'
  | 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'pinterest';

/** 'auto' lets the model pick the voice. All voices sit side by side — no hidden rows. */
export type SocialTone = 'auto' | 'story' | 'punchy' | 'friendly' | 'professional' | 'bold';

export const SOCIAL_TONES: { id: SocialTone; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'story', label: 'Story' },
  { id: 'punchy', label: 'Punchy' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'professional', label: 'Pro' },
  { id: 'bold', label: 'Bold' },
];

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: 'any', label: 'All channels' },
  { id: 'x', label: 'X' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'threads', label: 'Threads' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'pinterest', label: 'Pinterest' },
];

/** How each destination wants to be written — the core message stays identical. */
export const PLATFORM_ADAPT: Record<SocialPlatform, string> = {
  any: 'write for a general social feed',
  x: 'concise and punchy, one idea, no wasted words',
  threads: 'conversational and warm, thread-native, room to breathe',
  bluesky: 'casual and curious, community-minded, low hype',
  mastodon: 'thoughtful and grounded, no engagement-bait, no growth-hack tone',
  linkedin: 'professional and insight-led, land the business implication',
  facebook: 'readable and conversational for a broad audience',
  instagram: 'caption-friendly with clean line breaks, strong first line',
  tiktok: 'hook-led spoken-script energy, says it out loud well',
  youtube: 'title/description friendly, searchable phrasing, plain sentences',
  pinterest: 'descriptive and keyword-rich, idea-led, no slang',
};

/** Caption limits for channels that aren't chain-capable (joined text length). */
const TEXT_CAPS: Partial<Record<SocialPlatform, number>> = {
  facebook: 63206,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 800,
};

export type SocialStyle =
  | 'auto' | 'breaking' | 'thread' | 'listicle' | 'teardown' | 'deepdive'
  | 'compare' | 'casestudy' | 'postmortem' | 'roundup' | 'hottake' | 'question';

export interface SocialStyleMeta { id: SocialStyle; label: string; hint: string; sample: string; sampleMs: string; sampleZh: string; sampleTa: string }

export const SOCIAL_STYLES: SocialStyleMeta[] = [
  { id: 'auto', label: 'Auto', hint: 'Pick the best fit',
    sample: 'The AI commits to whatever structure fits your idea best.',
    sampleMs: 'AI akan pilih struktur yang paling sesuai dengan idea anda.',
    sampleZh: 'AI 会为你的想法选择最合适的结构。',
    sampleTa: 'உங்கள் யோசனைக்கு ஏற்ற அமைப்பை AI தேர்ந்தெடுக்கும்.' },
  { id: 'breaking', label: 'Breaking', hint: 'Urgent news update',
    sample: 'JUST IN: Council passes the transit bill 7–2. It takes effect in March — here is what changes.',
    sampleMs: 'TERKINI: Majlis meluluskan rang undang-undang transit 7–2. Berkuat kuasa Mac — ini yang berubah.',
    sampleZh: '突发：市议会以7比2通过交通法案，三月生效——以下是变化。',
    sampleTa: 'அவசரம்: போக்குவரத்து மசோதா 7–2 என நிறைவேறியது. மார்ச் முதல் அமல் — மாற்றங்கள் இவை.' },
  { id: 'thread', label: 'Deep thread', hint: 'Story, one idea per post',
    sample: 'I wasted 2 years overthinking content. Here is the system that actually works:',
    sampleMs: 'Saya bazirkan 2 tahun fikir pasal kandungan. Ini sistem yang betul-betul berkesan:',
    sampleZh: '我花了两年时间纠结内容。这是真正有效的方法：',
    sampleTa: 'உள்ளடக்கத்தைப் பற்றி யோசித்து 2 ஆண்டுகளை வீணாக்கினேன். உண்மையில் வேலை செய்யும் முறை இது:' },
  { id: 'listicle', label: 'Listicle', hint: 'Saveable value stack',
    sample: '5 free tools that cut my editing time in half — save this:',
    sampleMs: '5 alat percuma yang potong separuh masa suntingan saya — simpan ini:',
    sampleZh: '5 个免费工具让我的剪辑时间减半——收藏：',
    sampleTa: 'எனது எடிட்டிங் நேரத்தை பாதியாகக் குறைத்த 5 இலவச கருவிகள் — சேமியுங்கள்:' },
  { id: 'teardown', label: 'Teardown', hint: 'Feature → business value',
    sample: 'This checkout added one button and lifted sales 18%. Teardown:',
    sampleMs: 'Checkout ini tambah satu butang dan naikkan jualan 18%. Ulasan:',
    sampleZh: '这个结账页加了一个按钮，销量提升18%。拆解：',
    sampleTa: 'இந்த செக்அவுட் ஒரு பொத்தானைச் சேர்த்து விற்பனையை 18% உயர்த்தியது. அலசல்:' },
  { id: 'deepdive', label: 'Tech dive', hint: 'How it works, in layers',
    sample: 'How your feed loads in 200ms without falling over: requests → ranking → cache.',
    sampleMs: 'Macam mana feed dimuat dalam 200ms tanpa gagal: permintaan → ranking → cache.',
    sampleZh: '你的信息流如何在200毫秒内加载而不崩溃：请求→排序→缓存。',
    sampleTa: 'உங்கள் ஃபீட் 200ms-இல் செயலிழக்காமல் ஏற்றுவது எப்படி: கோரிக்கை → தரவரிசை → கேச்.' },
  { id: 'compare', label: 'X vs Y', hint: 'Old way vs modern way',
    sample: 'Posting daily vs posting well — the difference:',
    sampleMs: 'Pos setiap hari vs pos yang berkualiti — bezanya:',
    sampleZh: '天天发和发得好——区别在这里：',
    sampleTa: 'தினமும் பதிவிடுவது vs நன்றாகப் பதிவிடுவது — வித்தியாசம்:' },
  { id: 'casestudy', label: 'Case study', hint: 'Metric-led social proof',
    sample: 'How a 12-person team cut churn 31% in 60 days:',
    sampleMs: 'Macam mana pasukan 12 orang potong churn 31% dalam 60 hari:',
    sampleZh: '一个12人团队如何在60天内将流失率降低31%：',
    sampleTa: '12 பேர் குழு 60 நாட்களில் வாடிக்கையாளர் விலகலை 31% குறைத்தது எப்படி:' },
  { id: 'postmortem', label: 'Post-mortem', hint: 'Honest failure lesson',
    sample: 'We shut down our first product. Honest post-mortem:',
    sampleMs: 'Kami tutup produk pertama kami. Post-mortem yang jujur:',
    sampleZh: '我们关闭了第一个产品。诚实的复盘：',
    sampleTa: 'எங்கள் முதல் தயாரிப்பை மூடிவிட்டோம். நேர்மையான பின்பார்வை:' },
  { id: 'roundup', label: 'Roundup', hint: 'Curated resource vault',
    sample: '6 years of lessons, 7 resources that save you 100+ hours:',
    sampleMs: '6 tahun pengajaran, 7 sumber yang jimatkan 100+ jam anda:',
    sampleZh: '6 年的经验，7 个为你节省 100+ 小时的资源：',
    sampleTa: '6 ஆண்டு பாடங்கள், 100+ மணிநேரத்தை மிச்சப்படுத்தும் 7 வளங்கள்:' },
  { id: 'hottake', label: 'Hot take', hint: 'Debate-sparking opinion',
    sample: 'Unpopular opinion: follower count is a vanity metric.',
    sampleMs: 'Pendapat tak popular: jumlah follower cuma metrik vanity.',
    sampleZh: '不受欢迎的观点：粉丝数只是虚荣指标。',
    sampleTa: 'பிரபலமற்ற கருத்து: பின்தொடர்பவர் எண்ணிக்கை வெறும் பகட்டு அளவீடு.' },
  { id: 'question', label: 'Question', hint: 'Opens by asking',
    sample: 'Be honest: how many of your scheduled posts actually get read?',
    sampleMs: 'Jujur: berapa banyak pos berjadual anda yang betul-betul dibaca?',
    sampleZh: '说实话：你定时发布的帖子，有多少真的有人看？',
    sampleTa: 'நேர்மையாக: உங்கள் திட்டமிட்ட பதிவுகளில் எத்தனை உண்மையில் படிக்கப்படுகின்றன?' },
];

/** Style example in the reader's language (verified set, English fallback). */
export function styleSampleFor(s: SocialStyleMeta, language: string): string {
  if (language === 'Bahasa Melayu') return s.sampleMs;
  if (language === '中文') return s.sampleZh;
  if (language === 'Tamil') return s.sampleTa;
  return s.sample;
}

/** Thread posts must feel substantial: floor per post (X's 280 cap still fits above it). */
export const THREAD_POST_MIN = 230;

/** Only these channels support native reply-chains — the thread destination set. */
export const THREAD_PLATFORM_IDS: SocialPlatform[] = ['x', 'threads', 'mastodon', 'bluesky'];

/** Styles that only make sense as multi-post threads. */
export const THREAD_STYLES: SocialStyle[] = ['thread', 'deepdive'];

/** Auto-research switches. `auto` = the engine decides from the topic. */
export type Toggle = 'auto' | 'on' | 'off';

export interface SocialBrief {
  prompt: string;
  /** 'auto' mirrors the idea; otherwise any language id from WRITER_LANGUAGES */
  language: string;
  tone: SocialTone;
  /** content playbook; 'auto' lets the model commit to the best fit */
  style: SocialStyle;
  /** true = write a connected thread; false = one caption */
  thread: boolean;
  /** target number of thread posts */
  parts: number;
  hashtags: boolean;
  /** one or more destinations; the model adapts the presentation for each */
  platforms: SocialPlatform[];
  /** live web research for time-sensitive topics */
  research: Toggle;
  /** attach source links when research ran */
  sources: Toggle;
  emoji: 'auto' | 'on' | 'off';
  /** include a soft call-to-action */
  cta: boolean;
  /** free-form extra direction from the user */
  instructions: string;
}

export interface SocialSource {
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
}

export interface SocialVariant {
  platform: SocialPlatform;
  /** ordered posts; for a single caption this is a one-item array */
  posts: string[];
}

/** One attachment on a result post: an AI-made image (remote URL) or the user's own upload (local file). */
export interface SocialSegmentMedia {
  uri: string;
  kind: 'image' | 'video';
}

export interface SocialGeneration {
  contentType: 'post' | 'thread';
  styleUsed: SocialStyle;
  voiceUsed: SocialTone;
  language: string;
}

export interface SocialResult {
  /** single-post copy (when thread mode, this is the head post) */
  caption: string;
  /** thread segments, in order (empty when not threading) */
  thread: string[];
  hashtags: string[];
  provider: string;
  warnings: string[];
  /** what the model actually decided in Auto mode */
  generation: SocialGeneration;
  /** per-platform adapted output (always ≥ 1 entry) */
  variants: SocialVariant[];
  sources: SocialSource[];
  researchUsed: boolean;
  /** conflicting / unconfirmed details the user should check before publishing */
  uncertainties: string[];
  /** per-post attachments for the ACTIVE variant at apply time (posts-aligned, may be sparse) */
  segmentMedia?: SocialSegmentMedia[][];
}

export const DEFAULT_SOCIAL_BRIEF: SocialBrief = {
  prompt: '',
  language: 'auto',
  tone: 'auto',
  style: 'auto',
  thread: false,
  parts: 5,
  hashtags: false,
  platforms: ['any'],
  research: 'auto',
  sources: 'auto',
  emoji: 'auto',
  cta: false,
  instructions: '',
};

const CAPTION_MAX = 2200;

/**
 * Character budget for the copy we hand back.
 * - thread: strictest chain limit (X's 280 for "any").
 * - single caption: the platform's caption cap, or ~2200 for an unspecified destination.
 */
export function capFor(platform: SocialPlatform, thread = false): number {
  if (platform === 'any') return thread ? THREAD_CAPS.x : CAPTION_MAX;
  if (thread) return THREAD_CAPS[platform] ?? TEXT_CAPS[platform] ?? 280;
  return TEXT_CAPS[platform] ?? THREAD_CAPS[platform] ?? CAPTION_MAX;
}

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

/** Download a remote picture into the app cache so the composer owns a local file. Null on any failure. */
export async function fetchCoverImage(url: string, seed: number): Promise<string | null> {
  try {
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    if (!base) return null;
    const dir = `${base}ai-covers/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = `${dir}cover-${Date.now()}-${seed}.jpg`;
    const dl = await FileSystem.downloadAsync(url, dest);
    if (dl.status !== 200) {
      await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
      return null;
    }
    return dl.uri;
  } catch {
    return null;
  }
}

/* ---------------- platform set helpers ---------------- */

const KNOWN = new Set<SocialPlatform>(SOCIAL_PLATFORMS.map((p) => p.id));

/** Deduped, validated destinations. Falls back to ['any'] so generation always has a target. */
export function activePlatforms(brief: SocialBrief): SocialPlatform[] {
  const seen = new Set<SocialPlatform>();
  const out: SocialPlatform[] = [];
  for (const p of brief.platforms ?? []) {
    if (!KNOWN.has(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out.length ? out : ['any'];
}

/** Resolved single platform for a variant slot. */
function asPlatform(v: unknown, fallback: SocialPlatform): SocialPlatform {
  return typeof v === 'string' && KNOWN.has(v as SocialPlatform) ? (v as SocialPlatform) : fallback;
}

/* ---------------- news / research detection ---------------- */

const NEWS_HINTS =
  /\b(today|tonight|yesterday|breaking|news|just\s+(in|now|launched|announced|released|confirmed)|launch(ed|es)?|announce[ds]?|unveil(s|ed)?|attack(ed|s)?|under attack|war|election|ceasefire|missile|strike[s]?|sanction(s|ed)?|killed|died|dead|resign(s|ed|ation)?|sue[ds]?|lawsuit|ipo|earnings|tariff|tax(es)?|ban(ned|s)?|recall(ed|s)?|outage|hack(ed|s)?|leak(ed|s)?|report(s|ed)?|crash(ed|es)?|plunge[ds]?|surge[ds]?|available now|2025|2026)\b/i;

/** Whether this brief should hit the live web. `auto` sniffs the topic for time-sensitivity. */
export function researchNeeded(brief: SocialBrief): boolean {
  if (brief.research === 'on') return true;
  if (brief.research === 'off') return false;
  return NEWS_HINTS.test(brief.prompt);
}

/** Whether source links should be attached. */
export function sourcesNeeded(brief: SocialBrief, usedResearch: boolean): boolean {
  if (!usedResearch) return false;
  if (brief.sources === 'on') return true;
  if (brief.sources === 'off') return false;
  return true;
}

/* ---------------- normalization ---------------- */

const HASH_STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'about', 'from', 'into', 'when',
  'what', 'how', 'why', 'are', 'was', 'were', 'will', 'can', 'not', 'but', 'our', 'their', 'them',
  'have', 'has', 'had', 'been', 'just', 'like', 'more', 'most', 'some', 'one', 'out', 'get', 'got',
]);

/** Meaningful latin-script words, in order of appearance (drives hashtags + stock keywords). */
function contentWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words(text.toLowerCase()).map((x) => x.replace(/[^a-z0-9]/g, ''))) {
    if (!w || w.length < 4 || HASH_STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

function deriveHashtags(prompt: string, n = 4): string[] {
  return contentWords(prompt).slice(0, n).map((w) => '#' + w);
}

function normHashtags(raw: unknown, brief: SocialBrief): string[] {
  if (!brief.hashtags) return [];
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const t = clean(item).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, '');
    if (!t) continue;
    const tag = '#' + t;
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= 5) break;
  }
  return out;
}

function normSources(raw: unknown): SocialSource[] {
  if (!Array.isArray(raw)) return [];
  const out: SocialSource[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as any;
    const url = clean(o.url);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title: clean(o.title) || url,
      url,
      publisher: clean(o.publisher) || undefined,
      publishedAt: clean(o.published_at) || undefined,
    });
    if (out.length >= 5) break;
  }
  return out;
}

function normUncertainties(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => clean(s)).filter(Boolean).slice(0, 4);
}

/** Pull the ordered post list out of a model response, whichever shape it used. */
function rawPosts(v: any): string[] {
  const list = Array.isArray(v?.posts) ? v.posts : Array.isArray(v?.thread) ? v.thread : [];
  return list.map((s: unknown) => stripNumbering(clean(s))).filter(Boolean);
}

const STYLE_IDS = new Set<string>(SOCIAL_STYLES.map((s) => s.id));
const VOICE_IDS = new Set<string>(SOCIAL_TONES.map((t) => t.id));

function resolveGeneration(raw: any, brief: SocialBrief, isThread: boolean): SocialGeneration {
  const s = clean(raw?.style_used).toLowerCase();
  const v = clean(raw?.voice_used).toLowerCase();
  return {
    contentType: isThread ? 'thread' : 'post',
    styleUsed: (brief.style !== 'auto' ? brief.style : STYLE_IDS.has(s) ? (s as SocialStyle) : 'auto'),
    voiceUsed: (brief.tone !== 'auto' ? brief.tone : VOICE_IDS.has(v) && v !== 'auto' ? (v as SocialTone) : 'auto'),
    language: brief.language === 'auto' ? clean(raw?.language) || 'auto' : brief.language,
  };
}

/** Clamp a variant's posts to its own platform cap, reporting whether anything moved. */
function clampVariant(posts: string[], platform: SocialPlatform, thread = false): { posts: string[]; clamped: boolean } {
  const limit = capFor(platform, thread);
  let clamped = false;
  const out = posts.map((s) => {
    if (s.length <= limit) return s;
    clamped = true;
    return clampChars(s, limit);
  });
  return { posts: out, clamped };
}

/** Clamp a model/offline response into something the composer can always use. */
export function normalizeSocial(raw: any, brief: SocialBrief, provider: string): SocialResult {
  const warnings: string[] = [];
  const platforms = activePlatforms(brief);
  const wantsThread = brief.thread;

  // --- variants: prefer explicit per-platform output, otherwise build from `posts` ---
  let variants: SocialVariant[] = [];
  if (Array.isArray(raw?.variants)) {
    for (const v of raw.variants) {
      const platform = asPlatform(v?.platform, platforms[0]);
      const posts = rawPosts(v);
      if (posts.length) variants.push({ platform, posts });
    }
  }
  if (!variants.length) variants.push({ platform: platforms[0], posts: rawPosts(raw) });

  // A caption is a single post: fold any stray segments back into one block per platform.
  if (!wantsThread) {
    variants = variants.map((v) => ({ platform: v.platform, posts: v.posts.length ? [v.posts.join('\n\n')] : [] }));
  }

  let anyClamped = false;
  variants = variants.map((v) => {
    const { posts, clamped } = clampVariant(v.posts, v.platform, wantsThread);
    if (clamped) anyClamped = true;
    return { platform: v.platform, posts };
  });
  const meaningful = variants.filter((v) => v.posts.length);
  if (meaningful.length) variants = meaningful;
  if (anyClamped) warnings.push('Some posts were trimmed to fit the platform character limit.');

  const primary = variants[0];
  const isThread = wantsThread && primary.posts.length > 1;

  let caption: string;
  let thread: string[];
  if (isThread) {
    thread = primary.posts.slice(0, Math.max(2, Math.min(12, brief.parts)));
    if (primary.posts.length > thread.length) warnings.push(`Trimmed the thread to ${thread.length} posts.`);
    const short = thread.map((p, i) => (p.length < THREAD_POST_MIN ? i + 1 : 0)).filter(Boolean);
    if (short.length) warnings.push(`Post${short.length > 1 ? 's' : ''} ${short.slice(0, 4).join(', ')} came back under ${THREAD_POST_MIN} characters — expand ${short.length > 1 ? 'them' : 'it'} or Regenerate.`);
    caption = thread[0] ?? '';
  } else {
    thread = [];
    caption = primary.posts.join('\n\n');
    if (caption.length > CAPTION_MAX) {
      caption = clampChars(caption, CAPTION_MAX);
      warnings.push('The caption was trimmed — it was longer than any platform accepts.');
    }
    // Thread requested but the model returned 0–1 posts: never fail silently.
    if (wantsThread && primary.posts.length <= 1) {
      warnings.push(`Asked for a ${Math.max(2, Math.min(12, brief.parts))}-post thread but got a single post — tap Regenerate to try again.`);
    }
  }

  const hashtags = normHashtags(raw?.hashtags, brief);
  const sources = normSources(raw?.sources);
  const uncertainties = normUncertainties(raw?.uncertainties);
  const researchUsed = !!raw?.__researched || sources.length > 0;

  if (!caption && !thread.length && !hashtags.length) warnings.push('Nothing usable came back — try rephrasing the idea.');

  return {
    caption,
    thread,
    hashtags,
    provider,
    warnings,
    generation: resolveGeneration(raw, brief, isThread),
    variants,
    sources,
    researchUsed,
    uncertainties,
  };
}

/* ---------------- prompts ---------------- */

const STYLE_BLOCKS: Record<Exclude<SocialStyle, 'auto'>, string> = {
  breaking: [
    'STYLE: breaking news update. Open with a plain, accurate line — an alert marker (JUST IN / BREAKING / UPDATE) only if the facts justify it.',
    'Lead with what happened, where and when, then who confirmed it and what is still unclear. End with why it matters.',
    'Only state facts you can source. Attribute claims to who made them. Never upgrade a claim into a confirmed fact for impact.',
  ].join(' '),
  thread: [
    'STYLE: educational thread. Open with a hook that promises a payoff worth reading for.',
    'Move ONE idea per post in rising order; the last post lands a real takeaway.',
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
    'Unpack in layers: inputs → processing → storage/caching → edge cases. Close with a docs/blog pointer placeholder.',
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
    'Use only numbers from the idea. If there are no numbers, write it as a process story, not a results story.',
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
  question: [
    'STYLE: question-led post. Open with ONE sharp question that names the reader\'s pain or curiosity — no throat-clearing before it.',
    'Answer it in 2-3 short beats with a concrete payoff, then close with a genuine question that invites replies.',
    'Never stack multiple opening questions, and never use "Ever wondered…?", "What if I told you…?" or "Here\'s the truth:".',
  ].join(' '),
};

const HUMAN_RULES = [
  'HUMAN VOICE (non-negotiable): you sound like a person, never a brand deck.',
  'Banned words — never emit: delve, unpack, tapestry, landscape, paradigm, beacon, game-changer, revolutionary, testament, elevate, foster, seamless, unlock/unlocking, next-gen, synergize, supercharge, "in an era of", "in today\'s fast-paced world", "let\'s dive in", "here\'s everything you need to know".',
  'Banned constructions: "It\'s not X, it\'s Y" contrasts, "Here\'s the truth:" throat-clearing, "Ever wondered…?" openers, and "whether X, Y, or Z" triplets.',
  'Rhythm: alternate short punchy lines with medium explainers; break lines liberally; no paragraph longer than 3 lines. Do not overuse em dashes.',
  'Always use contractions (it\'s, don\'t, can\'t, you\'re, we\'ve). Open sentences with verbs or natural transitions (Look, Here\'s the thing, Honestly, Turns out).',
  'Show, don\'t tell: concrete specifics over adjectives ("cut render time from 450ms to 42ms", not "blazing fast").',
  'One idea per paragraph. Never repeat a point to fill space. Do not force a hook if the topic does not need one.',
  'At most ONE call-to-action per post or thread-close, and keep it soft — an invitation, not a demand.',
].join('\n');

const HONESTY_RULES = [
  'HONESTY: never invent metrics, quotes, names, studies, dates or links.',
  'If the idea gives you numbers, use them; if not, write around them — never fabricate.',
].join('\n');

const RESEARCH_RULES = [
  'RESEARCH: you have live web search. Use it for anything time-sensitive; do not rely on memory.',
  'Prefer recent, credible sources: Reuters, AP, AFP, BBC, official government statements, official company statements, primary documents, reputable local reporting.',
  'Separate CONFIRMED FACT from CLAIM from ANALYSIS from UNVERIFIED REPORT. Attribute each claim to who made it ("X claimed…", "authorities confirmed…").',
  'Never turn an allegation into a confirmed fact. If sources conflict, say so plainly in `uncertainties`.',
  'Include the relevant date/time when it helps. Discard outdated information.',
  'Return the sources you actually used in `sources` (real URLs only — never invent one).',
].join('\n');

function emojiRule(brief: SocialBrief): string {
  if (brief.emoji === 'off') return 'Emoji: none at all.';
  if (brief.emoji === 'on') return 'Emoji: sparing — at most one per post, structural only (🚨 ❌ ✅ 👇), never mid-sentence, never as word substitutes.';
  return 'Emoji: only if the topic and platform genuinely call for them — otherwise none. Never mid-sentence, never as word substitutes.';
}

function languageRule(brief: SocialBrief): string {
  if (brief.language !== 'auto') return `Write everything in ${brief.language}.`;
  return [
    "LANGUAGE: match the language of the user's idea exactly.",
    'If it is Malaysian Malay, write natural Malaysian Malay — never convert it to Indonesian (use kau/korang/sebenarnya/benda ni/macam mana/tak semestinya/sebab tu naturally, not as decoration).',
    'If it is English, write natural English. If it is mixed Malay + English, preserve that natural mix.',
    'Match their formality level; never force slang, never overdo it.',
  ].join(' ');
}

function platformsLine(platforms: SocialPlatform[]): string {
  if (platforms.length === 1 && platforms[0] === 'any') {
    return 'DESTINATIONS: general — write one version that works anywhere.';
  }
  const parts = platforms.map((p) => `${p} (${PLATFORM_ADAPT[p]})`);
  if (platforms.length === 1) return `DESTINATION: ${parts[0]}.`;
  return [
    `DESTINATIONS: ${parts.join('; ')}.`,
    'Write ONE entry in `variants` per destination above. Keep the facts and core message identical across them — only the presentation changes (length, tone, structure, opening).',
  ].join(' ');
}

const THREAD_STRUCTURES = [
  'Thread shapes (adapt, do not force): breaking news → what happened / what we know / what is confirmed / what is unclear / why it matters / sources; story → hook / setup / tension / turning point / lesson / payoff; case study → result / background / what they did / why it worked / what most miss / takeaway.',
  'Every post must earn its place. Never split one paragraph into arbitrary posts.',
].join(' ');

function buildPrompt(brief: SocialBrief, opts: { platforms: SocialPlatform[]; limit: number; research: boolean; sources: boolean }): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    'You are a sharp social-media writer who sounds like a real person, never like a brand or a press release.',
    `Today is ${today}.`,
    languageRule(brief),
    brief.tone === 'auto'
      ? 'VOICE: choose the voice that best fits this idea, platform and style, and commit to it fully.'
      : `Voice: ${brief.tone}.`,
    `The user's raw idea: "${brief.prompt}"`,
    brief.style === 'auto'
      ? 'STYLE: pick the single best-fit playbook for this idea (breaking news, educational thread, listicle, feature teardown, technical deep-dive, comparison, case study, post-mortem, resource roundup, or hot take) and commit to it fully.'
      : STYLE_BLOCKS[brief.style],
    platformsLine(opts.platforms),
    HUMAN_RULES,
    HONESTY_RULES,
    emojiRule(brief),
  ];

  if (opts.research) {
    lines.push(RESEARCH_RULES);
    lines.push(opts.sources
      ? 'Attach the sources you used in `sources` (real URLs only).'
      : 'Do not attach source links — return an empty sources array, and fold any essential attribution into the copy.');
  }

  if (brief.thread) {
    lines.push(
      `FORMAT: a NATURAL THREAD of EXACTLY ${brief.parts} connected posts — that count is a hard requirement, not a suggestion. One long post instead of a thread is a failure.`,
      'Open with a line that earns the next tap. One idea per post, rising order, real payoff in the last one.',
      THREAD_STRUCTURES,
      'Never number the posts, never write "1/", never use "🧵", never say "thread", "in this thread" or "let me explain". No hashtags inside the posts.',
      `BUDGET PER POST: at least ${THREAD_POST_MIN} characters and at most ${opts.limit}. Spend nearly the whole budget on every post — develop each point fully instead of writing short one-liners. Every post outside this range gets flagged.`,
    );
  } else {
    lines.push(
      'FORMAT: ONE tight caption — a strong first line, one or two beats of value, a soft close. No numbered lists unless the idea is genuinely a list.',
      `Keep it under ${opts.limit} characters, and shorter is better.`,
    );
  }

  if (brief.instructions.trim()) lines.push(`EXTRA DIRECTION from the user (follow it): ${brief.instructions.trim()}`);

  if (!brief.hashtags) lines.push('Return an empty hashtags array.');
  else lines.push('Hashtags: 3-5 relevant tags kept separate from the copy (no camel-case stuffing).');

  lines.push(
    `Return ONLY JSON with this shape: {"content_type":"post|thread","style_used":"...","voice_used":"...","language":"...","posts":["..."],"variants":[{"platform":"...","posts":["..."]}],"hashtags":["..."],"sources":[{"title":"...","url":"...","publisher":"...","published_at":"..."}],"uncertainties":["..."]}.`,
  );
  return lines.join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    content_type: { type: 'string' },
    style_used: { type: 'string' },
    voice_used: { type: 'string' },
    language: { type: 'string' },
    posts: { type: 'array', items: { type: 'string' } },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: { platform: { type: 'string' }, posts: { type: 'array', items: { type: 'string' } } },
        required: ['platform', 'posts'],
      },
    },
    hashtags: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          publisher: { type: 'string' },
          published_at: { type: 'string' },
        },
        required: ['title', 'url'],
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
  required: ['posts'],
};

async function callModel(key: string, prompt: string, schema: unknown | null, grounding: boolean): Promise<any> {
  const body: any = {
    systemInstruction: { parts: [{ text: 'You output strict JSON only. No markdown fences, no commentary.' }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // NOTE: Gemini 3.6+ dropped the sampling knobs (temperature/top_p/top_k) —
    // sending them returns 400, so only schema + token budget go out.
    generationConfig:
      schema && !grounding
        ? { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 4096 }
        : { responseMimeType: 'text/plain', maxOutputTokens: 4096 },
  };
  if (grounding) body.tools = [{ google_search: {} }];

  const r = await fetch(endpoint(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(humanErr(j));
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The model returned unusable JSON — try again.');
  return JSON.parse(m[0]);
}

/** Prompt + research flag both engines share — one computation, no drift. */
function socialPromptArgs(brief: SocialBrief): { prompt: string; research: boolean } {
  const platforms = activePlatforms(brief);
  const limit = Math.min(...platforms.map((p) => capFor(p, brief.thread)));
  const research = researchNeeded(brief);
  return {
    prompt: buildPrompt(brief, { platforms, limit, research, sources: sourcesNeeded(brief, research) }),
    research,
  };
}

export async function geminiSocial(brief: SocialBrief, key: string): Promise<any> {
  const { prompt, research } = socialPromptArgs(brief);
  const raw = await callModel(key, prompt, SCHEMA, research);
  return { ...raw, __researched: research };
}

function humanErr(j: any): string {
  const msg = String(j?.error?.message ?? '');
  if (/API key/i.test(msg)) return 'That API key was rejected — check it and try again.';
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(msg)) return 'Rate limit hit — wait a minute and retry.';
  if (/UNAVAILABLE|overload|503|high demand/i.test(msg)) return 'The model is busy right now — try again in a moment.';
  if (/SAFETY|blocked/i.test(msg)) return 'The model declined this one — rephrase the idea and try again.';
  if (/fetch|network|Failed to fetch|timeout/i.test(msg)) return 'Couldn\'t reach the AI. Check your connection and try again.';
  return msg || 'Something went wrong while writing your post.';
}

/* ---------------- offline path ---------------- */

/** Deterministic, human-sounding stand-in so the flow works with no key. */
export function mockSocial(brief: SocialBrief): any {
  const topic = clean(brief.prompt) || 'your idea';
  const t = topic.replace(/[.!?]+$/, '');
  const hooks: Record<SocialTone, string> = {
    auto: `Here's what actually changed my mind about ${t}.`,
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
  const platforms = activePlatforms(brief);
  const n = brief.thread ? Math.max(2, Math.min(beats.length, brief.parts)) : 1;
  const posts = brief.thread ? beats.slice(0, n) : [beats[0], beats[2], beats[4]].join('\n\n').split('\n\n');
  const variants = platforms.map((platform) => ({ platform, posts }));
  return {
    content_type: brief.thread ? 'thread' : 'post',
    style_used: brief.style === 'auto' ? 'thread' : brief.style,
    voice_used: brief.tone === 'auto' ? 'story' : brief.tone,
    posts,
    variants,
    hashtags: deriveHashtags(topic),
    sources: [],
    uncertainties: [],
    __researched: false,
  };
}

/* ---------------- entry point ---------------- */

export type SocialPhase = 'research' | 'write' | 'adapt' | 'finalize';
export type PhaseHandler = (phase: SocialPhase) => void;

export async function generateSocial(brief: SocialBrief, onPhase?: PhaseHandler): Promise<SocialResult> {
  // OpenAI first when its key exists, Gemini next, offline draft engine last.
  const oKey = await getOpenAiKey();
  const gKey = oKey ? null : await getAiKey();
  const engine: 'openai' | 'gemini' | null = oKey ? 'openai' : gKey ? 'gemini' : null;
  if (!engine) {
    onPhase?.('write');
    await new Promise((r) => setTimeout(r, 450));
    return normalizeSocial(mockSocial(brief), brief, 'Draft engine (offline)');
  }
  const key = (engine === 'openai' ? oKey : gKey) as string;
  const label = engine === 'openai' ? OPENAI_PROVIDER : 'Gemini 3.8 Flash';

  const runOnce = async (b: SocialBrief) => {
    if (engine === 'openai') {
      const { prompt, research } = socialPromptArgs(b);
      const raw = { ...(await openaiSocialRaw(prompt, research, key)), __researched: research };
      return { raw, research };
    }
    const raw = await geminiSocial(b, key);
    return { raw, research: researchNeeded(b) };
  };

  const research = researchNeeded(brief);
  const platforms = activePlatforms(brief);
  try {
    if (research) onPhase?.('research');
    onPhase?.('write');
    let { raw } = await runOnce(brief);
    if (platforms.length > 1) onPhase?.('adapt');
    onPhase?.('finalize');

    // Research was requested but search came back empty → say so, never imply we checked.
    if (research && !(Array.isArray(raw.sources) && raw.sources.length) && !raw.uncertainties?.length) {
      raw = { ...raw, uncertainties: ['Live research returned no sources — verify the facts before publishing.'] };
    }
    return normalizeSocial(raw, brief, research ? `${label} + Search` : label);
  } catch (e: any) {
    // If the grounded pass failed, retry straight generation so the user still gets copy —
    // with an honest warning that research did not run.
    if (research) {
      try {
        const { raw } = await runOnce({ ...brief, research: 'off' });
        const result = normalizeSocial(raw, brief, label);
        return { ...result, researchUsed: false, warnings: ['Live research is temporarily unavailable — this was written without it.', ...result.warnings] };
      } catch {
        /* fall through to the shared error result */
      }
    }
    return {
      caption: '', thread: [], hashtags: [], provider: label,
      warnings: [e?.message ?? 'Something went wrong while writing your post.'],
      generation: { contentType: brief.thread ? 'thread' : 'post', styleUsed: brief.style, voiceUsed: brief.tone, language: brief.language },
      variants: [], sources: [], researchUsed: false, uncertainties: [],
    };
  }
}

/* ---------------- targeted rewrites ---------------- */

export type RewriteOp = 'shorter' | 'punchier' | 'natural' | 'context' | 'tone' | 'style';

const REWRITE_ASKS: Record<RewriteOp, string> = {
  shorter: 'Make every post noticeably shorter. Cut filler, keep every fact.',
  punchier: 'Make it punchier: stronger verbs, tighter lines, sharper first words. Keep the meaning.',
  natural: 'Make it sound more natural and human — vary sentence length, remove anything that reads like AI.',
  context: 'Add useful context or a concrete example to each point. Do not invent facts.',
  tone: 'Rewrite with a different, more fitting voice for this idea and platform.',
  style: 'Restructure it with a different approach while keeping the same facts and message.',
};

/** Rewrite an existing set of posts in place (targeted transform). Facts must survive. */
export async function rewritePosts(
  posts: string[],
  brief: SocialBrief,
  op: RewriteOp,
): Promise<{ posts: string[]; warning?: string }> {
  const oKey = await getOpenAiKey();
  const gKey = oKey ? null : await getAiKey();
  if (!oKey && !gKey) return { posts, warning: 'Editing needs a live model — reconnect and try again.' };
  const limit = Math.min(...activePlatforms(brief).map((p) => capFor(p, brief.thread)));
  const prompt = [
    'You are editing an existing social post. Preserve ALL facts, names, numbers and meaning.',
    languageRule(brief),
    `Edit instruction: ${REWRITE_ASKS[op]}`,
    `Keep every post under ${limit} characters. Keep the same number of parts unless the instruction says otherwise.`,
    'Current posts:',
    ...posts.map((p, i) => `${i + 1}. ${p}`),
    'Return ONLY JSON: {"posts":["..."]}.',
  ].join('\n');
  try {
    const raw = oKey
      ? await openaiChatJson(oKey, 'You output strict JSON only. No markdown fences, no commentary.', prompt)
      : await callModel(gKey as string, prompt, {
        type: 'object',
        properties: { posts: { type: 'array', items: { type: 'string' } } },
        required: ['posts'],
      }, false);
    const out = rawPosts(raw);
    if (!out.length) return { posts, warning: 'The rewrite came back empty — kept your original.' };
    return { posts: clampVariant(out, activePlatforms(brief)[0], brief.thread).posts };
  } catch (e: any) {
    return { posts, warning: e?.message ?? 'Could not rewrite — kept your original.' };
  }
}
