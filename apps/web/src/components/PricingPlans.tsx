'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceFor, formatUsd, monthlyEquivalent, annualSavingsPct,
  type BillingInterval, type PlanKey,
} from '@/lib/billing/plans';

/**
 * Pricing band, Clay-style colored-header cards: each plan gets its own
 * header colour with a tinted icon tile poking above, a white Recommended
 * pill on the featured plan, quota "fields" (channels + AI credits) pulled
 * straight from enforced limits, dot-bullet features and a full-width CTA.
 * All numbers come from the canonical PLANS config.
 */

const CARD_COLORS: Record<Exclude<PlanKey, 'ultimate'>, { plan: string; tile: string }> = {
  free: { plan: '#3a5bff', tile: '#c9defa' },
  solo: { plan: '#006b3b', tile: '#86e6a6' },
  team: { plan: '#cc0aa2', tile: '#f7bce6' },
  business: { plan: '#6d4fd6', tile: '#ddd6fb' },
};

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function channelsLine(key: PlanKey): string {
  const c = PLANS[key].limits.channels;
  return c === null ? 'Unlimited channels' : `Up to ${fmt(c)} channels`;
}

function creditsLine(key: PlanKey): string {
  const c = PLANS[key].limits.aiCredits;
  return c === null ? 'Unlimited AI credits' : `${fmt(c)} AI credits/mo`;
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

        {/* Cards — pt-4 leaves room for the icon tiles poking above headers. */}
        <div className="mt-10 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((key, idx) => {
            const p = PLANS[key];
            const featured = !!p.featured;
            const colors = CARD_COLORS[key as Exclude<PlanKey, 'ultimate'>];
            const ctaHref = key === 'free' ? '/login' : '/billing';
            const ctaLabel = key === 'free' ? 'Start free' : `Choose ${p.label}`;
            const perMonth = key === 'free' ? null : Math.round(monthlyEquivalent(key));
            const prevLabel = idx > 0 ? PLANS[PLAN_ORDER[idx - 1]].label : null;
            return (
              <article key={key} className="relative flex flex-col rounded-[28px] bg-[#f9f8f6] pb-7">
                {/* Colored header */}
                <header
                  className="relative min-h-[120px] rounded-[28px_28px_20px_20px] px-4 pb-5 pt-5 text-white"
                  style={{ backgroundColor: colors.plan }}
                >
                  {/* Icon tile removed per user request */}
                  {featured ? (
                    <span className="absolute right-3.5 top-3.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-[#0d0d0d]">
                      Most popular
                    </span>
                  ) : null}
                  <p className="m-0 text-lg font-semibold leading-tight">{p.label}</p>
                  <p className="m-0 mt-1 max-w-[30ch] text-sm leading-snug text-white/85">{p.blurb}</p>
                </header>

                {/* Body */}
                <div className="flex flex-1 flex-col px-4 pt-6">
                  <p className="m-0 font-display text-[28px] font-medium leading-none tracking-tight text-ink">
                    {key === 'free' ? 'Free' : `${formatUsd(perMonth ?? 0)}/mo`}
                  </p>
                  <p className="mb-5 mt-1.5 flex items-center gap-1 text-xs text-ink">
                    {key === 'free'
                      ? 'Free forever. No card needed.'
                      : interval === 'annual'
                        ? `Billed ${formatUsd(priceFor(key, 'annual'))} yearly · save ${annualSavingsPct(key)}%`
                        : `Billed monthly · or ${formatUsd(Math.round(monthlyEquivalent(key)))}/mo yearly (save ${annualSavingsPct(key)}%)`}
                  </p>

                  {/* Quota fields */}
                  <div className="mb-6 grid gap-2">
                    <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-[#dedcd7] bg-white px-3 text-sm text-ink">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-[#3b82f6]" fill="currentColor" aria-hidden="true">
                        <path d="M8 1c.4 3.6 1.9 5.6 6 7-4.1 1.4-5.6 3.4-6 7-.4-3.6-1.9-5.6-6-7 4.1-1.4 5.6-3.4 6-7Z" />
                      </svg>
                      {channelsLine(key)}
                    </div>
                    <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-[#dedcd7] bg-white px-3 text-sm text-ink">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-[#3f9e6b]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                        <ellipse cx="6" cy="5" rx="4" ry="2" />
                        <path d="M2 5v3c0 1.1 1.8 2 4 2s4-.9 4-2V5" />
                        <path d="M6 10v1c0 1.1 1.8 2 4 2s4-.9 4-2V8c0-1.1-1.8-2-4-2" />
                      </svg>
                      {creditsLine(key)}
                    </div>
                  </div>

                  {prevLabel ? (
                    <p className="mb-2 text-xs italic text-[#5d5b57]">Everything in {prevLabel}, plus…</p>
                  ) : null}

                  <ul className="m-0 mb-8 grid list-none gap-1.5 p-0">
                    {p.points.map((pt) => (
                      <li key={pt} className="relative pl-3 text-xs leading-relaxed text-ink">
                        <span aria-hidden="true" className="absolute left-0.5 top-[0.55em] h-[3px] w-[3px] rounded-full bg-[#8a8883]" />
                        {pt}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex flex-col items-center gap-3">
                    <Link
                      href={ctaHref}
                      className={`inline-flex h-11 w-full items-center justify-center rounded-[10px] border text-sm font-medium transition-colors ${
                        featured
                          ? 'border-[#0d0d0d] bg-[#0d0d0d] text-white hover:bg-[#2a2a2a]'
                          : 'border-[#0d0d0d] bg-white text-ink hover:bg-[#f1f0ed]'
                      }`}
                    >
                      {ctaLabel}
                    </Link>
                    <Link href="#compare" className="text-sm text-ink underline underline-offset-[3px]">
                      See full comparison
                    </Link>
                  </div>
                </div>
              </article>
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
