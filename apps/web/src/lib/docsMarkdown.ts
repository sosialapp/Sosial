import { Marked, type Tokens } from 'marked';

/**
 * Markdown → HTML for docs pages. Shared by the public docs site (server) and
 * the admin editor preview (client) so both render the same thing.
 *
 * Raw HTML in the source is escaped, not rendered, and link/image URLs are
 * limited to http(s), mailto, relative and anchor targets, so a page body can
 * never inject script even though only admins write it.
 */

export interface DocHeading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export function slugifyHeading(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[`*_~[\]()]/g, '')
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h)) return h;
  // Relative, root-relative and in-page anchors; anything with another
  // scheme (javascript:, data:, vbscript:) is dropped.
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return null;
  return h;
}

/** Unique ids for repeated heading texts, in document order. */
function idMaker(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugifyHeading(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

function plainInline(tokens: Tokens.Generic[] | undefined, fallback: string): string {
  if (!tokens?.length) return fallback;
  return tokens.map((t) => ('tokens' in t && t.tokens ? plainInline(t.tokens as Tokens.Generic[], t.raw) : (t as { text?: string }).text ?? t.raw)).join('');
}

function build(): Marked {
  const nextId = idMaker();
  return new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) return `<h1>${inner}</h1>\n`;
        const id = nextId(plainInline(tokens as Tokens.Generic[], text));
        return `<h${depth} id="${id}"><a class="docs-anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
      },
      html({ text }) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const url = safeUrl(href);
        if (!url) return inner;
        const external = /^https?:/i.test(url);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        const ext = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(url)}"${t}${ext}>${inner}</a>`;
      },
      image({ href, title, text }) {
        const url = safeUrl(href);
        if (!url) return escapeHtml(text);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${t} loading="lazy" />`;
      },
      code({ text, lang }) {
        const l = (lang ?? '').trim().split(/\s+/)[0]?.replace(/[^a-z0-9+#-]/gi, '') ?? '';
        const label = l ? `<span class="docs-code-lang">${escapeHtml(l)}</span>` : '';
        const cls = l ? ` class="language-${l}"` : '';
        return `<div class="docs-code">${label}<pre><code${cls}>${escapeHtml(text)}</code></pre></div>\n`;
      },
      table(token) {
        // Default table markup, wrapped so wide tables scroll on phones.
        const head = token.header
          .map((c) => `<th${c.align ? ` align="${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</th>`)
          .join('');
        const rows = token.rows
          .map(
            (r) =>
              `<tr>${r
                .map((c) => `<td${c.align ? ` align="${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</td>`)
                .join('')}</tr>`,
          )
          .join('');
        return `<div class="docs-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
}

/** Rendered HTML plus the h2/h3 outline for the "On this page" rail. */
export function renderDocMarkdown(md: string): { html: string; headings: DocHeading[] } {
  const html = build().parse(md, { async: false }) as string;
  const headings: DocHeading[] = [];
  const nextId = idMaker();
  for (const t of new Marked({ gfm: true }).lexer(md)) {
    if (t.type !== 'heading') continue;
    const h = t as Tokens.Heading;
    if (h.depth === 1) continue;
    const text = plainInline(h.tokens as Tokens.Generic[], h.text);
    const id = nextId(text);
    if (h.depth === 2 || h.depth === 3) headings.push({ id, text, depth: h.depth });
  }
  return { html, headings };
}

/** Rough plain text of a markdown body, for the search index and meta fallbacks. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/^\s*(?:[-+]|\d+\.)\s+/gm, ' ')
    .replace(/[#>|]+|-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
