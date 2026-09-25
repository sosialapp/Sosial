import { parseChartData } from '@/lib/blogConvert';
import { resolveEmbed } from '@/lib/embeds';
import type { TMark, TNode, TipTapDoc } from '@/lib/blogConvert';

/**
 * TipTap JSON → published HTML. Pure and deterministic so the exact string
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

function marksHtml(text: string, marks: TMark[] | undefined): string {
  let out = esc(text);
  let link: string | null = null;
  let color: string | null = null;
  let bold = false;
  let italic = false;
  let strike = false;
  for (const m of marks ?? []) {
    if (m.type === 'link') link = String(m.attrs?.href ?? '#');
    else if (m.type === 'textStyle' && typeof m.attrs?.color === 'string') color = m.attrs.color;
    else if (m.type === 'bold') bold = true;
    else if (m.type === 'italic') italic = true;
    else if (m.type === 'strike') strike = true;
  }
  if (bold) out = `<strong>${out}</strong>`;
  if (italic) out = `<em>${out}</em>`;
  if (strike) out = `<s>${out}</s>`;
  if (color) out = `<span style="color:${esc(color)}">${out}</span>`;
  if (link) {
    const internal = link.startsWith('/');
    out = `<a href="${esc(link)}"${internal ? '' : ' target="_blank" rel="noopener noreferrer"'}>${out}</a>`;
  }
  return out;
}

function inlineHtml(nodes: TNode[] | undefined): string {
  let out = '';
  for (const n of nodes ?? []) {
    if (n.type === 'text') out += marksHtml(n.text ?? '', n.marks);
    else if (n.type === 'hardBreak') out += '<br />';
  }
  return out;
}

/** Plain text of inline content (fallbacks, titles). */
function inlineText(nodes: TNode[] | undefined): string {
  let out = '';
  for (const n of nodes ?? []) {
    if (n.type === 'text') out += n.text ?? '';
  }
  return out;
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
  let host = 'link';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep fallback */
  }
  return `<a class="embed-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="embed-card-host">${esc(host)}</span><span class="embed-card-url">${esc(url)}</span></a>`;
}

function chartHtml(kind: string, title: string, data: string): string {
  const points = parseChartData(data);
  if (!points.length) return '';
  const payload = esc(JSON.stringify({ kind, title, points }));
  return `<figure class="sosial-chart" data-chart="${payload}">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}</figure>`;
}

function alignStyle(attrs: Record<string, unknown> | undefined): string {
  const align = attrs?.textAlign;
  if (typeof align === 'string' && align && align !== 'left') {
    return ` style="text-align:${esc(align)}"`;
  }
  return '';
}

