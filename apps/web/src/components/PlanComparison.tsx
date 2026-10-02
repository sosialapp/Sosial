'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, formatUsd, monthlyEquivalent, priceFor,
  type BillingInterval, type PlanKey,
} from '@/lib/billing/plans';
import { FEATURE_MATRIX, FEATURE_PLAN_ORDER } from '@/lib/billing/features';
import { CheckIcon, CrossIcon } from '@/components/StatusIcons';

/**
 * Full plan comparison — simple modern, matching the pricing cards: grid
 * wash header, pill interval toggle, one elevated featured column, soft
 * row striping and section dividers. Limit values are generated from the
 * canonical PLANS config via FEATURE_MATRIX, so the table can never drift
 * from what the server enforces.
 */
function Cell({ value, featured }: { value: string | boolean; featured?: boolean }) {
  if (value === true) {
    return (
      <span className={`inline-flex ${featured ? 'text-accent' : 'text-ink'}`} aria-label="Included">
        <CheckIcon size={16} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className={`inline-flex ${featured ? 'text-paper/30' : 'text-faint/50'}`} aria-label="Not included">
        <CrossIcon size={15} />
      </span>
    );
  }
  return <span className={`text-sm font-semibold ${featured ? 'text-paper' : 'text-ink'}`}>{value}</span>;
}

function headerPrice(key: PlanKey, interval: BillingInterval): string {
  if (key === 'free') return 'Free';
  return interval === 'monthly'
    ? `${formatUsd(priceFor(key, 'monthly'))}/mo`
    : `${formatUsd(Math.round(monthlyEquivalent(key)))}/mo`;
}

function headerSub(key: PlanKey, interval: BillingInterval): string {
  if (key === 'free') return 'forever';
  return interval === 'monthly' ? 'per month' : `per month · billed ${formatUsd(priceFor(key, 'annual'))} yearly`;
}

export default function PlanComparison() {
  const [interval, setInterval] = useState<BillingInterval>('annual');

  return (
    <section aria-label="Plan comparison" className="relative overflow-hidden">
      {/* Grid wash, same family as the cards above. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(28,26,20,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,26,20,0.04)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_30%,#000_20%,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Compare plans</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            Every limit, side by side.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Scheduled posts are counted per connected channel and free up the moment a post
            publishes. AI credits reset on the 1st of every month, on every plan.
          </p>
        </div>

        {/* Interval toggle — same pill as the cards */}
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
                  interval === i ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {i === 'monthly' ? 'Monthly' : 'Annual'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 overflow-x-auto pb-2 [scrollbar-width:thin]">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className="w-[200px] min-w-[200px] p-1.5 align-bottom" />
                {FEATURE_PLAN_ORDER.map((key) => {
                  const p = PLANS[key];
                  const featured = !!p.featured;
                  return (
                    <th key={key} scope="col" className="min-w-[150px] p-1.5 align-bottom">
                      <div
                        className={`relative rounded-3xl p-5 text-center transition-all duration-200 ${
                          featured
                            ? 'bg-ink text-paper shadow-[0_24px_60px_-24px_rgba(28,26,20,0.5)]'
                            : 'border border-line bg-white/80 backdrop-blur-sm'
                        }`}
                      >
                        {featured ? (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold tracking-wide whitespace-nowrap text-accent-ink uppercase">
                            Most popular
                          </span>
                        ) : null}
                        <p className={`text-sm font-bold ${featured ? 'text-paper/70' : 'text-muted'}`}>{p.label}</p>
                        <p className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${featured ? 'text-paper' : 'text-ink'}`}>
                          {headerPrice(key, interval)}
                        </p>
                        <p className={`mt-1 min-h-8 text-[11px] leading-snug ${featured ? 'text-paper/60' : 'text-faint'}`}>
                          {headerSub(key, interval)}
                        </p>
                        <Link
                          href={key === 'free' ? '/login' : '/billing'}
                          className={`mt-3 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_0_-2px_rgba(28,26,20,0.22)] active:translate-y-0 ${
                            featured
                              ? 'bg-accent text-accent-ink hover:bg-accent-bright'
                              : 'border-2 border-ink/10 text-ink hover:border-ink'
                          }`}
                        >
                          {key === 'free' ? 'Start free' : `Choose ${p.label}`}
                        </Link>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {FEATURE_MATRIX.map((cat) => (
              <tbody key={cat.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={1 + FEATURE_PLAN_ORDER.length}
                    className="pt-10 pb-2 text-left"
                  >
                    <span className="font-display text-xs font-bold tracking-[0.14em] text-faint uppercase">
                      {cat.title}
                    </span>
                  </th>
                </tr>
                {cat.rows.map((row, ri) => (
                  <tr key={row.label} className={ri % 2 === 0 ? '' : ''}>
                    <th
                      scope="row"
                      className={`border-b border-line/60 py-3.5 pr-4 text-left text-sm font-medium text-soft ${ri === 0 ? 'rounded-l-xl border-t border-t-line/60 bg-white/50 pl-3' : ''}`}
                    >
                      {row.label}
                    </th>
                    {FEATURE_PLAN_ORDER.map((key, ki) => {
                      const featured = !!PLANS[key].featured;
                      return (
                        <td
                          key={key}
                          className={`border-b border-line/60 py-3.5 text-center ${
                            featured ? 'bg-ink/[0.035]' : ''
                          } ${ri === 0 ? 'border-t border-t-line/60' : ''} ${
                            ki === FEATURE_PLAN_ORDER.length - 1 && ri === 0 ? 'rounded-r-xl' : ''
                          }`}
                        >
                          <Cell value={row.value(key)} featured={featured} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}
