import type { Block } from '@/content/types';

/**
 * Renders the shared Block[] content model used by blog posts, resources and
 * legal pages. Server component — no client JS.
 */
export default function Prose({ blocks, className = '' }: { blocks: Block[]; className?: string }) {
  return (
    <div className={`prose-sosial ${className}`}>
      {blocks.map((b, i) => {
        if (b.t === 'h') {
          return (
            <h2 key={i} className="mt-9 font-display text-xl font-extrabold tracking-tight text-ink">
              {b.c}
            </h2>
          );
        }
        if (b.t === 'ul') {
          return (
            <ul key={i}>
              {b.c.map((item, j) => (
                <li key={j}>{item}</li>
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
              {b.c}
            </blockquote>
          );
        }
        return <p key={i}>{b.c}</p>;
      })}
    </div>
  );
}
