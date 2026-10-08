'use client';

import Link from 'next/link';
import {
  PLANS,
  type PlanKey,
} from '@/lib/billing/plans';
import { FEATURE_MATRIX, FEATURE_PLAN_ORDER } from '@/lib/billing/features';
import { CheckIcon } from '@/components/StatusIcons';

/**
 * Full plan comparison. Limit values are generated from the canonical PLANS
 * config via FEATURE_MATRIX, so the table can never drift from what the
 * server enforces. Light throughout: excluded features read as quiet dashes,
 * the popular plan tracks down one soft-tinted column.
 */
function Cell({ value, featured }: { value: string | boolean; featured?: boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Included">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            featured ? 'bg-accent' : 'bg-ink/[0.07]'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M5 12.5 10 17.5 19 7"
              stroke={featured ? '#1C1A14' : 'currentColor'}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={featured ? '' : 'text-ink'}
            />
          </svg>
        </span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-lg leading-none text-faint/40" aria-label="Not included">
        —
      </span>
    );
  }
  // String values are always ink — even in the tinted popular column, whose
  // background stays light (only its header card is dark).
  return (
    <span className="text-[15px] font-semibold text-ink">
      {value}
    </span>
  );
}

export default function PlanComparison() {
  return (
    <section aria-label="Plan comparison" id="compare" className="relative scroll-mt-20 overflow-hidden">
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

        <div className="mt-12 overflow-x-auto pb-4 [scrollbar-width:thin]">
          <table className="w-full min-w-[920px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className="w-[210px] min-w-[210px] p-2 align-bottom" />
                {FEATURE_PLAN_ORDER.map((key) => {
                  const p = PLANS[key];
                  return (
                    <th key={key} scope="col" className="min-w-[160px] p-2 pb-4 align-bottom">
                      <p className="text-center text-sm font-bold text-ink">{p.label}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {FEATURE_MATRIX.map((cat) => (
              <tbody key={cat.title}>
                <tr>
                  <th scope="colgroup" colSpan={1 + FEATURE_PLAN_ORDER.length} className="pt-9 pb-1 text-left">
                    <span className="font-display text-xs font-bold tracking-[0.16em] text-faint uppercase">
                      {cat.title}
                    </span>
                  </th>
                </tr>
                {cat.rows.map((row) => (
                  <tr key={row.label} className="group">
                    <th
                      scope="row"
                      className="border-b border-line/70 py-4 pr-4 text-left text-[15px] font-medium text-soft"
                    >
                      {row.label}
                    </th>
                    {FEATURE_PLAN_ORDER.map((key) => {
                      const featured = !!PLANS[key].featured;
                      return (
                        <td
                          key={key}
                          className={`border-b border-line/70 py-4 text-center ${
                            featured ? 'bg-accent/[0.08]' : ''
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

        <p className="mt-6 text-center text-xs text-faint">
          All four plans include the calendar, queue and auto-publishing.{' '}
          <Link href="/login" className="font-bold text-ink hover:underline">
            Start free
          </Link>{' '}
          — upgrade when you outgrow it.
        </p>
      </div>
    </section>
  );
}
