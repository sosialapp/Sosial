'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceFor, formatUsd, monthlyEquivalent, annualSavingsPct,
  type BillingInterval,
} from '@/lib/billing/plans';

/**
 * Pricing band — simple modern: one quiet toggle, four clean cards, the
 * featured plan lifted with the brand accent. Card content (prices, limits,
 * points, CTAs) comes straight from the canonical PLANS config, so the
 * numbers here are exactly what billing enforces.
 */

function Check({ featured }: { featured?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-[1px] shrink-0"
    >
      <circle cx="10" cy="10" r="9" fill={featured ? 'rgba(255,198,46,0.35)' : 'rgba(28,26,20,0.07)'} />
      <path
        d="M6.4 10.2 8.9 12.7 13.6 7.4"
        stroke="#1C1A14"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PricingPlans({
  title,
  lede,
  updated,
}: {
  title: string;
  lede: string;
  updated?: string;
}) {
  const [interval, setInterval] = useState<BillingInterval>('annual');

  return (
    <section aria-label="Plans" className="relative overflow-hidden">
      {/* Faint grid wash, same family as the hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(28,26,20,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,26,20,0.045)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_30%,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">{lede}</p>
          {updated ? <p className="mt-3 text-xs text-faint">Updated {updated}</p> : null}
        </div>

        {/* Interval toggle */}
        <div className="mt-10 flex justify-center">
          <div
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1 shadow-[0_2px_10px_rgba(28,26,20,0.06)]"
            role="group"
            aria-label="Billing interval"
          >
            {(['monthly', 'annual'] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                aria-pressed={interval === i}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  interval === i
                    ? 'bg-ink text-paper shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {i === 'monthly' ? 'Monthly' : 'Annual'}
                {i === 'annual' ? (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      interval === i ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent-ink'
                    }`}
                  >
                    −17%
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="mt-12 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((key) => {
            const p = PLANS[key];
            const featured = !!p.featured;
            const ctaHref = key === 'free' ? '/login' : '/billing';
            const ctaLabel = key === 'free' ? 'Start free' : `Choose ${p.label}`;
            const perMonth =
              key === 'free' ? null : Math.round(monthlyEquivalent(key));
            return (
              <div
                key={key}
                className={`relative flex flex-col rounded-3xl p-6 transition-all duration-200 ${
                  featured
                    ? 'bg-ink text-paper shadow-[0_24px_60px_-24px_rgba(28,26,20,0.5)] lg:-my-3 lg:py-9'
                    : 'border border-line bg-white/80 backdrop-blur-sm'
                }`}
              >
                {featured ? (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-accent-ink uppercase">
                    Most popular
                  </span>
                ) : null}

                <p className={`text-sm font-bold ${featured ? 'text-paper/70' : 'text-muted'}`}>
                  {p.label}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className={`font-display text-[44px] leading-none font-extrabold tracking-tight ${featured ? 'text-paper' : 'text-ink'}`}>
                    {key === 'free' ? 'Free' : formatUsd(perMonth ?? 0)}
                  </span>
                  {perMonth !== null ? (
                    <span className={`text-sm font-medium ${featured ? 'text-paper/60' : 'text-faint'}`}>/mo</span>
                  ) : null}
                </div>

                {key === 'free' ? (
                  <p className={`mt-2 text-xs ${featured ? 'text-paper/60' : 'text-faint'}`}>
                    Free forever. No card needed.
                  </p>
                ) : interval === 'annual' ? (
                  <p className={`mt-2 text-xs ${featured ? 'text-paper/60' : 'text-faint'}`}>
                    Billed {formatUsd(priceFor(key, 'annual'))} yearly · save {annualSavingsPct(key)}%
                  </p>
                ) : (
                  <p className={`mt-2 text-xs ${featured ? 'text-paper/60' : 'text-faint'}`}>
                    Or {formatUsd(Math.round(monthlyEquivalent(key)))}/mo billed yearly (save {annualSavingsPct(key)}%)
                  </p>
                )}

                <p className={`mt-4 text-sm leading-relaxed ${featured ? 'text-paper/80' : 'text-muted'}`}>
                  {p.blurb}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {p.points.map((pt) => (
                    <li key={pt} className={`flex items-start gap-2.5 text-sm leading-relaxed ${featured ? 'text-paper/90' : 'text-soft'}`}>
                      <Check featured={featured} />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={ctaHref}
                  className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_-2px_rgba(28,26,20,0.25)] active:translate-y-0 ${
                    featured
                      ? 'bg-accent text-accent-ink hover:bg-accent-bright'
                      : 'border-2 border-ink/10 text-ink hover:border-ink'
                  }`}
                >
                  {ctaLabel}
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-faint">
          Prices in USD. Annual plans are billed once a year and give you two months free.
          Cancel any time, keep your data.
        </p>
      </div>
    </section>
  );
}
