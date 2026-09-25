import type { Block } from '@/content/types';

/**
 * Blog document helpers shared by the editor, the serializer and the public
 * page. TipTap JSON is the stored model for new posts; older BlockNote JSON
 * and legacy posts keep
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
/* (Removed with the TipTap swap — legacy bodies now convert straight to
 * TipTap via legacyToTipTap below. Old BlockNote JSON still in the database
 * converts via bnToTipTap.) */

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

/* ------------------------------ TipTap model ------------------------------ */

export interface TMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TNode[];
  text?: string;
  marks?: TMark[];
}

export interface TipTapDoc {
  type: 'doc';
  content: TNode[];
}

const isDocBlockArray = (v: unknown): v is DocBlock[] =>
  Array.isArray(v) && v.length > 0 && typeof (v[0] as DocBlock)?.type === 'string';

const isLegacyArray = (v: unknown): v is Block[] =>
  Array.isArray(v) && v.length > 0 && typeof (v[0] as { t?: unknown })?.t === 'string';

/** BlockNote/Legacy inline nodes → TipTap text nodes with marks. */
export function richInlineToTipTap(nodes: unknown): TNode[] {
  if (typeof nodes === 'string') {
    return nodes ? [{ type: 'text', text: nodes }] : [];
  }
  if (!Array.isArray(nodes)) return [];
  const out: TNode[] = [];
  for (const raw of nodes as Record<string, unknown>[]) {
    if (raw.type === 'text') {
      const styles = (raw.styles ?? {}) as { bold?: boolean; italic?: boolean };
      const marks: TMark[] = [];
      if (styles.bold) marks.push({ type: 'bold' });
      if (styles.italic) marks.push({ type: 'italic' });
      out.push({ type: 'text', text: String(raw.text ?? ''), ...(marks.length ? { marks } : {}) });
    } else if (raw.type === 'link') {
      for (const inner of richInlineToTipTapInner(raw.content)) {
        inner.marks = [...(inner.marks ?? []), { type: 'link', attrs: { href: String(raw.href ?? '#') } }];
        out.push(inner);
      }
    }
  }
  return out.filter((n) => (n.text ?? '').length > 0);
}

function richInlineToTipTapInner(nodes: unknown): TNode[] {
  if (typeof nodes === 'string') return nodes ? [{ type: 'text', text: nodes }] : [];
  if (!Array.isArray(nodes)) return [];
  return (nodes as Record<string, unknown>[]).flatMap((raw) => {
    if (raw.type !== 'text') return [];
    const styles = (raw.styles ?? {}) as { bold?: boolean; italic?: boolean };
    const marks: TMark[] = [];
    if (styles.bold) marks.push({ type: 'bold' });
    if (styles.italic) marks.push({ type: 'italic' });
    const text = String(raw.text ?? '');
    return text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : [];
  });
}

function tableCellToTipTap(cell: unknown): TNode {
  let inline: unknown = [];
  if (typeof cell === 'string') {
    inline = cell;
  } else if (cell && typeof cell === 'object') {
    const c = cell as { content?: unknown };
    // BlockNote 0.36 cells are either TableCell objects or raw inline arrays.
    inline = Array.isArray(c.content) && c.content.length > 0 && typeof (c.content[0] as { type?: unknown })?.type === 'string' &&
      ((c.content[0] as { type?: unknown }).type === 'text' || (c.content[0] as { type?: unknown }).type === 'link')
      ? c.content
      : (c.content as { content?: unknown }[] | undefined)?.flatMap?.((par) =>
          Array.isArray((par as { content?: unknown })?.content) ? ((par as { content?: unknown }).content as unknown[]) : [],
        ) ?? [];
  }
  const content = richInlineToTipTap(inline);
  return { type: 'tableCell', content: [{ type: 'paragraph', content }] };
}

/** One BlockNote block → TipTap nodes (lists stay flat here; grouped by the caller). */
function bnBlockToTipTap(b: DocBlock): TNode[] {
  const type = String(b.type ?? '');
  const props = (b.props ?? {}) as Record<string, unknown>;
  switch (type) {
    case 'heading':
      return [{ type: 'heading', attrs: { level: Number(props.level) || 1 }, content: richInlineToTipTap(b.content) }];
    case 'quote':
      return [{ type: 'blockquote', content: [{ type: 'paragraph', content: richInlineToTipTap(b.content) }] }];
    case 'bulletListItem':
    case 'numberedListItem':
      return [{ type: '__listItem', attrs: { ordered: type === 'numberedListItem' }, content: richInlineToTipTap(b.content) }];
    case 'image': {
      const url = String(props.url ?? '');
      if (!url) return [];
      return [{ type: 'image', attrs: { src: url, alt: '', title: String(props.caption ?? '') } }];
    }
    case 'video': {
      const url = String(props.url ?? '');
      if (!url) return [];
      return [{ type: 'socialEmbed', attrs: { url, caption: '' } }];
    }
    case 'socialEmbed': {
      const url = String(props.url ?? '').trim();
      if (!url) return [];
      return [{ type: 'socialEmbed', attrs: { url, caption: String(props.caption ?? '') } }];
    }
    case 'chart':
      return [{ type: 'chart', attrs: { kind: String(props.kind ?? 'bar'), title: String(props.title ?? ''), data: String(props.data ?? '') } }];
    case 'buttonLink': {
      const label = String(props.label ?? '').trim();
      const href = String(props.href ?? '').trim();
      if (!label || !href) return [];
      return [{ type: 'buttonLink', attrs: { label, href, image: String(props.image ?? ''), variant: String(props.variant ?? 'solid') } }];
    }
    case 'table': {
      const tc = b.content as { rows?: { cells?: unknown[] }[]; headerRows?: number } | undefined;
      const rows = (tc?.rows ?? [])
        .map((r) => (r.cells ?? []).map(tableCellToTipTap))
        .filter((r) => r.length > 0);
      if (!rows.length) return [];
      const headerRows = tc?.headerRows && tc.headerRows > 0 && rows.length > 1 ? 1 : 0;
      return [
        {
          type: 'table',
          content: rows.map((cells, ri) => ({
            type: 'tableRow',
            content: cells.map((cell) =>
              ri < headerRows ? { ...cell, type: 'tableHeader' } : cell,
            ),
          })),
        },
      ];
    }
    case 'divider':
      return [{ type: 'horizontalRule' }];
    case 'codeBlock':
      return [{ type: 'codeBlock', content: richInlineToTipTap(b.content) }];
    case 'paragraph':
    default: {
      const content = richInlineToTipTap(b.content);
      if (!content.length && type !== 'paragraph') return [];
      return [{ type: 'paragraph', content }];
    }
  }
}

