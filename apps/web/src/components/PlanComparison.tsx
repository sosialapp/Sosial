'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, formatUsd, monthlyEquivalent, priceFor,
  type BillingInterval, type PlanKey,
} from '@/lib/billing/plans';
import { FEATURE_MATRIX, FEATURE_PLAN_ORDER } from '@/lib/billing/features';

/**
 * Full plan comparison. Limit values are generated from the canonical PLANS
 * config via FEATURE_MATRIX, so the table can never drift from what the
 * server enforces. The header shows one mini-card per plan (price + CTA)
 * with its own monthly/yearly toggle, which flips the displayed prices.
 */
function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="text-ink" aria-label="Included">
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-faint" aria-label="Not included">
        —
      </span>
    );
  }
  return <span className="text-soft">{value}</span>;
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
    <section aria-label="Plan comparison" className="border-b border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Compare plans</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Every limit, side by side.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Scheduled posts are counted per connected channel and free up the moment a post
            publishes. AI credits reset on the 1st of every month, on every plan.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="w-[190px] min-w-[190px] p-1.5 align-bottom">
                  <p className="font-display text-lg font-bold text-ink">Plans</p>
                  <p className="mt-1 text-sm text-muted">Save with yearly billing!</p>
                  <div
                    className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-line p-1"
                    role="group"
                    aria-label="Billing interval"
                  >
                    {(['monthly', 'annual'] as const).map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setInterval(i)}
                        aria-pressed={interval === i}
                        className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                          interval === i ? 'bg-[#191512] text-white' : 'bg-transparent text-soft'
                        }`}
                      >
                        {i === 'monthly' ? 'Monthly' : 'Yearly'}
                      </button>
                    ))}
                  </div>
                </th>
                {FEATURE_PLAN_ORDER.map((key) => {
                  const p = PLANS[key];
                  return (
                    <th key={key} scope="col" className="min-w-[160px] p-1.5 align-bottom">
                      <div
                        className={`relative rounded-2xl p-4 text-center ${
                          p.featured
                            ? 'border-2 border-accent bg-white'
                            : 'border border-line bg-white'
                        }`}
                      >
                        {p.featured ? (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold whitespace-nowrap text-accent-ink">
                            Most popular
                          </span>
                        ) : null}
                        <p className="eyebrow">{p.label}</p>
                        <p className="mt-2 font-display text-2xl font-bold text-ink">
                          {headerPrice(key, interval)}
                        </p>
                        <p className="mt-1 min-h-8 text-[11px] leading-snug text-faint">
                          {headerSub(key, interval)}
                        </p>
                        <Link
                          href={key === 'free' ? '/login' : '/billing'}
                          className={`mt-3 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                            p.featured
                              ? 'bg-[#191512] text-white hover:bg-[#2a261d]'
                              : 'border border-line text-soft hover:border-ink hover:bg-paper-dim'
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
                    className="pt-7 pb-2 text-left"
                  >
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                      {cat.title}
                    </span>
                  </th>
                </tr>
                {cat.rows.map((row) => (
                  <tr key={row.label} className="border-b border-line/70">
                    <th scope="row" className="py-3 pr-4 text-left text-sm font-medium text-soft">
                      {row.label}
                    </th>
                    {FEATURE_PLAN_ORDER.map((key) => (
                      <td key={key} className="py-3 text-center text-sm">
                        <Cell value={row.value(key)} />
                      </td>
                    ))}
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
