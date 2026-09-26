'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceFor, priceLabel, formatUsd, monthlyEquivalent, annualSavingsPct,
  type BillingInterval,
} from '@/lib/billing/plans';

/**
 * Pricing band: light theme with a monthly/annual pill toggle and Postiz-style
 * cards (big price, check list, pill CTA, Popular badge on the featured plan).
 * Card content (prices, limits, points, CTAs) comes straight from the
 * canonical PLANS config, so the numbers here are exactly what billing enforces.
 */
function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mb-auto mt-[0.5px] shrink-0"
    >
      <rect x="1" y="1" width="18" height="18" rx="5" fill="#1C1A14" fillOpacity="0.08" />
      <path
        d="M6.5 10.2 9 12.7 13.7 7.5"
        stroke="#1C1A14"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 10h11M11 6.5 14.5 10 11 13.5"
        stroke="currentColor"
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
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <section aria-label="Plans" className="border-b border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">{lede}</p>
          {updated ? <p className="mt-3 text-xs text-faint">Updated {updated}</p> : null}
        </div>

        <div className="mt-10 flex justify-center">
          <div
            className="grid w-full grid-cols-2 gap-1 rounded-xl border border-line p-1.5 sm:w-[280px]"
            role="group"
            aria-label="Billing interval"
          >
            {(['monthly', 'annual'] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                aria-pressed={interval === i}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:text-base ${
                  interval === i ? 'bg-[#191512] text-white' : 'bg-transparent text-soft'
                }`}
              >
                {i === 'monthly' ? 'Monthly' : `Yearly · −${annualSavingsPct('team')}%`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((key) => {
            const p = PLANS[key];
            const ctaHref = key === 'free' ? '/login' : '/billing';
            const ctaLabel = key === 'free' ? 'Start free' : `Choose ${p.label}`;
            return (
              <div
                key={key}
                className={`relative flex w-full flex-1 flex-col rounded-[20px] px-5 py-8 lg:p-6 ${
                  p.featured
                    ? 'border-2 border-accent bg-white shadow-[0_24px_60px_-30px_rgba(28,26,20,0.45)]'
                    : 'border border-line bg-white'
                }`}
              >
                {p.featured ? (
                  <div className="absolute top-4 right-4">
                    <div className="w-fit rounded-full bg-accent px-4 py-2">
                      <p className="text-sm leading-none font-semibold text-accent-ink">
                        Popular
                      </p>
                    </div>
                  </div>
                ) : null}
                <p className="font-display text-xl font-medium text-ink">{p.label}</p>
                <div className="min-h-[20px]" />
                <p className="font-display text-5xl font-semibold tracking-tight text-ink">
                  {key === 'free' ? 'Free' : formatUsd(priceFor(key, interval))}
                  {key !== 'free' ? (
                    <span className="ml-2 font-display text-xl font-medium text-faint">
                      /{interval === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  ) : null}
                </p>
                <div className="min-h-[8px]" />
                {key !== 'free' && interval === 'annual' ? (
                  <p className="text-sm text-muted">
                    ≈ {formatUsd(monthlyEquivalent(key))}/mo — billed annually
                  </p>
                ) : null}
                {key !== 'free' && interval === 'monthly' ? (
                  <p className="text-sm text-muted">
                    or {priceLabel(key, 'annual')} ({annualSavingsPct(key)}% off)
                  </p>
                ) : null}
                <p className="mt-3 text-base leading-relaxed text-muted">{p.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2 text-sm leading-relaxed text-soft">
                      <CheckIcon />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <div className="min-h-[44px]" />
                <div className="flex justify-center">
                  <Link
                    href={ctaHref}
                    className={`flex w-fit items-center justify-center gap-1.5 rounded-full px-8 py-4 text-base font-medium whitespace-nowrap transition-all ${
                      p.featured
                        ? 'bg-[#191512] text-white hover:bg-[#2a261d]'
                        : 'border border-line text-soft hover:border-ink hover:bg-paper-dim'
                    }`}
                  >
                    {ctaLabel}
                    <ArrowIcon />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-faint">
          Prices in USD. Annual plans are billed once a year and give you two months free.
          Cancel any time, keep your data.
        </p>
      </div>
    </section>
  );
}
