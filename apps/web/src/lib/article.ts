import type { TMark, TNode, TipTapDoc } from '@/lib/blogConvert';

/**
 * Article channels + rich-body serialization for the create-post flow.
 *
 * The social composer stores a plain caption; website channels (WordPress,
 * Ghost, Dev.to, Hashnode) additionally accept a long-form body. We keep the
 * TipTap JSON as the source of truth on `post_targets.options.article` and
 * render HTML + Markdown once at save time, so the worker never needs a
 * serializer and every platform gets the format it wants:
 *   - WordPress / Ghost → HTML
 *   - Dev.to / Hashnode → Markdown
 * Everything here is pure (no React, no editor) so it can run anywhere.
 */

export const ARTICLE_CHANNELS = ['wordpress', 'ghost', 'devto', 'hashnode'] as const;

export type ArticleProvider = (typeof ARTICLE_CHANNELS)[number];

export function isArticleProvider(provider: string): provider is ArticleProvider {
  return (ARTICLE_CHANNELS as readonly string[]).includes(provider);
}

export const EMPTY_ARTICLE_DOC: TipTapDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export interface ArticlePayload {
  json: TipTapDoc;
  html: string;
  markdown: string;
}

/* --------------------------------- HTML --------------------------------- */

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
  let bold = false;
  let italic = false;
  let strike = false;
  for (const m of marks ?? []) {
    if (m.type === 'link') link = String(m.attrs?.href ?? '');
    else if (m.type === 'bold') bold = true;
    else if (m.type === 'italic') italic = true;
    else if (m.type === 'strike') strike = true;
  }
  if (bold) out = `<strong>${out}</strong>`;
  if (italic) out = `<em>${out}</em>`;
  if (strike) out = `<s>${out}</s>`;
  if (link) out = `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${out}</a>`;
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

function listHtml(node: TNode): string {
  const tag = node.type === 'orderedList' ? 'ol' : 'ul';
  const items = (node.content ?? []).filter((c) => c.type === 'listItem');
  if (!items.length) return '';
  const body = items
    .map((item) => {
      const inner = (item.content ?? [])
        .map((c) => {
          if (c.type === 'paragraph') return inlineHtml(c.content);
          if (c.type === 'bulletList' || c.type === 'orderedList') return listHtml(c);
          return '';
        })
        .join('');
      return `<li>${inner}</li>`;
    })
    .join('');
  return `<${tag}>${body}</${tag}>`;
}

function blockHtml(node: TNode): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      const html = inlineHtml(node.content);
      return html.trim() ? `<h${level}>${html}</h${level}>` : '';
    }
    case 'paragraph': {
      const html = inlineHtml(node.content);
      return html.trim() ? `<p>${html}</p>` : '';
    }
    case 'blockquote': {
      const html = (node.content ?? [])
        .filter((c) => c.type === 'paragraph')
        .map((c) => inlineHtml(c.content))
        .filter((s) => s.trim())
        .join('<br />');
      return html ? `<blockquote>${html}</blockquote>` : '';
    }
    case 'bulletList':
    case 'orderedList':
      return listHtml(node);
    case 'codeBlock': {
      const code = esc((node.content ?? []).map((c) => c.text ?? '').join(''));
      return code.trim() ? `<pre><code>${code}</code></pre>` : '';
    }
    case 'horizontalRule':
      return '<hr />';
    case 'image': {
      const src = String(node.attrs?.src ?? '').trim();
      if (!src) return '';
      const alt = esc(String(node.attrs?.alt ?? ''));
      const caption = String(node.attrs?.title ?? '').trim();
      const img = `<img src="${esc(src)}" alt="${alt}" loading="lazy" />`;
      return caption ? `<figure>${img}<figcaption>${esc(caption)}</figcaption></figure>` : img;
    }
    default: {
      const html = inlineHtml(node.content);
      return html.trim() ? `<p>${html}</p>` : '';
    }
  }
}

/** TipTap article doc → clean semantic HTML (heading levels map 1:1). */
export function tiptapToArticleHtml(doc: TipTapDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content
    .map(blockHtml)
    .filter((s) => s.trim().length > 0)
    .join('\n');
}

/* ------------------------------- Markdown ------------------------------- */

