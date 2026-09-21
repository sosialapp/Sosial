import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared building blocks for feature and audience pages. Server components,
 * same voice and spacing as the landing page.
 */

export function PageHero({
  eyebrow,
  title,
  lede,
  primary = { href: '/login', label: 'Start scheduling free' },
  secondary,
  visual,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  visual?: ReactNode;
}) {
  return (
    <section className="border-b border-line bg-card/60">
      <div
        className={`mx-auto max-w-7xl px-4 py-14 md:py-20 ${
          visual ? 'grid grid-cols-1 items-center gap-10 lg:grid-cols-2' : 'max-w-3xl'
        }`}
      >
        <div className={visual ? '' : 'mx-auto text-center'}>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className={`mt-4 text-lg leading-relaxed text-muted ${visual ? '' : 'mx-auto max-w-xl'}`}>
            {lede}
          </p>
          <div className={`mt-7 flex flex-wrap gap-2.5 ${visual ? '' : 'justify-center'}`}>
            <Link href={primary.href} className="btn btn-primary btn-lg">
              {primary.label}
            </Link>
            {secondary ? (
              <Link href={secondary.href} className="btn btn-ghost btn-lg">
                {secondary.label}
              </Link>
            ) : null}
          </div>
        </div>
        {visual ? <div>{visual}</div> : null}
      </div>
    </section>
  );
}

export interface BlockItem {
  eyebrow?: string;
  title: string;
  body: string;
  points?: string[];
  visual?: ReactNode;
}

export function FeatureBlocks({ items }: { items: BlockItem[] }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
      <div className="space-y-14 md:space-y-20">
        {items.map((b, i) => (
          <div
            key={b.title}
            className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 ${
              b.visual ? '' : 'lg:grid-cols-1 lg:max-w-3xl'
            }`}
          >
            <div className={b.visual && i % 2 === 1 ? 'lg:order-2' : ''}>
              {b.eyebrow ? <p className="eyebrow">{b.eyebrow}</p> : null}
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
                {b.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{b.body}</p>
              {b.points ? (
                <ul className="mt-5 space-y-2.5">
                  {b.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-soft">
                      <span className="mt-0.5 text-accent" aria-hidden="true">
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {b.visual ? <div className={i % 2 === 1 ? 'lg:order-1' : ''}>{b.visual}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FaqList({ items, title = 'Questions, answered' }: { items: { q: string; a: string }[]; title?: string }) {
  return (
    <section className="border-t border-line bg-card/60">
      <div className="mx-auto max-w-3xl px-4 py-14 md:py-20">
        <h2 className="text-center font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {items.map((f) => (
            <details key={f.q} className="group bg-card open:bg-paper">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-display text-sm font-bold">
                {f.q}
                <span aria-hidden="true" className="shrink-0 text-faint transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({
  title,
  body,
  primary = { href: '/login', label: 'Start scheduling free' },
  secondary,
}: {
  title: string;
  body: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
      <div className="rounded-3xl bg-accent px-6 py-14 text-center md:py-16">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-white/85">{body}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Link href={primary.href} className="btn bg-white font-bold text-accent hover:bg-bone">
            {primary.label}
          </Link>
          {secondary ? (
            <Link href={secondary.href} className="btn border-white/40 text-white hover:bg-white/10">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Simple three-up card row for pains, picks and proof points. */
export function CardTrio({
  eyebrow,
  title,
  cards,
}: {
  eyebrow: string;
  title: string;
  cards: { title: string; body: string; href?: string; linkLabel?: string }[];
}) {
  return (
    <section className="border-y border-line bg-card/60">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 max-w-xl font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((c) => {
            const inner = (
              <>
                <h3 className="font-display text-lg font-extrabold tracking-tight">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.body}</p>
                {c.href ? (
                  <span className="mt-4 inline-block text-sm font-bold text-accent">
                    {c.linkLabel ?? 'Learn more'} →
                  </span>
                ) : null}
              </>
            );
            return c.href ? (
              <Link key={c.title} href={c.href} className="card flex flex-col p-5 transition hover:border-accent">
                {inner}
              </Link>
            ) : (
              <div key={c.title} className="card flex flex-col p-5">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
