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

  return (
    <div className="space-y-3">
      {/* ---- current plan ---- */}
      <section className="card p-5" aria-label={t('blCurrentPlan')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">{t('blCurrentPlan')}</p>
          {entitlement.cancelAtPeriodEnd ? (
            <span className="pill bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{t('blCancelsEnd')}</span>
          ) : paid ? (
            <span className="pill bg-[#e8f3ec] text-[#2f8f5b] dark:bg-[#1b2a20] dark:text-[#7fd0a0]">{entitlement.status}</span>
          ) : null}
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">{plan.label}</p>
        <p className="mt-1 text-sm text-muted">
          {entitlement.plan === 'ultimate' ? (
            <>
              <span className="font-bold text-ink">{t('blOnce')}</span>{t('blLifetime')}
            </>
          ) : paid && entitlement.billingInterval ? (
            <>
              <span className="font-bold text-ink">
                {priceLabel(entitlement.plan, entitlement.billingInterval)}
              </span>
              {entitlement.billingInterval === 'annual' ? (
                <> · ≈ {formatUsd(monthlyEquivalent(entitlement.plan))}/month, billed annually</>
              ) : (
                <>{t('blBilledMonthly')}</>
              )}
            </>
          ) : (
            t('blFreePlan')
          )}
        </p>
        {paid && entitlement.plan !== 'ultimate' ? (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-muted">{t('blBilling')}</dt>
              <dd>{intervalText}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">{t('blNextDate')}</dt>
              <dd>
                {entitlement.cancelAtPeriodEnd
                  ? `None, access ends ${fmtDate(entitlement.currentPeriodEnd)}`
                  : fmtDate(entitlement.currentPeriodEnd)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold text-muted">{t('blCurrentPeriod')}</dt>
              <dd>
                {fmtDate(entitlement.currentPeriodStart)} → {fmtDate(entitlement.currentPeriodEnd)}
              </dd>
            </div>
          </dl>
        ) : null}
        {entitlement.cancelAtPeriodEnd ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            {fill(t('blCancelNote'), { date: fmtDate(entitlement.currentPeriodEnd) })}          </p>        ) : null}
        {paid && entitlement.plan !== 'ultimate' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={openPortal} disabled={busy !== null} className="btn btn-ghost">              {busy === 'portal' ? t('blOpening') : t('blManageStripe')}
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
        ) : null}
      </section>

      {/* ---- usage (monthly window, even on annual) ---- */}
      <section className="card p-5" aria-label={t('blUsage')}>
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
      <section className="card p-5" aria-label={t('blWatermark')}>
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

      {/* ---- change plan ---- */}
      <section id="change-plan" className="card scroll-mt-24 p-5" aria-label={t('blChangePlan')}>
        <p className="eyebrow">{t('blChangePlan')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t('blIntervalAria')}>
          {(['monthly', 'annual'] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              aria-pressed={interval === i}
              className={`pill border ${interval === i ? 'border-ink bg-[#191512] text-white' : 'border-line bg-card text-soft'}`}
            >
              {i === 'monthly' ? t('blMonthly') : fill(t('blAnnualSave'), { n: annualSavingsPct('team') })}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {PLAN_ORDER.filter((k) => k !== 'free').map((k) => {
            const p = PLANS[k];
            const current = entitlement.plan === k && entitlement.active;
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {p.label}
                    {current ? <span className="ml-2 text-xs font-medium text-muted">{t('blCurrent')}</span> : null}
                  </p>
                  <p className="text-xs text-muted">{p.blurb}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{priceLabel(k, interval)}</p>
                  {interval === 'annual' ? (
                    <p className="text-xs text-muted">{fill(t('blPerMonth'), { price: formatUsd(monthlyEquivalent(k)) })}</p>
                  ) : (
                    <p className="text-xs text-muted">{t('blBilledMonthly')}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy !== null || current || !stripeReady}
                  onClick={() => select(k)}
                  className={`btn shrink-0 ${current ? 'btn-ghost' : 'btn-bolt'}`}
                >
                  {current
                    ? t('blActive')
                    : busy === k
                      ? t('blWorking')
                      : priceFor(k, interval) < priceFor(entitlement.plan as Exclude<PlanKey, 'free'>, interval) || !paid
                        ? t('blUpgradeBtn')
                        : t('blSwitch')}
                </button>
              </div>
            );
          })}
        </div>

        {!stripeReady ? (
          <p className="mt-3 text-xs text-muted">
            {t('blStripeNote')}
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">
            {t('blChangeNote')}
          </p>
        )}
      </section>

      {notice ? <p className="card p-4 text-sm font-bold text-[#2f8f5b]">{notice}</p> : null}
      {err ? <p className="card p-4 text-sm font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{err}</p> : null}
    </div>
  );
}