function escInline(s: string): string {
  return s.replace(/([\\`*_[\]<>])/g, '\\$1');
}

function guardBlockStart(s: string): string {
  return s.replace(/^(\s*)([#>+\-]|\d+\.)/, '$1\\$2');
}

function marksMd(text: string, marks: TMark[] | undefined): string {
  let out = escInline(text);
  let link: string | null = null;
  let bold = false;
  let italic = false;
  let strike = false;
  for (const m of marks ?? []) {
    if (m.type === 'link') link = String(m.attrs?.href ?? '');
    else if (m.type === 'bold') bold = true;
    else if (m.type === 'italic') italic = true;
    else if (m.type === 'strike') strike = true;
  }
  if (bold) out = `**${out}**`;
  if (italic) out = `*${out}*`;
  if (strike) out = `~~${out}~~`;
  if (link) out = `[${out}](${link})`;
  return out;
}

function inlineMd(nodes: TNode[] | undefined): string {
  let out = '';
  for (const n of nodes ?? []) {
    if (n.type === 'text') out += marksMd(n.text ?? '', n.marks);
    else if (n.type === 'hardBreak') out += '  \n';
  }
  return out;
}

function listMd(node: TNode, depth: number): string {
  const ordered = node.type === 'orderedList';
  const items = (node.content ?? []).filter((c) => c.type === 'listItem');
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  items.forEach((item, i) => {
    const marker = ordered ? `${i + 1}.` : '-';
    let first = true;
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        lines.push(listMd(child, depth + 1));
        first = false;
      } else if (child.type === 'paragraph') {
        const text = guardBlockStart(inlineMd(child.content));
        if (first) {
          lines.push(`${indent}${marker} ${text}`);
          first = false;
        } else {
          lines.push(`${indent}  ${text}`);
        }
      } else {
        const text = blockMd(child, depth);
        if (first) {
          lines.push(`${indent}${marker} ${text}`);
          first = false;
        } else {
          lines.push(`${indent}  ${text}`);
        }
      }
    }
    if (first) lines.push(`${indent}${marker} `);
  });
  return lines.join('\n');
}

function blockMd(node: TNode, depth = 0): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      return `${'#'.repeat(level)} ${inlineMd(node.content)}`;
    }
    case 'paragraph':
      return guardBlockStart(inlineMd(node.content));
    case 'blockquote': {
      const inner = (node.content ?? []).map((c) => blockMd(c, depth)).join('\n\n');
      return inner
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n');
    }
    case 'bulletList':
    case 'orderedList':
      return listMd(node, depth);
    case 'codeBlock': {
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const code = (node.content ?? []).map((c) => c.text ?? '').join('');
      return '```' + lang + '\n' + code + '\n```';
    }
    case 'horizontalRule':
      return '---';
    case 'image': {
      const src = String(node.attrs?.src ?? '').trim();
      if (!src) return '';
      const alt = String(node.attrs?.alt ?? '').replace(/([\]\\])/g, '\\$1');
      const title = String(node.attrs?.title ?? '').trim();
      return `![${alt}](${src}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`;
    }
    default:
      return inlineMd(node.content);
  }
}

/** TipTap article doc → Markdown (Dev.to / Hashnode). */
export function tiptapToMarkdown(doc: TipTapDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content
    .map((b) => blockMd(b))
    .filter((s) => s.trim().length > 0)
    .join('\n\n');
}

/* -------------------------------- plain --------------------------------- */

function blockText(node: TNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'listItem') return (node.content ?? []).map(blockText).join(' ');
  return (node.content ?? []).map(blockText).join('');
}

/** Flattened plain text — the caption/body fallback for non-article targets. */
export function articlePlainText(doc: TipTapDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  const out: string[] = [];
  for (const b of doc.content) {
    if (b.type === 'image') continue;
    const t = blockText(b).replace(/[ \t]+\n/g, '\n').trim();
    if (t) out.push(t);
  }
  return out.join('\n\n');
}

/** No meaningful block (text, list or image) — nothing to publish. */
export function articleIsEmpty(doc: TipTapDoc | null | undefined): boolean {
  if (!doc || !Array.isArray(doc.content)) return true;
  return !doc.content.some((b) => {
    if (b.type === 'horizontalRule') return true;
    if (b.type === 'image') return String(b.attrs?.src ?? '').trim().length > 0;
    return blockText(b).trim().length > 0;
  });
}

/** The `post_targets.options` payload for one article target. */
export function articleOptions(doc: TipTapDoc | null | undefined): { article: ArticlePayload } {
  const clean: TipTapDoc =
    doc && Array.isArray(doc.content) ? doc : { type: 'doc', content: [] };
  return {
    article: {
      json: clean,
      html: tiptapToArticleHtml(clean),
      markdown: tiptapToMarkdown(clean),
    },
  };
}
