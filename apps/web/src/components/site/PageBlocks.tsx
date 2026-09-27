import Link from 'next/link';
import type { ReactNode } from 'react';
import Kicker from './Kicker';

/**
 * Shared building blocks for feature and audience pages. Server components,
 * same voice and spacing as the landing page.
 */

export function PageHero({
  eyebrow,
  title,
  lede,
  meta,
  primary = { href: '/login', label: 'Start scheduling free' },
  secondary,
  visual,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /** small faint line under the lede — the CMS "Updated …" date. */
  meta?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  visual?: ReactNode;
}) {
  return (
    <section className="border-b border-line bg-card/60">
      <div
        className={`mx-auto max-w-[1440px] px-4 py-20 md:py-28 ${
          visual ? 'grid grid-cols-1 items-center gap-10 lg:grid-cols-2' : 'max-w-3xl'
        }`}
      >
        <div className={visual ? '' : 'mx-auto text-center'}>
          <Kicker>{eyebrow}</Kicker>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className={`mt-4 text-lg leading-relaxed text-muted ${visual ? '' : 'mx-auto max-w-xl'}`}>
            {lede}
          </p>
          {meta ? (
            <p className={`mt-3 text-xs font-bold text-faint ${visual ? '' : 'mx-auto'}`}>{meta}</p>
          ) : null}
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
    <div className="mx-auto max-w-[1440px] px-4 py-20 md:py-28">
      <div className="space-y-16 md:space-y-24">
        {items.map((b, i) => (
          <div
            key={b.title}
            className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 ${
              b.visual ? '' : 'lg:grid-cols-1 lg:max-w-3xl'
            }`}
          >
            <div className={b.visual && i % 2 === 1 ? 'lg:order-2' : ''}>
              {b.eyebrow ? (
                <Kicker>{b.eyebrow}</Kicker>
              ) : null}
              <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
                {b.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{b.body}</p>
              {b.points ? (
                <ul className="mt-5 space-y-2.5">
                  {b.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-soft">
                      <span className="mt-0.5 text-ink" aria-hidden="true">
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
    <section aria-label="Frequently asked questions" className="border-t border-line bg-card/60">
      <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
        <h2 className="text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          {title}
        </h2>
        <div className="mt-10">
          {items.map((f) => (
            <details key={f.q} className="border-t-[1.5px] border-ink last:border-b-[1.5px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[18px] font-display text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full border-[1.5px] border-ink text-xl leading-none transition-transform [[open]_&]:rotate-45 [[open]_&]:bg-bolt">
                  +
                </span>
              </summary>
              <p className="max-w-[60ch] pb-5 text-[15px] leading-relaxed text-muted md:text-base">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
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
      <div className="mx-auto max-w-[1440px] px-4 py-20 md:py-28">
        <Kicker>{eyebrow}</Kicker>
        <h2 className="mt-4 max-w-xl font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((c) => {
            const inner = (
              <>
                <h3 className="font-display text-lg font-extrabold tracking-tight">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.body}</p>
                {c.href ? (
                  <span className="mt-4 inline-block text-sm font-bold text-ink">
                    {c.linkLabel ?? 'Learn more'}
                  </span>
                ) : null}
              </>
            );
            return c.href ? (
              <Link key={c.title} href={c.href} className="card flex flex-col border-2 border-ink p-5 transition hover:-translate-y-0.5">
                {inner}
              </Link>
            ) : (
              <div key={c.title} className="card flex flex-col border-2 border-ink p-5">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
