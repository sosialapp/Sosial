'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceFor, formatUsd, monthlyEquivalent, annualSavingsPct,
  type BillingInterval, type PlanKey,
} from '@/lib/billing/plans';

/**
 * Pricing band, Clay-style: icon + name + blurb per plan, one big price,
 * a quota headline straight from enforced limits, then an incremental
 * "Everything in X, plus…" bullet list (each tier strictly dominates the
 * previous one, so the framing is honest). Featured plan rides dark.
 * Card content (prices, limits, points, CTAs) comes from the canonical
 * PLANS config — the numbers here are exactly what billing enforces.
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

function PlanIcon({ plan, featured }: { plan: PlanKey; featured?: boolean }) {
  const cls = `h-6 w-6 ${featured ? 'text-paper' : 'text-ink'}`;
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
        featured ? 'bg-paper/10' : 'bg-ink/[0.06]'
      }`}
    >
      {plan === 'free' ? (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <path d="M12 2c1 6.5 4 9.5 10 10.5-6 1-9 4-10 10.5-1-6.5-4-9.5-10-10.5 6-1 9-4 10-10.5Z" />
        </svg>
      ) : plan === 'solo' ? (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      ) : plan === 'team' ? (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.5 19c1.2-3 3.2-4.3 5.5-4.3s4.3 1.3 5.5 4.3" />
          <circle cx="16.5" cy="9.5" r="2.4" />
          <path d="M15.5 14.6c2.3.2 4 1.5 5 4.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <rect x="4" y="7.5" width="16" height="12.5" rx="2" />
          <path d="M9 7.5V6a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v1.5M4 12.5h16" />
        </svg>
      )}
    </span>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

/** "Up to 6 channels · 500 AI credits/mo" — null limits read as Unlimited. */
function quotaLine(key: PlanKey): string {
  const l = PLANS[key].limits;
  const channels = l.channels === null ? 'Unlimited channels' : `Up to ${fmt(l.channels)} channels`;
  const credits = l.aiCredits === null ? 'Unlimited AI credits' : `${fmt(l.aiCredits)} AI credits/mo`;
  return `${channels} · ${credits}`;
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
          {PLAN_ORDER.map((key, idx) => {
            const p = PLANS[key];
            const featured = !!p.featured;
            const ctaHref = key === 'free' ? '/login' : '/billing';
            const ctaLabel = key === 'free' ? 'Start free' : `Choose ${p.label}`;
            const perMonth =
              key === 'free' ? null : Math.round(monthlyEquivalent(key));
            const prevLabel = idx > 0 ? PLANS[PLAN_ORDER[idx - 1]].label : null;
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

                <PlanIcon plan={key} featured={featured} />

                <p className={`mt-4 text-sm font-bold ${featured ? 'text-paper/70' : 'text-muted'}`}>
                  {p.label}
                </p>
                <p className={`mt-1 text-[13px] leading-snug ${featured ? 'text-paper/60' : 'text-faint'}`}>
                  {p.blurb}
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

                <p className={`mt-4 border-t pt-4 text-[13px] font-bold ${featured ? 'border-paper/15 text-paper' : 'border-line text-ink'}`}>
                  {quotaLine(key)}
                </p>

                {prevLabel ? (
                  <p className={`mt-4 text-xs font-semibold ${featured ? 'text-paper/60' : 'text-faint'}`}>
                    Everything in {prevLabel}, plus…
                  </p>
                ) : null}

                <ul className="mt-3 flex-1 space-y-3">
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
          Cancel any time, keep your data.{' '}
          <a href="#compare" className="font-bold text-ink hover:underline">
            See full plan comparison
          </a>
        </p>
      </div>
    </section>
  );
}