function cellStyle(cell: TNode): string {
  const parts: string[] = [];
  const bg = cell.attrs?.backgroundColor;
  if (typeof bg === 'string' && bg) parts.push(`background-color:${esc(bg)}`);
  const align = cell.attrs?.textAlign;
  if (typeof align === 'string' && align && align !== 'left') parts.push(`text-align:${esc(align)}`);
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

/** Cell content: paragraphs, images and nested lists (images in table cells). */
function cellInnerHtml(cell: TNode): string {
  const parts: string[] = [];
  for (const p of cell.content ?? []) {
    if (p.type === 'paragraph') {
      const html = inlineHtml(p.content);
      if (html.trim()) parts.push(html);
    } else if (p.type === 'image') {
      const url = String(p.attrs?.src ?? '');
      if (url) {
        const w = Number(p.attrs?.width) || 0;
        const st = w > 0 && w < 100 ? ` style="width:${Math.round(w)}%"` : '';
        parts.push(
          `<img class="rich-cell-img" src="${esc(url)}" alt="${esc(String(p.attrs?.alt ?? ''))}" loading="lazy"${st} />`,
        );
      }
    } else if (p.type === 'bulletList' || p.type === 'orderedList') {
      const html = listHtml(p);
      if (html) parts.push(html);
    }
  }
  return parts.join('<br />');
}

function headingLevel(level: unknown): { tag: string; cls: string } {
  const n = Number(level) || 1;
  if (n <= 1) return { tag: 'h2', cls: 'rich-h2' };
  if (n === 2) return { tag: 'h3', cls: 'rich-h3' };
  return { tag: 'h4', cls: 'rich-h4' };
}

function listItemHtml(item: TNode): string {
  const inner: string[] = [];
  for (const c of item.content ?? []) {
    if (c.type === 'paragraph') inner.push(inlineHtml(c.content));
    else if (c.type === 'bulletList' || c.type === 'orderedList') inner.push(listHtml(c));
  }
  return `<li>${inner.join('')}</li>`;
}

function listHtml(node: TNode): string {
  const tag = node.type === 'orderedList' ? 'ol' : 'ul';
  const items = (node.content ?? []).filter((c) => c.type === 'listItem');
  if (!items.length) return '';
  return `<${tag}>${items.map(listItemHtml).join('')}</${tag}>`;
}

/** Serialize a TipTap document into prose-compatible HTML. */
export function tiptapToProseHtml(doc: TipTapDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  const parts: string[] = [];
  for (const b of doc.content) {
    switch (b.type) {
      case 'heading': {
        const { tag, cls } = headingLevel(b.attrs?.level);
        const html = inlineHtml(b.content);
        if (html.trim()) parts.push(`<${tag} class="${cls}"${alignStyle(b.attrs)}>${html}</${tag}>`);
        break;
      }
      case 'blockquote': {
        const html = (b.content ?? [])
          .filter((c) => c.type === 'paragraph')
          .map((c) => inlineHtml(c.content))
          .filter((s) => s.trim())
          .join('<br />');
        if (html) parts.push(`<blockquote>${html}</blockquote>`);
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const html = listHtml(b);
        if (html) parts.push(html);
        break;
      }
      case 'image': {
        const url = String(b.attrs?.src ?? '');
        if (!url) break;
        const caption = String(b.attrs?.title ?? '').trim();
        const width = Number(b.attrs?.width) || 0;
        const style = width > 0 && width < 100 ? ` style="width:${Math.round(width)}%"` : '';
        parts.push(
          `<figure class="rich-figure"><img src="${esc(url)}" alt="${esc(String(b.attrs?.alt ?? '') || 'Article image')}" loading="lazy"${style} />${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`,
        );
        break;
      }
      case 'socialEmbed': {
        const url = String(b.attrs?.url ?? '').trim();
        if (!url) break;
        const caption = String(b.attrs?.caption ?? '').trim();
        parts.push(
          `<figure class="rich-figure">${embedHtml(url)}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`,
        );
        break;
      }
      case 'chart':
        parts.push(
          chartHtml(String(b.attrs?.kind ?? 'bar'), String(b.attrs?.title ?? '').trim(), String(b.attrs?.data ?? '')),
        );
        break;
      case 'buttonLink': {
        const label = String(b.attrs?.label ?? '').trim();
        const href = String(b.attrs?.href ?? '').trim();
        if (!label || !href) break;
        const image = String(b.attrs?.image ?? '').trim();
        const outline = b.attrs?.variant === 'outline';
        parts.push(
          `<p class="rich-btn-wrap"><a class="rich-btn${outline ? ' rich-btn-outline' : ''}" href="${esc(href)}"${href.startsWith('/') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${image ? `<img class="rich-btn-img" src="${esc(image)}" alt="" />` : ''}<span>${esc(label)}</span></a></p>`,
        );
        break;
      }
      case 'table': {
        const rows = (b.content ?? []).filter((r) => r.type === 'tableRow');
        const grid = rows.map((r) =>
          (r.content ?? []).filter((c) => c.type === 'tableCell' || c.type === 'tableHeader'),
        );
        if (!grid.length || !grid.some((r) => r.length)) break;
        const headerRows =
          grid.length > 1 && grid[0].length > 0 && grid[0].every((c) => c.type === 'tableHeader') ? 1 : 0;
        const renderRow = (r: TNode[]) =>
          `<tr>${r
            .map((c) => {
              const tag = c.type === 'tableHeader' ? 'th' : 'td';
              const span: string[] = [];
              const colspan = Number(c.attrs?.colspan) || 1;
              const rowspan = Number(c.attrs?.rowspan) || 1;
              if (colspan > 1) span.push(` colspan="${colspan}"`);
              if (rowspan > 1) span.push(` rowspan="${rowspan}"`);
              return `<${tag}${span.join('')}${cellStyle(c)}>${cellInnerHtml(c) || ''}</${tag}>`;
            })
            .join('')}</tr>`;
        const head = grid.slice(0, headerRows);
        const body = grid.slice(headerRows);
        const radius = typeof b.attrs?.radius === 'string' && b.attrs.radius ? ` style="border-radius:${esc(b.attrs.radius)};overflow:hidden"` : '';
        parts.push(
          `<div class="rich-table-wrap"${radius}><table><thead>${head.map(renderRow).join('')}</thead><tbody>${body.map(renderRow).join('')}</tbody></table></div>`,
        );
        break;
      }
      case 'horizontalRule':
        parts.push('<hr />');
        break;
      case 'codeBlock': {
        const code = esc(inlineText(b.content));
        if (code.trim()) parts.push(`<pre class="rich-pre">${code}</pre>`);
        break;
      }
      case 'paragraph':
      default: {
        const html = inlineHtml(b.type === 'paragraph' ? b.content : undefined);
        if (html.trim()) parts.push(`<p${alignStyle(b.type === 'paragraph' ? b.attrs : undefined)}>${html}</p>`);
        break;
      }
    }
  }
  return parts.join('\n');
}
