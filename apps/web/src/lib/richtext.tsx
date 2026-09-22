import type { ReactNode } from 'react';

/**
 * Tiny inline formatter for blog text (client-safe — no server imports, so
 * both Prose and the admin preview use it). Supports **bold**, *italic* and
 * [label](https://…) links; anything unmatched renders as literal text.
 * React element construction (never innerHTML) keeps stored content XSS-safe
 * by construction. No nesting — inner markers stay literal.
 */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let k = 0;
  const linkRe = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderEmphasis(text.slice(last, m.index), () => k++));
    nodes.push(
      <a
        key={k++}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-accent-ink underline underline-offset-2"
      >
        {renderEmphasis(m[1], () => k++)}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(...renderEmphasis(text.slice(last), () => k++));
  return nodes;
}

function renderEmphasis(text: string, key: () => number): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*.+?\*\*|\*[^*\n]+?\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={key()}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key()}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** YouTube / Vimeo URLs → privacy-friendly embed src; anything else → null
 *  (callers fall back to a plain link). */
export function embedUrl(url: string): string | null {
  const u = url.trim();
  let m: RegExpMatchArray | null =
    u.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?.*v=([\w-]{6,})/) ??
    u.match(/^(?:https?:\/\/)?youtu\.be\/([\w-]{6,})/) ??
    u.match(/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:shorts|live|embed)\/([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[m.length - 1]}`;
  const v = u.match(/^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  return null;
}