/** BlockNote JSON → TipTap JSON (flat list items grouped into lists). */
export function bnToTipTap(blocks: DocBlock[]): TipTapDoc {
  const content: TNode[] = [];
  let openList: { ordered: boolean; items: TNode[] } | null = null;
  const flush = () => {
    if (!openList) return;
    content.push({
      type: openList.ordered ? 'orderedList' : 'bulletList',
      content: openList.items.map((it) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: (it.content ?? []) as TNode[] }],
      })),
    });
    openList = null;
  };
  for (const b of blocks) {
    for (const n of bnBlockToTipTap(b)) {
      if (n.type === '__listItem') {
        const ordered = Boolean(n.attrs?.ordered);
        if (!openList || openList.ordered !== ordered) {
          flush();
          openList = { ordered, items: [] };
        }
        openList.items.push(n);
      } else {
        flush();
        content.push(n);
      }
    }
  }
  flush();
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/** Legacy Block[] → TipTap JSON (for posts that predate BlockNote). */
export function legacyToTipTap(blocks: Block[]): TipTapDoc {
  const out: TNode[] = [];
  const inline = (text: string): TNode[] => richInlineToTipTap(parseInlineMd(text));
  for (const b of blocks) {
    if (b.t === 'p' || b.t === 'h' || b.t === 'quote') {
      if (!b.c.trim()) continue;
      if (b.t === 'p') out.push({ type: 'paragraph', content: inline(b.c) });
      else if (b.t === 'h') out.push({ type: 'heading', attrs: { level: 1 }, content: inline(b.c) });
      else out.push({ type: 'blockquote', content: [{ type: 'paragraph', content: inline(b.c) }] });
    } else if (b.t === 'ul') {
      const items = b.c.filter((x) => x.trim());
      if (!items.length) continue;
      out.push({
        type: 'bulletList',
        content: items.map((x) => ({ type: 'listItem', content: [{ type: 'paragraph', content: inline(x) }] })),
      });
    } else if (b.t === 'img') {
      if (!b.c.trim()) continue;
      out.push({ type: 'image', attrs: { src: b.c, alt: '', title: b.caption ?? '' } });
    } else if (b.t === 'video') {
      if (!b.c.trim()) continue;
      out.push({ type: 'socialEmbed', attrs: { url: b.c, caption: '' } });
    } else if (b.t === 'table') {
      const rows = b.c
        .map((r) => r.map((x) => x.trim()))
        .filter((r) => r.some((x) => x.length > 0));
      if (!rows.length) continue;
      const headerRows = b.head !== false && rows.length > 1 ? 1 : 0;
      out.push({
        type: 'table',
        content: rows.map((r, ri) => ({
          type: 'tableRow',
          content: r.map((cell) => ({
            type: ri < headerRows ? 'tableHeader' : 'tableCell',
            content: [{ type: 'paragraph', content: inline(cell) }],
          })),
        })),
      });
    }
  }
  return { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
}

/** Normalize anything the editor may hand over into a TipTap doc (or undefined for empty). */
export function normalizeInitialDoc(initial: unknown): TipTapDoc | undefined {
  if (!initial) return undefined;
  if (typeof initial === 'object' && !Array.isArray(initial)) {
    const d = initial as { type?: unknown; content?: unknown };
    if (d.type === 'doc' && Array.isArray(d.content)) {
      return d.content.length ? (d as TipTapDoc) : undefined;
    }
    return undefined;
  }
  if (isLegacyArray(initial)) {
    const doc = legacyToTipTap(initial);
    return doc.content.length === 1 && !(doc.content[0].content?.length) ? undefined : doc;
  }
  if (isDocBlockArray(initial)) {
    const doc = bnToTipTap(initial);
    return doc;
  }
  return undefined;
}

/** Word count over a TipTap document (tables, chart titles, captions included). */
export function wordsOfTipTap(doc: TipTapDoc | null | undefined): number {
  if (!doc || !Array.isArray(doc.content)) return 0;
  let words = 0;
  const count = (s: string) => {
    words += s.split(/\s+/).filter(Boolean).length;
  };
  const walk = (nodes: TNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.type === 'text') count(n.text ?? '');
      else if (n.type === 'chart') count(String(n.attrs?.title ?? ''));
      else if (n.type === 'socialEmbed') count(String(n.attrs?.caption ?? ''));
      else if (n.type === 'buttonLink') count(String(n.attrs?.label ?? ''));
      else if (n.type === 'image') count(String(n.attrs?.title ?? ''));
      walk(n.content);
    }
  };
  walk(doc.content);
  return words;
}
