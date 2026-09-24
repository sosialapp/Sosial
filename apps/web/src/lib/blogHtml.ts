import { inlineText, parseChartData, type DocBlock, type RichInline } from '@/lib/blogConvert';
import { resolveEmbed } from '@/lib/richtext';

/**
 * BlockNote JSON → published HTML. Pure and deterministic so the exact string
 * saved with the post is what the public page server-renders (full SEO, zero
 * client JS for readers). Charts emit an empty <figure class="sosial-chart">
 * carrying its data — the reader page hydrates those with recharts.
 */

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function inlineHtml(nodes: unknown): string {
  if (typeof nodes === 'string') return esc(nodes);
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const raw of nodes as Record<string, unknown>[]) {
    if (raw.type === 'text') {
      const text = esc(String(raw.text ?? ''));
      const styles = (raw.styles ?? {}) as { bold?: boolean; italic?: boolean };
      if (styles.bold && styles.italic) out += `<strong><em>${text}</em></strong>`;
      else if (styles.bold) out += `<strong>${text}</strong>`;
      else if (styles.italic) out += `<em>${text}</em>`;
      else out += text;
    } else if (raw.type === 'link') {
      const href = esc(String(raw.href ?? '#'));
      out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${inlineHtml(raw.content)}</a>`;
    }
  }
  return out;
}

function cellHtml(cell: unknown): string {
  if (typeof cell === 'string') return esc(cell);
  const c = cell as { content?: { content?: unknown }[] };
  return (c.content ?? []).map((par) => inlineHtml(par?.content)).filter(Boolean).join('<br />');
}

const VIDEO_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

function embedHtml(url: string): string {
  const e = resolveEmbed(url);
  if (e) {
    if (e.ratio === 'auto') {
      return `<div class="embed-box embed-auto"><iframe src="${esc(e.src)}" loading="lazy" allow="${VIDEO_ALLOW}" allowfullscreen style="height:${e.height}px"></iframe></div>`;
    }
    return `<div class="embed-box" style="aspect-ratio:${e.ratio}"><iframe src="${esc(e.src)}" loading="lazy" allow="${VIDEO_ALLOW}" allowfullscreen></iframe></div>`;
  }
  // No static iframe (X, LinkedIn, everything else) — a clean link card.
  let host = 'link';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep fallback */
  }
  return `<a class="embed-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="embed-card-host">${esc(host)}</span><span class="embed-card-url">${esc(url)}</span></a>`;
}

function chartHtml(block: DocBlock): string {
  const points = parseChartData(block.props?.data);
  const title = String(block.props?.title ?? '').trim();
  const kind = String(block.props?.kind ?? 'bar');
  if (!points.length) return '';
  const payload = esc(JSON.stringify({ kind, title, points }));
  return `<figure class="sosial-chart" data-chart="${payload}">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}</figure>`;
}

function headingLevel(level: unknown): { tag: string; cls: string } {
  const n = Number(level) || 1;
  if (n <= 1) return { tag: 'h2', cls: 'rich-h2' };
  if (n === 2) return { tag: 'h3', cls: 'rich-h3' };
  return { tag: 'h4', cls: 'rich-h4' };
}

/** Serialize a BlockNote document into prose-compatible HTML. */
export function blocksToProseHtml(blocks: DocBlock[]): string {
  const parts: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    parts.push(
      `<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.tag}>`,
    );
    list = null;
  };

  for (const b of blocks) {
    const type = String(b.type ?? '');
    if (type === 'bulletListItem' || type === 'numberedListItem') {
      const tag = type === 'bulletListItem' ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(inlineHtml(b.content));
      continue;
    }
    flushList();

    switch (type) {
      case 'heading': {
        const { tag, cls } = headingLevel(b.props?.level);
        parts.push(`<${tag} class="${cls}">${inlineHtml(b.content)}</${tag}>`);
        break;
      }
      case 'quote':
        parts.push(`<blockquote>${inlineHtml(b.content)}</blockquote>`);
        break;
      case 'image': {
        const url = String(b.props?.url ?? '');
        if (!url) break;
        const caption = String(b.props?.caption ?? '').trim();
        parts.push(
          `<figure class="rich-figure"><img src="${esc(url)}" alt="${esc(String(b.props?.name ?? '') || 'Article image')}" loading="lazy" />${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`,
        );
        break;
      }
      case 'video': {
        const url = String(b.props?.url ?? '');
        if (url) parts.push(embedHtml(url));
        break;
      }
      case 'socialEmbed': {
        const url = String(b.props?.url ?? '').trim();
        if (!url) break;
        const caption = String(b.props?.caption ?? '').trim();
        parts.push(
          `<figure class="rich-figure">${embedHtml(url)}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`,
        );
        break;
      }
      case 'chart':
        parts.push(chartHtml(b));
        break;
      case 'table': {
        const tc = b.content as
          | { rows?: { cells?: unknown[] }[]; headerRows?: number }
          | undefined;
        const rows = (tc?.rows ?? [])
          .map((r) => (r.cells ?? []).map(cellHtml))
          .filter((r) => r.some((c) => c.trim()));
        if (!rows.length) break;
        const cols = Math.max(...rows.map((r) => r.length));
        const grid = rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')]);
        const headerRows = tc?.headerRows && tc.headerRows > 0 && grid.length > 1 ? 1 : 0;
        const head = headerRows ? grid.slice(0, headerRows) : [];
        const body = grid.slice(headerRows);
        parts.push(
          `<div class="rich-table-wrap"><table><thead>${head
            .map((r) => `<tr>${r.map((c) => `<th>${c}</th>`).join('')}</tr>`)
            .join('')}</thead><tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
            .join('')}</tbody></table></div>`,
        );
        break;
      }
      case 'divider':
        parts.push('<hr />');
        break;
      case 'paragraph':
      default: {
        const html = inlineHtml(b.content);
        if (html.trim()) parts.push(`<p>${html}</p>`);
        break;
      }
    }
  }
  flushList();
  return parts.join('\n');
}

/** Re-export for callers that need plain text of inline content. */
export { inlineText as _inlineText } from '@/lib/blogConvert';
export type { RichInline };
