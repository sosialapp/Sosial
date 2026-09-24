/**
 * Studio AI — web port of the mobile carousel writer contract
 * (src/utils/ai/types.ts + rules.ts + apply.ts). The model only ever decides
 * words + block shape; ids, colors, sizes and photos stay with the template.
 * Generation runs through the `generate-studio` edge function (key stays
 * server-side) and is clamped here before anything reaches the canvas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { uid, type BlockType, type ContentBlock, type PostPage } from './model';

/* --------------------------------- types --------------------------------- */

export type GenBlock =
  | { type: 'free'; heading?: string; lines: string[] }
  | { type: 'bullets'; heading?: string; items: string[] }
  | { type: 'numbered'; heading?: string; items: string[] }
  | { type: 'table'; heading?: string; columns: string[]; rows: string[][] }
  | { type: 'bar' | 'vbar' | 'pie'; heading?: string; series: { label: string; value: number }[] }
  | { type: 'image'; heading?: string };

export interface GenPage {
  blocks: GenBlock[];
  imagePrompt?: string;
}

export type AiLanguage = 'auto' | 'English' | 'Bahasa Melayu' | '中文' | 'Tamil';

export const AI_LANGUAGES: { id: AiLanguage; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'English', label: 'English' },
  { id: 'Bahasa Melayu', label: 'Melayu' },
  { id: '中文', label: '中文' },
  { id: 'Tamil', label: 'Tamil' },
];

export interface ContentBrief {
  prompt: string;
  /** 'auto' mirrors the prompt; otherwise a WRITER_LANGUAGES id */
  language: string;
  pages: number;
  maxWordsPerPage: number;
  maxBlocksPerPage: number;
}

export interface GenResult {
  pages: GenPage[];
  provider: string;
  warnings: string[];
}

export const DEFAULT_BRIEF: ContentBrief = {
  prompt: '',
  language: 'auto',
  pages: 3,
  maxWordsPerPage: 150,
  maxBlocksPerPage: 2,
};

/* --------------------------------- rules --------------------------------- */

export const RULES = {
  maxBlocksPerPage: 2,
  maxWordsPerPage: 150,
  maxWordsPerHeading: 6,
  maxBulletItems: 5,
  maxWordsPerItem: 12,
  maxTableRows: 4,
  maxTableCols: 3,
  maxChartPoints: 5,
  minChartPoints: 2,
  minPages: 1,
  maxPages: 10,
};

const normKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, '').replace(/\s+/g, ' ').trim();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const wordCount = (s: string) => words(s).length;
const clean = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

/** Keep the first n words, never cut mid-word. */
export function truncateWords(s: string, n: number): string {
  const w = words(s);
  return w.length <= n ? w.join(' ') : w.slice(0, n).join(' ') + '…';
}

function blockWords(b: GenBlock): number {
  let n = b.heading ? wordCount(b.heading) : 0;
  if (b.type === 'free') n += b.lines.reduce((a, s) => a + wordCount(s), 0);
  else if (b.type === 'bullets' || b.type === 'numbered') n += b.items.reduce((a, s) => a + wordCount(s), 0);
  else if (b.type === 'table') {
    n += b.columns.reduce((a, s) => a + wordCount(s), 0);
    n += b.rows.reduce((a, r) => a + r.reduce((x, c) => x + wordCount(c), 0), 0);
  } else if (b.type === 'bar' || b.type === 'vbar' || b.type === 'pie') {
    n += b.series.reduce((a, d) => a + wordCount(d.label), 0);
  }
  return n;
}

interface RawBlock {
  type?: unknown;
  heading?: unknown;
  items?: unknown;
  lines?: unknown;
  columns?: unknown;
  rows?: unknown;
  series?: unknown;
}
interface RawSeries {
  label?: unknown;
  value?: unknown;
}

