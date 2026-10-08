import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/StatusIcons';

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
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
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
              {b.eyebrow ? <p className="eyebrow">{b.eyebrow}</p> : null}
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
                {b.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{b.body}</p>
                  {b.points ? (
                <ul className="mt-5 space-y-2.5">
                  {b.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-soft">
                      <span className="mt-0.5 inline-flex text-ink" aria-hidden="true">
                        <CheckIcon size={15} />
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
    <section aria-label="Frequently asked questions" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(28,26,20,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,26,20,0.035)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_20%,transparent_75%)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 pt-8 pb-20 md:pt-10 md:pb-28">
        <p className="eyebrow text-center">FAQ</p>
        <h2 className="mt-3 text-center font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {title}
        </h2>
        <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-white/80 backdrop-blur-sm">
          {items.map((f, i) => (
            <details key={f.q} className={`group ${i > 0 ? 'border-t border-line/70' : ''}`}>
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 transition-colors hover:bg-bone/60 [&::-webkit-details-marker]:hidden md:px-7 md:py-6">
                <span className="flex-1 font-display text-[16px] font-semibold tracking-tight text-ink md:text-[17px]">
                  {f.q}
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink/[0.06] text-ink transition-transform duration-300 group-open:rotate-180"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-6 md:px-7 md:pb-7">
                <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">{f.a}</p>
              </div>
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
                  <span className="mt-4 inline-block text-sm font-bold text-ink">
                    {c.linkLabel ?? 'Learn more'}
                  </span>
                ) : null}
              </>
            );
            return c.href ? (
              <Link key={c.title} href={c.href} className="card flex flex-col border border-line p-5 transition hover:-translate-y-0.5">
                {inner}
              </Link>
            ) : (
              <div key={c.title} className="card flex flex-col border border-line p-5">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
