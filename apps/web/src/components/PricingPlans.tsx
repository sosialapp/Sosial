'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceLabel, formatUsd, monthlyEquivalent, annualSavingsPct,
  type BillingInterval,
} from '@/lib/billing/plans';

/**
 * Pricing grid with a monthly/annual toggle. The toggle swaps displayed
 * price, interval, savings and CTA — annual always shows the equivalent
 * monthly cost AND makes clear the customer is billed once a year.
 */
export default function PricingPlans() {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <section aria-label="Plans" className="border-b border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-14 md:py-20">
        <div className="flex justify-center">
          <div className="flex items-center gap-2" role="group" aria-label="Billing interval">
            {(['monthly', 'annual'] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                aria-pressed={interval === i}
                className={`pill border ${interval === i ? 'border-ink bg-[#191512] text-white' : 'border-line bg-card text-soft'}`}
              >
                {i === 'monthly' ? 'Monthly' : `Annual · save up to ${annualSavingsPct('team')}%`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((key) => {
            const p = PLANS[key];
            return (
              <div
                key={key}
                className={`card flex flex-col p-6 ${
                  p.featured ? 'border-2 border-accent shadow-[0_24px_60px_-30px_rgba(28,26,20,0.45)]' : ''
                }`}
              >
                <p className="eyebrow">{p.label}</p>
                <p className="mt-3 font-display text-4xl font-extrabold tracking-tight">
                  {priceLabel(key, interval)}
                  {key !== 'free' ? (
                    <span className="ml-1.5 align-middle text-sm font-semibold text-faint">
                      /{interval === 'monthly' ? 'month' : 'year'}
                    </span>
                  ) : null}
                </p>
                {key !== 'free' && interval === 'annual' ? (
                  <p className="mt-1 text-xs text-muted">
                    ≈ {formatUsd(monthlyEquivalent(key))}/month — billed annually
                  </p>
                ) : null}
                {key !== 'free' && interval === 'monthly' ? (
                  <p className="mt-1 text-xs text-muted">
                    or {priceLabel(key, 'annual')}/year ({annualSavingsPct(key)}% off)
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.blurb}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-sm leading-relaxed text-soft">
                      <span className="mt-0.5 text-ink" aria-hidden="true">
                        ✓
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href={key === 'free' ? '/login' : '/billing'}
                  className={`btn mt-6 w-full ${p.featured ? 'btn-bolt' : 'btn-ghost'}`}
                >
                  {key === 'free' ? 'Start free' : `Choose ${p.label}`}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-faint">
          Prices in USD. Annual plans are billed once a year and give you two months free. Cancel any time, keep your data.
        </p>
      </div>
    </section>
  );
}
