import type { ReactNode } from 'react';

/**
 * Tenner-style kicker pill: white, ink-bordered, bolt dot. The signature
 * section label across marketing — replaces bare eyebrow text on heads.
 * Client-safe (no directives): usable from server and client components.
 */
export default function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.5 font-display text-sm font-semibold ${
        dark ? 'border-paper text-paper' : 'border-ink bg-white text-ink'
      }`}
    >
      <i className="h-2 w-2 rounded-full bg-bolt" aria-hidden="true" />
      {children}
    </span>
  );
}
