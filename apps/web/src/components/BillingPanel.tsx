'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceFor, priceLabel, formatUsd, monthlyEquivalent,
  annualSavingsPct, type BillingInterval, type PlanKey,
} from '@/lib/billing/plans';
import type { UsageSnapshot } from '@/lib/billing/usage';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';
import SegmentedPills from '@/components/ui/segmented-pills';
import { CARD_COLORS, channelsLine, creditsLine, perMonth } from '@/components/PricingPlans';

interface EntitlementView {
  plan: PlanKey;
  billingInterval: BillingInterval | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  active: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Billing panel. Shows the REAL price for the REAL interval (an annual
 * subscriber sees "$290/year · ≈ $25/month", never "$29/month"), the
 * usage period vs billing period distinction, and plan changes that always
 * respect the selected billing interval.
 */
export default function BillingPanel({
  entitlement,
  usage,
  stripeReady,
  showWatermark,
  watermarkRequired,
}: {
  entitlement: EntitlementView;
  usage: UsageSnapshot;
  stripeReady: boolean;
  showWatermark: boolean;
  watermarkRequired: boolean;
}) {
  const router = useRouter();
  const t = useT(appMessages);
  const [interval, setInterval] = useState<BillingInterval>(entitlement.billingInterval ?? 'monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wm, setWm] = useState(showWatermark);
  const [wmBusy, setWmBusy] = useState(false);

  const toggleWatermark = async () => {
    const next = !wm;
    setWmBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/workspace/watermark', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ show: next }),
      });
      const data = (await res.json()) as { showWatermark?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('blErrSave'));
      setWm(data.showWatermark ?? next);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('blErrSave'));
    } finally {
      setWmBusy(false);
    }
  };

  const select = async (plan: Exclude<PlanKey, 'free'>) => {
    setBusy(plan);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch('/api/billing/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      });
      const text = await res.text();
      let data: { url?: string; mode?: string; error?: string };
      try {
        data = text ? (JSON.parse(text) as { url?: string; mode?: string; error?: string }) : {};
      } catch {
        throw new Error(`Billing request failed (status ${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? t('blErrStart'));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setNotice(fill(t('blPlanUpdated'), { plan: PLANS[plan].label, interval: interval === 'annual' ? t('blAnnual') : t('blMonthly') }));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('blErrStart'));
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    setErr(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? t('blErrPortal'));
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('blErrPortal'));
    } finally {
      setBusy(null);
    }
  };

  const setCancel = async (cancel: boolean) => {
    setBusy(cancel ? 'cancel' : 'resume');
    setErr(null);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cancel }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('blErrUpdate'));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('blErrUpdate'));
    } finally {
      setBusy(null);
    }
  };

  const plan = PLANS[entitlement.plan];
  const intervalText = entitlement.billingInterval === 'annual' ? t('blAnnual') : entitlement.billingInterval === 'monthly' ? t('blMonthly') : '-';
  const paid = entitlement.active;
  /** The plan's pastel from the pricing cards (Ultimate borrows Business's). */
  const tone =
    CARD_COLORS[(paid ? (entitlement.plan === 'ultimate' ? 'business' : entitlement.plan) : 'free') as Exclude<PlanKey, 'ultimate'>];

  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {/* ---- current plan: the pricing card's pastel header, then the details ---- */}
      <section className="overflow-hidden rounded-[28px] border border-line bg-card" aria-label={t('blCurrentPlan')}>
        <header className="relative px-5 pt-5 pb-5" style={{ backgroundColor: tone.bg, color: tone.ink }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: tone.sub }}>
              {t('blCurrentPlan')}
            </p>
            {entitlement.cancelAtPeriodEnd ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[#9F2F2D]">{t('blCancelsEnd')}</span>
            ) : paid ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold capitalize" style={{ color: tone.ink }}>
                {entitlement.status}
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-display text-3xl leading-none font-extrabold tracking-tight">{plan.label}</p>
          <p className="mt-1.5 max-w-[42ch] text-sm" style={{ color: tone.sub }}>{plan.blurb}</p>
        </header>
        <div className="p-5">
          <p className="font-display text-[28px] leading-none font-medium tracking-tight text-ink">
            {entitlement.plan === 'ultimate'
              ? t('blOnce')
              : paid && entitlement.billingInterval
                ? priceLabel(entitlement.plan, entitlement.billingInterval)
                : t('prFree')}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {entitlement.plan === 'ultimate'
              ? t('blLifetime').replace(/^ · /, '')
              : paid && entitlement.billingInterval === 'annual'
                ? fill(t('blPerMonth'), { price: formatUsd(monthlyEquivalent(entitlement.plan)) })
                : paid
                  ? t('blBilledMonthly').replace(/^ · /, '')
                  : t('blFreePlan')}
          </p>
          {paid && entitlement.plan !== 'ultimate' ? (
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-[10px] border border-line bg-surface/60 px-3 py-2">
                <dt className="text-[11px] font-bold text-muted">{t('blBilling')}</dt>
                <dd className="font-bold">{intervalText}</dd>
              </div>
              <div className="rounded-[10px] border border-line bg-surface/60 px-3 py-2">
                <dt className="text-[11px] font-bold text-muted">{t('blNextDate')}</dt>
                <dd className="font-bold">{entitlement.cancelAtPeriodEnd ? '-' : fmtDate(entitlement.currentPeriodEnd)}</dd>
              </div>
              <div className="rounded-[10px] border border-line bg-surface/60 px-3 py-2">
                <dt className="text-[11px] font-bold text-muted">{t('blCurrentPeriod')}</dt>
                <dd className="font-bold">
                  {fmtDate(entitlement.currentPeriodStart)} → {fmtDate(entitlement.currentPeriodEnd)}
                </dd>
              </div>
            </dl>
          ) : null}
          {entitlement.cancelAtPeriodEnd ? (
            <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
              {fill(t('blCancelNote'), { date: fmtDate(entitlement.currentPeriodEnd) })}
            </p>
          ) : null}
          {paid && entitlement.plan !== 'ultimate' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={openPortal} disabled={busy !== null} className="btn btn-ghost">
                {busy === 'portal' ? t('blOpening') : t('blManageStripe')}
              </button>
              {entitlement.cancelAtPeriodEnd ? (
                <button type="button" onClick={() => setCancel(false)} disabled={busy !== null} className="btn btn-bolt">
                  {busy === 'resume' ? t('blResuming') : t('blResume')}
                </button>
              ) : (
                <button type="button" onClick={() => setCancel(true)} disabled={busy !== null} className="btn btn-ghost">
                  {busy === 'cancel' ? t('blCancelling') : t('blCancelEnd')}
                </button>
              )}
            </div>
          ) : !paid ? (
            <a href="#change-plan" className="btn btn-primary mt-4 w-full sm:w-auto">
              {t('blUpgradeBtn')}
            </a>
          ) : null}
        </div>
      </section>

      {/* ---- usage (monthly window, even on annual) ---- */}
      <section className="card h-full p-5" aria-label={t('blUsage')}>
        <p className="eyebrow">{fill(t('blUsage'), { month: usage.month })}</p>
        <p className="mt-1 text-xs text-muted">
          {t('blUsageNote')}
        </p>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{t('blAiCredits')}</span>
              <span className="text-muted">
                {usage.aiCreditsLimit === null
                  ? `${usage.aiCreditsUsed.toLocaleString()} used · unlimited`
                  : `${usage.aiCreditsUsed.toLocaleString()} / ${usage.aiCreditsLimit.toLocaleString()} used · ${usage.aiCreditsRemaining!.toLocaleString()} left`}
              </span>
            </div>
            {usage.aiCreditsLimit !== null ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${Math.min(100, Math.round((usage.aiCreditsUsed / usage.aiCreditsLimit) * 100))}%` }}
                />
              </div>
            ) : null}
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{t('blScheduled')}</span>
              <span className="text-muted">
                {usage.scheduledPerChannelLimit === null
                  ? `${usage.scheduledTotal.toLocaleString()} scheduled · unlimited per channel`
                  : `${usage.scheduledTotal.toLocaleString()} scheduled · ${usage.scheduledPerChannelLimit.toLocaleString()} per channel`}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{t('blConnectedChannels')}</span>
              <span className="text-muted">
                {usage.channelsLimit === null
                  ? `${usage.channelsConnected.toLocaleString()} connected across your teams · unlimited`
                  : `${usage.channelsConnected.toLocaleString()} / ${usage.channelsLimit.toLocaleString()} connected across your teams`}
              </span>
            </div>
            {usage.channelsLimit !== null ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${Math.min(100, Math.round((usage.channelsConnected / usage.channelsLimit) * 100))}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
        {usage.aiCreditsLimit !== null && usage.aiCreditsUsed >= usage.aiCreditsLimit ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            {t('blAiOut')}{' '}
            <a className="font-bold underline" href="#change-plan">{t('blUpgradeMore')}</a>.
          </p>
        ) : usage.aiCreditsLimit !== null && usage.aiCreditsRemaining !== null && usage.aiCreditsRemaining <= 5 ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            {fill(t('blAiLow'), { n: usage.aiCreditsRemaining.toLocaleString() })}{' '}
            1st, <a className="font-bold underline" href="#change-plan">{t('blUpgradeBigger')}</a>.
          </p>
        ) : null}
        {usage.channelsLimit !== null && usage.channelsConnected >= usage.channelsLimit ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            {fill(t('blChannelsOut'), { n: usage.channelsLimit.toLocaleString() })}{' '}
            <a className="font-bold underline" href="#change-plan">{t('blUpgradeWord')}</a> {t('blToAddMore')}
          </p>
        ) : null}
      </section>

      {/* ---- watermark (brand) ---- */}
      <section className="card p-5 lg:col-span-2" aria-label={t('blWatermark')}>
        <p className="eyebrow">{t('blBrand')}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{t('blWatermark')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {watermarkRequired
                ? t('blWmRequired')
                : t('blWmFree')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={watermarkRequired ? true : wm}
            disabled={wmBusy || watermarkRequired}
            onClick={toggleWatermark}
            className={`pill border shrink-0 ${
              watermarkRequired
                ? 'cursor-not-allowed border-line bg-surface text-muted'
                : wm
                  ? 'border-ink bg-[#191512] text-white dark:bg-[#191512]'
                  : 'border-line bg-card text-soft'
            }`}
          >
            {watermarkRequired ? t('blWmRequiredTag') : wmBusy ? t('tmSaving') : wm ? t('blOn') : t('blOff')}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {watermarkRequired ? t('blWmRequiredLine') : wm ? t('blWmCustomOn') : t('blWmCustomOff')}
        </p>
      </section>

      {/* ---- change plan: the same cards as the public pricing page ---- */}
      <section id="change-plan" className="scroll-mt-24 pt-3 lg:col-span-2" aria-label={t('blChangePlan')}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{t('blChangePlan')}</p>
            <p className="mt-1 text-xs text-muted">{stripeReady ? t('blChangeNote') : t('blStripeNote')}</p>
          </div>
          <SegmentedPills
            ariaLabel={t('blIntervalAria')}
            value={interval}
            onChange={setInterval}
            options={(['monthly', 'annual'] as const).map((i) => ({
              value: i,
              label: i === 'monthly' ? t('blMonthly') : fill(t('blAnnualSave'), { n: annualSavingsPct('team') }),
            }))}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((k, idx) => {
            const p = PLANS[k];
            const c = CARD_COLORS[k as Exclude<PlanKey, 'ultimate'>];
            const current = k === 'free' ? !paid : paid && entitlement.plan === k;
            const prevLabel = idx > 0 ? PLANS[PLAN_ORDER[idx - 1]].label : null;
            const higher = !paid || PLAN_ORDER.indexOf(k) > PLAN_ORDER.indexOf(entitlement.plan);
            return (
              <article
                key={k}
                className={`relative flex flex-col rounded-[28px] bg-surface pb-6 ${current ? 'ring-2 ring-ink' : ''}`}
              >
                <header
                  className="relative min-h-[112px] rounded-[28px_28px_20px_20px] px-4 pt-5 pb-5"
                  style={{ backgroundColor: c.bg, color: c.ink }}
                >
                  {current || p.featured ? (
                    <span
                      className="absolute top-3.5 right-3.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium"
                      style={{ color: c.ink }}
                    >
                      {current ? t('blCurrentPlan') : t('prMostPopular')}
                    </span>
                  ) : null}
                  <p className="m-0 text-lg leading-tight font-semibold">{p.label}</p>
                  <p className="m-0 mt-1 max-w-[30ch] text-sm leading-snug" style={{ color: c.sub }}>{p.blurb}</p>
                </header>

                <div className="flex flex-1 flex-col px-4 pt-5">
                  <p className="m-0 font-display text-[28px] leading-none font-medium tracking-tight text-ink">
                    {k === 'free' ? t('prFree') : fill(t('prPerMo'), { price: formatUsd(perMonth(k, interval)) })}
                  </p>
                  <p className="mt-1.5 mb-4 text-xs text-muted">
                    {k === 'free'
                      ? t('prFreeForever')
                      : interval === 'annual'
                        ? fill(t('prBilledYearly'), { price: formatUsd(priceFor(k, 'annual')) })
                        : t('blBilledMonthly').replace(/^ · /, '')}
                  </p>

                  <div className="mb-4 grid gap-2">
                    <div className="flex h-10 items-center gap-2.5 rounded-[10px] border border-line bg-card px-3 text-sm text-ink">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-[#3b82f6]" fill="currentColor" aria-hidden="true">
                        <path d="M8 1c.4 3.6 1.9 5.6 6 7-4.1 1.4-5.6 3.4-6 7-.4-3.6-1.9-5.6-6-7 4.1-1.4 5.6-3.4 6-7Z" />
                      </svg>
                      {channelsLine(k, t)}
                    </div>
                    <div className="flex h-10 items-center gap-2.5 rounded-[10px] border border-line bg-card px-3 text-sm text-ink">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-[#3f9e6b]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                        <ellipse cx="6" cy="5" rx="4" ry="2" />
                        <path d="M2 5v3c0 1.1 1.8 2 4 2s4-.9 4-2V5" />
                        <path d="M6 10v1c0 1.1 1.8 2 4 2s4-.9 4-2V8c0-1.1-1.8-2-4-2" />
                      </svg>
                      {creditsLine(k, t)}
                    </div>
                  </div>

                  {prevLabel ? (
                    <p className="mb-2 text-xs text-muted italic">{fill(t('prEverythingIn'), { plan: prevLabel })}</p>
                  ) : null}
                  <ul className="m-0 mb-6 grid list-none gap-1.5 p-0">
                    {p.points.map((pt) => (
                      <li key={pt} className="relative pl-3 text-xs leading-relaxed text-ink">
                        <span aria-hidden="true" className="absolute top-[0.55em] left-0.5 h-[3px] w-[3px] rounded-full bg-faint" />
                        {pt}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {current ? (
                      <button type="button" disabled className="btn btn-ghost w-full">
                        {t('blActive')}
                      </button>
                    ) : k === 'free' ? (
                      // Moving to Free is a cancellation: the paid plan runs to the period's end.
                      <button
                        type="button"
                        onClick={() => setCancel(true)}
                        disabled={busy !== null || entitlement.cancelAtPeriodEnd || entitlement.plan === 'ultimate'}
                        className="btn btn-ghost w-full"
                      >
                        {entitlement.cancelAtPeriodEnd
                          ? t('blCancelsEnd')
                          : busy === 'cancel'
                            ? t('blCancelling')
                            : t('blCancelEnd')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null || !stripeReady}
                        onClick={() => select(k as Exclude<PlanKey, 'free'>)}
                        className={`btn w-full ${higher && p.featured ? 'btn-primary' : higher ? 'btn-bolt' : 'btn-ghost'}`}
                      >
                        {busy === k ? t('blWorking') : higher ? fill(t('prChoose'), { plan: p.label }) : t('blSwitch')}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {notice ? <p className="card p-4 lg:col-span-2 text-sm font-bold text-[#2f8f5b]">{notice}</p> : null}
      {err ? <p className="card p-4 lg:col-span-2 text-sm font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{err}</p> : null}
    </div>
  );
}