function normalizeBlock(raw: RawBlock, warn: (m: string) => void, seen: Set<string>): GenBlock | null {
  if (!raw || typeof raw.type !== 'string') return null;
  const type = raw.type;
  const heading = raw.heading ? truncateWords(clean(raw.heading), RULES.maxWordsPerHeading) : undefined;

  if (type === 'free' || type === 'bullets' || type === 'numbered') {
    const src: unknown[] = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.lines) ? raw.lines : [];
    let items = src.map((s) => truncateWords(clean(s), RULES.maxWordsPerItem)).filter(Boolean);
    const before = items.length;
    items = items.filter((s) => {
      const k = normKey(s);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (items.length < before) warn('Removed repeated lines.');
    if (items.length > RULES.maxBulletItems) {
      warn(`Trimmed a ${type} block to ${RULES.maxBulletItems} lines.`);
      items = items.slice(0, RULES.maxBulletItems);
    }
    if (items.length === 0) return null;
    return type === 'free' ? { type: 'free', heading, lines: items } : { type, heading, items };
  }

  if (type === 'table') {
    const columns = Array.isArray(raw.columns)
      ? raw.columns.map((c) => truncateWords(clean(c), 4)).slice(0, RULES.maxTableCols)
      : [];
    let rows: string[][] = Array.isArray(raw.rows)
      ? raw.rows.map((r) => (Array.isArray(r) ? r : []).map((c) => truncateWords(clean(c), 4)).slice(0, RULES.maxTableCols))
      : [];
    if (rows.length > RULES.maxTableRows) {
      warn(`Trimmed a table to ${RULES.maxTableRows} rows.`);
      rows = rows.slice(0, RULES.maxTableRows);
    }
    if (columns.length === 0 && rows.length === 0) return null;
    return { type: 'table', heading, columns, rows };
  }

  if (type === 'bar' || type === 'vbar' || type === 'pie') {
    let series = Array.isArray(raw.series)
      ? (raw.series as RawSeries[])
          .map((d) => ({
            label: truncateWords(clean(d?.label), 3),
            // NOTE: Number('') === 0 — blank values must die, not become zero bars.
            value: d?.value === '' || d?.value == null ? NaN : Number(d?.value),
          }))
          .filter((d) => d.label && isFinite(d.value))
      : [];
    if (series.length > RULES.maxChartPoints) {
      warn(`Trimmed a chart to ${RULES.maxChartPoints} points.`);
      series = series.slice(0, RULES.maxChartPoints);
    }
    if (series.length < RULES.minChartPoints) {
      warn('Dropped a chart with too few values.');
      return null;
    }
    return { type, heading, series };
  }

  // Image slots render as empty placeholder boxes — photos belong to the editor.
  if (type === 'image') {
    warn('Dropped an image placeholder — add photos in the editor.');
    return null;
  }

  return null;
}

/** Clamp a model/mock response into something the canvas can always render. */
export function normalizeResult(pages: GenPage[], brief: ContentBrief, provider: string): GenResult {
  const warnings: string[] = [];
  let warnedBlocks = false;
  let warnedWords = false;
  let warnedRoles = false;

  const out: GenPage[] = [];
  const target = Math.max(RULES.minPages, Math.min(RULES.maxPages, brief.pages || 1));
  const input = pages.slice(0, target);
  const seen = new Set<string>();

  input.forEach((p, pi) => {
    let blocks: GenBlock[] = [];
    for (const raw of p.blocks ?? []) {
      const b = normalizeBlock(raw as RawBlock, (m) => {
        if (!warnedBlocks) {
          warnedBlocks = true;
          warnings.push(m);
        }
      }, seen);
      if (b) blocks.push(b);
      if (blocks.length >= brief.maxBlocksPerPage) break;
    }
    // Hook and takeaway cards stay text-only: charts/tables there are where
    // invented numbers hide. Never strand the card — strip only if text remains.
    if (input.length > 1 && (pi === 0 || pi === input.length - 1)) {
      const stripped = blocks.filter((b) => b.type !== 'table' && b.type !== 'bar' && b.type !== 'vbar' && b.type !== 'pie');
      if (stripped.length && stripped.length < blocks.length) {
        blocks = stripped;
        if (!warnedRoles) {
          warnedRoles = true;
          warnings.push('Hook and takeaway cards stay text-only — dropped their charts/tables.');
        }
      }
    }
    if (blocks.length === 0) return;

    let total = blocks.reduce((a, b) => a + blockWords(b), 0);
    if (total > brief.maxWordsPerPage) {
      warnedWords = true;
      for (let i = blocks.length - 1; i >= 0 && total > brief.maxWordsPerPage; i--) {
        const b = blocks[i];
        if (b.type === 'free' || b.type === 'bullets' || b.type === 'numbered') {
          const items = [...(b.type === 'free' ? b.lines : b.items)];
          while (items.length > 0 && total > brief.maxWordsPerPage) {
            items.pop();
            blocks[i] = b.type === 'free'
              ? { type: 'free', heading: b.heading, lines: items }
              : { type: b.type, heading: b.heading, items };
            total = blocks.reduce((a, x) => a + blockWords(x), 0);
          }
          if (items.length === 0) blocks.splice(i, 1);
        } else if (b.type === 'table') {
          const rows = [...b.rows];
          while (rows.length > 1 && total > brief.maxWordsPerPage) {
            rows.pop();
            blocks[i] = { type: 'table', heading: b.heading, columns: b.columns, rows };
            total = blocks.reduce((a, x) => a + blockWords(x), 0);
          }
        } else if (b.type === 'bar' || b.type === 'vbar' || b.type === 'pie') {
          const series = [...b.series];
          while (series.length > RULES.minChartPoints && total > brief.maxWordsPerPage) {
            series.pop();
            blocks[i] = { type: b.type, heading: b.heading, series };
            total = blocks.reduce((a, x) => a + blockWords(x), 0);
          }
        }
      }
    }
    if (blocks.length === 0) return;
    out.push({ blocks: blocks.slice(0, brief.maxBlocksPerPage), imagePrompt: p.imagePrompt });
  });

  if (warnedBlocks) warnings.push('Some blocks were trimmed to fit the card rules.');
  if (warnedWords) warnings.push(`Content trimmed to ${brief.maxWordsPerPage} words per card.`);
  if (out.length === 0) warnings.push('Nothing usable was generated — try a more specific topic.');

  return { pages: out, provider, warnings };
}

/** Public rule summary for the UI, so limits are never a surprise. */
export function rulesSummary(brief: ContentBrief): string {
  return `Max ${brief.maxBlocksPerPage} blocks and ${brief.maxWordsPerPage} words per card · up to ${RULES.maxPages} cards`;
}

/* -------------------------------- generate -------------------------------- */

/** Call the generate-studio edge function, then clamp the reply with the rules. */
export async function generateStudio(
  sb: SupabaseClient,
  brief: ContentBrief,
): Promise<GenResult> {
  const { data, error } = await sb.functions.invoke('generate-studio', {
    body: {
      prompt: brief.prompt,
      language: brief.language,
      pages: brief.pages,
      maxWordsPerPage: brief.maxWordsPerPage,
      maxBlocksPerPage: brief.maxBlocksPerPage,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { pages?: GenPage[]; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  return normalizeResult(payload?.pages ?? [], brief, 'AI');
}

/* --------------------------------- apply ---------------------------------- */

/** GenBlock → canvas ContentBlock. No colors/sizes: the template owns those. */
export function toContentBlock(b: GenBlock): ContentBlock {
  const id = uid('b');
  switch (b.type) {
    case 'free':
      return { id, type: 'free', heading: b.heading, items: b.lines };
    case 'bullets':
      return { id, type: 'bullets', heading: b.heading, items: b.items };
    case 'numbered':
      return { id, type: 'numbered', heading: b.heading, items: b.items };
    case 'table':
      return { id, type: 'table', heading: b.heading, items: [], table: [b.columns, ...b.rows] };
    case 'bar':
    case 'vbar':
    case 'pie':
      return { id, type: b.type as BlockType, heading: b.heading, items: [], chart: b.series };
    case 'image':
      return { id, type: 'image', heading: b.heading, items: [], imageAspect: 'square' };
  }
}

/**
 * Build the replacement page list: one page per generated page, each cloned
 * from the template so the *design* is untouched. Card height is auto — the
 * card hugs its generated content. Page ids are fresh; the caller swaps the
 * whole list in atomically.
 */
export function applyGenResult(gen: GenResult, template: PostPage): PostPage[] {
  return gen.pages.map((p) => {
    const page: PostPage = JSON.parse(JSON.stringify(template));
    page.id = uid('page');
    page.blocks = p.blocks.map(toContentBlock);
    page.cardH = null;
    page.cardAuto = true;
    page.cardY = page.cardY ?? 'bottom';
    return page;
  });
}
