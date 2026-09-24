import type { Block } from '@/content/types';

/**
 * Blog document helpers shared by the editor, the serializer and the public
 * page. BlockNote JSON is the stored model for new posts; legacy posts keep
 * the old Block[] model and are converted on open. Everything here is pure
 * (no React, no editor instance) so both client and server can use it.
 */

export interface InlineNode {
  type: 'text';
  text: string;
  styles?: { bold?: boolean; italic?: boolean };
}

export interface LinkNode {
  type: 'link';
  href: string;
  content: RichInline[];
}

export type RichInline = InlineNode | LinkNode;

export interface ChartPoint {
  label: string;
  value: number;
}

export type DocBlock = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
};

/* --------------------------- inline markdown --------------------------- */

/** Minimal inline-md → rich text: **bold**, *italic*, [label](url). */
export function parseInlineMd(text: string): RichInline[] {
  const out: RichInline[] = [];
  const linkRe = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  const emph = (chunk: string): RichInline[] => {
    const nodes: RichInline[] = [];
    const re = /(\*\*.+?\*\*|\*[^*\n]+?\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > last) nodes.push({ type: 'text', text: chunk.slice(last, m.index) });
      const tok = m[0];
      if (tok.startsWith('**')) {
        nodes.push({ type: 'text', text: tok.slice(2, -2), styles: { bold: true } });
      } else {
        nodes.push({ type: 'text', text: tok.slice(1, -1), styles: { italic: true } });
      }
      last = m.index + tok.length;
    }
    if (last < chunk.length) nodes.push({ type: 'text', text: chunk.slice(last) });
    return nodes;
  };
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) out.push(...emph(text.slice(last, m.index)));
    out.push({ type: 'link', href: m[2], content: emph(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...emph(text.slice(last)));
  return out;
}

/* --------------------------- legacy → BlockNote --------------------------- */

/** Convert a legacy Block[] post body into BlockNote JSON. */
export function legacyToBlocks(blocks: Block[]): DocBlock[] {
  const out: DocBlock[] = [];
  for (const b of blocks) {
    if (b.t === 'p' || b.t === 'h' || b.t === 'quote') {
      if (!b.c.trim()) continue;
      out.push({
        type: b.t === 'p' ? 'paragraph' : b.t === 'h' ? 'heading' : 'quote',
        props: b.t === 'h' ? { level: 1 } : {},
        content: parseInlineMd(b.c),
      });
    } else if (b.t === 'ul') {
      for (const item of b.c) {
        if (!item.trim()) continue;
        out.push({ type: 'bulletListItem', content: parseInlineMd(item) });
      }
    } else if (b.t === 'img') {
      if (!b.c.trim()) continue;
      out.push({ type: 'image', props: { url: b.c, caption: b.caption ?? '' } });
    } else if (b.t === 'video') {
      if (!b.c.trim()) continue;
      out.push({ type: 'socialEmbed', props: { url: b.c, caption: '' } });
    } else if (b.t === 'table') {
      const rows = b.c
        .map((r) => r.map((x) => x.trim()))
        .filter((r) => r.some((x) => x.length > 0));
      if (!rows.length) continue;
      out.push({
        type: 'table',
        content: {
          type: 'tableContent',
          columnWidths: rows[0].map(() => undefined),
          headerRows: b.head !== false && rows.length > 1 ? 1 : 0,
          rows: rows.map((r) => ({
            cells: r.map((c) => ({
              type: 'tableCell',
              props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
              content: [{ type: 'paragraph', content: parseInlineMd(c) }] as unknown,
            })),
          })),
        },
      });
    }
  }
  return out.length ? out : [{ type: 'paragraph', content: [] }];
}

/** Plain text of rich inline content (for word counts and fallbacks). */
export function inlineText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const node of content as Record<string, unknown>[]) {
    if (node.type === 'text') out += String(node.text ?? '');
    else if (node.type === 'link') out += inlineText(node.content);
  }
  return out;
}

/** Word count over a BlockNote document (tables count every cell). */
export function wordsOfDoc(blocks: DocBlock[]): number {
  let words = 0;
  const count = (s: string) => {
    words += s.split(/\s+/).filter(Boolean).length;
  };
  for (const b of blocks) {
    if (b.type === 'table' && b.content && typeof b.content === 'object') {
      const tc = b.content as { rows?: { cells?: { content?: unknown }[] }[] };
      for (const row of tc.rows ?? []) {
        for (const cell of row.cells ?? []) {
          const tc2 = cell.content as { content?: unknown }[] | undefined;
          for (const cellPar of tc2 ?? []) count(inlineText(cellPar?.content));
        }
      }
    } else if (b.type === 'chart') {
      count(String(b.props?.title ?? ''));
    } else if (b.type === 'socialEmbed') {
      count(String(b.props?.caption ?? ''));
    } else if (b.type === 'image') {
      count(String(b.props?.caption ?? ''));
    } else {
      count(inlineText(b.content));
    }
  }
  return words;
}

/* ------------------------------ chart data ------------------------------ */

export function parseChartData(json: unknown): ChartPoint[] {
  if (typeof json !== 'string' || !json.trim()) return [];
  try {
    const rows = JSON.parse(json) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => {
        const p = r as { label?: unknown; value?: unknown };
        return { label: String(p.label ?? ''), value: Number(p.value) || 0 };
      })
      .filter((p) => p.label.trim().length > 0)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function encodeChartData(points: ChartPoint[]): string {
  return JSON.stringify(points.filter((p) => p.label.trim().length > 0));
}
