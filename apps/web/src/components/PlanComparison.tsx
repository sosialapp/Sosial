'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  // Deep-linking from the cards ("See full plan comparison" → #compare)
  // opens the table on arrival.
  useEffect(() => {
    if (window.location.hash === '#compare') setOpen(true);
  }, []);

  return (
    <section aria-label="Plan comparison" id="compare" className="relative scroll-mt-20 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(28,26,20,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,26,20,0.04)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_30%,#000_20%,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="group inline-flex items-center gap-2.5 rounded-full border border-line bg-white/80 py-3 pr-4 pl-6 text-sm font-bold text-ink shadow-[0_2px_10px_rgba(28,26,20,0.06)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_-2px_rgba(28,26,20,0.18)]"
          >
            See full plan comparison
            <span
              aria-hidden="true"
              className={`grid h-7 w-7 place-items-center rounded-full bg-ink/[0.06] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>

        {open ? (
        <>
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
        </>
        ) : null}
      </div>
    </section>
  );
}
