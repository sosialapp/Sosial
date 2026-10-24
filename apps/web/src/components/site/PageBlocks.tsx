import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/StatusIcons';
import { FaqJsonLd } from '@/components/site/JsonLd';

/**
 * Shared building blocks for feature and audience pages. Server components.
 * Deliberately quiet: type, hairlines and whitespace carry the layout, and
 * the product itself (live app previews passed in as `visual`) is the only
 * picture. No glows, gradients or decorative tiles.
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
  /** small faint line under the lede, the CMS "Updated …" date. */
  meta?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  /** Shown full width under the copy, usually a live app preview. */
  visual?: ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1200px] px-4 pt-14 pb-12 sm:pt-20 md:pt-24 md:pb-16">
        <p className="text-sm font-bold text-muted">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-[2.5rem] font-extrabold leading-[1.04] tracking-tight text-balance sm:text-5xl md:text-[3.5rem]">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{lede}</p>
        {meta ? <p className="mt-3 text-xs font-bold text-faint">{meta}</p> : null}
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Link href={primary.href} className="btn btn-primary btn-lg justify-center">
            {primary.label}
          </Link>
          {secondary ? (
            <Link href={secondary.href} className="btn btn-ghost btn-lg justify-center">
              {secondary.label}
            </Link>
          ) : null}
        </div>
        {visual ? <div className="mt-12 md:mt-16">{visual}</div> : null}
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

function Points({ points, columns = false }: { points: string[]; columns?: boolean }) {
  return (
    <ul className={columns ? 'grid grid-cols-1 gap-x-8 sm:grid-cols-2' : 'mt-6'}>
      {points.map((p) => (
        <li
          key={p}
          className={`flex items-start gap-3 border-t border-line py-3 text-sm leading-relaxed text-soft first:border-t-0 ${
            columns ? 'sm:[&:nth-child(2)]:border-t-0' : ''
          }`}
        >
          <span className="mt-0.5 inline-flex shrink-0 text-ink" aria-hidden="true">
            <CheckIcon size={14} />
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

/**
 * Feature rows divided by hairlines. With a visual: copy in a narrow column,
 * the product preview wide beside it. Without: heading on the left, body
 * and points on the right, so no half of the row is ever empty.
 */
export function FeatureBlocks({ items }: { items: BlockItem[] }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-8">
      {items.map((b) => (
        <section
          key={b.title}
          className="grid grid-cols-1 gap-8 border-t border-line py-14 first:border-t-0 md:py-20 lg:grid-cols-12 lg:gap-12"
        >
          {b.visual ? (
            <>
              <div className="lg:col-span-4">
                {b.eyebrow ? <p className="text-sm font-bold text-muted">{b.eyebrow}</p> : null}
                <h2 className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance md:text-3xl">
                  {b.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted">{b.body}</p>
                {b.points ? <Points points={b.points} /> : null}
              </div>
              <div className="min-w-0 lg:col-span-8">{b.visual}</div>
            </>
          ) : (
            <>
              <div className="lg:col-span-5">
                {b.eyebrow ? <p className="text-sm font-bold text-muted">{b.eyebrow}</p> : null}
                <h2 className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance md:text-3xl">
                  {b.title}
                </h2>
              </div>
              <div className="lg:col-span-7">
                <p className="text-base leading-relaxed text-muted md:text-lg">{b.body}</p>
                {b.points ? (
                  <div className="mt-6">
                    <Points points={b.points} columns />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

export function FaqList({ items, title = 'Questions, answered' }: { items: { q: string; a: string }[]; title?: string }) {
  return (
    <section aria-label="Frequently asked questions" className="border-t border-line">
      <FaqJsonLd items={items} />
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 py-16 md:py-24 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <p className="text-sm font-bold text-muted">FAQ</p>
          <h2 className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance md:text-3xl">
            {title}
          </h2>
        </div>
        <div className="divide-y divide-line border-y border-line lg:col-span-8">
          {items.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-5 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 font-display text-base font-bold tracking-tight text-ink md:text-[17px]">{f.q}</span>
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 flex-none place-items-center text-muted transition-transform duration-200 group-open:rotate-45"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="max-w-[62ch] pb-6 text-[15px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Simple three-up row for pains, picks and proof points. */
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
    <section className="border-y border-line">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:py-24">
        <p className="text-sm font-bold text-muted">{eyebrow}</p>
        <h2 className="mt-2 max-w-xl font-display text-[1.75rem] font-extrabold leading-tight tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-x-10 md:grid-cols-3">
          {cards.map((c) => {
            const inner = (
              <>
                <h3 className="font-display text-lg font-extrabold tracking-tight">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.body}</p>
                {c.href ? (
                  <span className="mt-4 inline-block text-sm font-bold text-ink underline-offset-4 group-hover:underline">
                    {c.linkLabel ?? 'Learn more'} →
                  </span>
                ) : null}
              </>
            );
            return c.href ? (
              <Link key={c.title} href={c.href} className="group flex flex-col border-t border-line py-6">
                {inner}
              </Link>
            ) : (
              <div key={c.title} className="flex flex-col border-t border-line py-6">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
