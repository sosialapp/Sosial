import type { Block } from '@/content/types';
import { embedUrl, renderInline } from '@/lib/richtext';

/**
 * Renders the shared Block[] content model used by blog posts, resources and
 * legal pages. Server component — no client JS (and no server-only imports,
 * so the admin preview may reuse it inside a client component).
 */
export default function Prose({ blocks, className = '' }: { blocks: Block[]; className?: string }) {
  return (
    <div className={`prose-sosial ${className}`}>
      {blocks.map((b, i) => {
        if (b.t === 'h') {
          return (
            <h2 key={i} className="mt-9 font-display text-xl font-extrabold tracking-tight text-ink">
              {renderInline(b.c)}
            </h2>
          );
        }
        if (b.t === 'ul') {
          return (
            <ul key={i}>
              {b.c.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (b.t === 'quote') {
          return (
            <blockquote
              key={i}
              className="mt-5 border-l-4 border-accent pl-4 font-display text-lg font-bold leading-snug text-ink"
            >
              {renderInline(b.c)}
            </blockquote>
          );
        }
        if (b.t === 'img') {
          if (!b.c) return null;
          return (
            <figure key={i} className="mt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.c}
                alt={b.alt ?? ''}
                loading="lazy"
                className="w-full rounded-2xl border border-line"
              />
              {b.caption ? (
                <figcaption className="mt-2 text-center text-xs text-muted">{b.caption}</figcaption>
              ) : null}
            </figure>
          );
        }
        if (b.t === 'table') {
          const rows = b.c
            .map((r) => r.map((x) => x))
            .filter((r) => r.some((x) => x.trim()));
          if (rows.length === 0) return null;
          const cols = Math.max(...rows.map((r) => r.length));
          const grid = rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')]);
          const hasHead = b.head !== false;
          const head = hasHead ? grid[0] : null;
          const bodyRows = hasHead ? grid.slice(1) : grid;
          return (
            <div key={i} className="mt-6 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full border-collapse text-sm">
                {head ? (
                  <thead>
                    <tr className="border-b border-line bg-card">
                      {head.map((cell, j) => (
                        <th key={j} className="px-4 py-2.5 text-left font-display font-extrabold text-ink">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {bodyRows.map((row, r) => (
                    <tr key={r} className="border-t border-line first:border-t-0">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2.5 align-top text-soft">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.t === 'video') {
          if (!b.c) return null;
          const embed = embedUrl(b.c);
          if (!embed) {
            return (
              <p key={i}>
                <a
                  href={b.c}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-accent-ink underline underline-offset-2"
                >
                  {b.c}
                </a>
              </p>
            );
          }
          return (
            <div key={i} className="mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-line">
              <iframe
                src={embed}
                title="Embedded video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          );
        }
        return <p key={i}>{renderInline(b.c)}</p>;
      })}
    </div>
  );
}
