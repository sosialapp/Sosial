'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PLANS, PLAN_ORDER, priceFor, priceLabel, formatUsd, monthlyEquivalent,
  annualSavingsPct, type BillingInterval, type PlanKey,
} from '@/lib/billing/plans';
import type { UsageSnapshot } from '@/lib/billing/usage';

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
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Billing panel. Shows the REAL price for the REAL interval (an annual
 * subscriber sees "$290/year · ≈ $24.17/month", never "$29/month"), the
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
      if (!res.ok) throw new Error(data.error ?? 'Could not save the setting.');
      setWm(data.showWatermark ?? next);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the setting.');
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
      const data = (await res.json()) as { url?: string; mode?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not start billing.');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setNotice(`Plan updated — ${PLANS[plan].label} ${interval === 'annual' ? 'annual' : 'monthly'} is now active. Changes are prorated by Stripe.`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start billing.');
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
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not open the billing portal.');
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open the billing portal.');
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
      if (!res.ok) throw new Error(data.error ?? 'Could not update the subscription.');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update the subscription.');
    } finally {
      setBusy(null);
    }
  };

  const plan = PLANS[entitlement.plan];
  const intervalText = entitlement.billingInterval === 'annual' ? 'Annual' : entitlement.billingInterval === 'monthly' ? 'Monthly' : '—';
  const paid = entitlement.active;

  return (
    <div className="space-y-3">
      {/* ---- current plan ---- */}
      <section className="card p-5" aria-label="Current plan">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Current plan</p>
          {entitlement.cancelAtPeriodEnd ? (
            <span className="pill bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">cancels at period end</span>
          ) : paid ? (
            <span className="pill bg-[#e8f3ec] text-[#2f8f5b] dark:bg-[#1b2a20] dark:text-[#7fd0a0]">{entitlement.status}</span>
          ) : null}
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">{plan.label}</p>
        <p className="mt-1 text-sm text-muted">
          {paid && entitlement.billingInterval ? (
            <>
              <span className="font-bold text-ink">
                {priceLabel(entitlement.plan, entitlement.billingInterval)}
              </span>
              {entitlement.billingInterval === 'annual' ? (
                <> · ≈ {formatUsd(monthlyEquivalent(entitlement.plan))}/month, billed annually</>
              ) : (
                <> · billed monthly</>
              )}
            </>
          ) : (
            'Free plan — no card on file'
          )}
        </p>
        {paid ? (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-muted">Billing</dt>
              <dd>{intervalText}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Next billing date</dt>
              <dd>
                {entitlement.cancelAtPeriodEnd
                  ? `None — access ends ${fmtDate(entitlement.currentPeriodEnd)}`
                  : fmtDate(entitlement.currentPeriodEnd)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold text-muted">Current period</dt>
              <dd>
                {fmtDate(entitlement.currentPeriodStart)} → {fmtDate(entitlement.currentPeriodEnd)}
              </dd>
            </div>
          </dl>
        ) : null}
        {entitlement.cancelAtPeriodEnd ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            Your subscription is canceled and will remain active until{' '}
            <strong>{fmtDate(entitlement.currentPeriodEnd)}</strong>. After that the workspace moves to the
            Free plan — your content and connected accounts stay.
          </p>
        ) : null}
        {paid ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={openPortal} disabled={busy !== null} className="btn btn-ghost">
              {busy === 'portal' ? 'Opening…' : 'Manage in Stripe'}
            </button>
            {entitlement.cancelAtPeriodEnd ? (
              <button type="button" onClick={() => setCancel(false)} disabled={busy !== null} className="btn btn-bolt">
                {busy === 'resume' ? 'Resuming…' : 'Resume subscription'}
              </button>
            ) : (
              <button type="button" onClick={() => setCancel(true)} disabled={busy !== null} className="btn btn-ghost">
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel at period end'}
              </button>
            )}
          </div>
        ) : null}
      </section>

      {/* ---- usage (monthly window, even on annual) ---- */}
      <section className="card p-5" aria-label="Usage this month">
        <p className="eyebrow">Usage · {usage.month}</p>
        <p className="mt-1 text-xs text-muted">
          AI credits reset every calendar month — even on annual billing, which only changes how you are charged.
          Scheduled-post slots count per channel and free up as posts publish.
        </p>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold">AI credits</span>
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
              <span className="font-bold">Scheduled posts</span>
              <span className="text-muted">
                {usage.scheduledPerChannelLimit === null
                  ? `${usage.scheduledTotal.toLocaleString()} scheduled · unlimited per channel`
                  : `${usage.scheduledTotal.toLocaleString()} scheduled · ${usage.scheduledPerChannelLimit.toLocaleString()} per channel`}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold">Connected channels</span>
              <span className="text-muted">
                {usage.channelsLimit === null
                  ? `${usage.channelsConnected.toLocaleString()} connected · unlimited`
                  : `${usage.channelsConnected.toLocaleString()} / ${usage.channelsLimit.toLocaleString()} connected`}
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
            You've used every AI credit this month. They reset on the 1st — or{' '}
            <a className="font-bold underline" href="#change-plan">upgrade for more</a>.
          </p>
        ) : usage.aiCreditsLimit !== null && usage.aiCreditsRemaining !== null && usage.aiCreditsRemaining <= 5 ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            Only <strong>{usage.aiCreditsRemaining.toLocaleString()} AI credits</strong> left this month — they reset on the
            1st, or <a className="font-bold underline" href="#change-plan">upgrade for a bigger allowance</a>.
          </p>
        ) : null}
        {usage.channelsLimit !== null && usage.channelsConnected >= usage.channelsLimit ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-sm">
            You've connected every channel your plan allows ({usage.channelsLimit.toLocaleString()}).{' '}
            <a className="font-bold underline" href="#change-plan">Upgrade</a> to add more.
          </p>
        ) : null}
      </section>

      {/* ---- watermark (brand) ---- */}
      <section className="card p-5" aria-label="Sosial watermark">
        <p className="eyebrow">Brand</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Sosial watermark</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {watermarkRequired
                ? 'Required on the Free plan — a small “made with Sosial” badge is added to studio exports and published posts. Upgrade to control it.'
                : 'A small “made with Sosial” badge added to studio exports and published posts. Turn it off any time — it never applies to media you bring in yourself.'}
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
            {watermarkRequired ? 'Required' : wmBusy ? 'Saving…' : wm ? 'On' : 'Off'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {watermarkRequired ? 'Show Sosial watermark: Required' : `Custom Sosial watermark: ${wm ? 'ON' : 'OFF'}`}
        </p>
      </section>

      {/* ---- change plan ---- */}
      <section id="change-plan" className="card scroll-mt-24 p-5" aria-label="Change plan">
        <p className="eyebrow">Change plan</p>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Billing interval">
          {(['monthly', 'annual'] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              aria-pressed={interval === i}
              className={`pill border ${interval === i ? 'border-ink bg-[#191512] text-white' : 'border-line bg-card text-soft'}`}
            >
              {i === 'monthly' ? 'Monthly' : `Annual — save up to ${annualSavingsPct('team')}%`}
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
                    {current ? <span className="ml-2 text-xs font-medium text-muted">(current)</span> : null}
                  </p>
                  <p className="text-xs text-muted">{p.blurb}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{priceLabel(k, interval)}</p>
                  {interval === 'annual' ? (
                    <p className="text-xs text-muted">≈ {formatUsd(monthlyEquivalent(k))}/month, billed annually</p>
                  ) : (
                    <p className="text-xs text-muted">billed monthly</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy !== null || current || !stripeReady}
                  onClick={() => select(k)}
                  className={`btn shrink-0 ${current ? 'btn-ghost' : 'btn-bolt'}`}
                >
                  {current
                    ? 'Active'
                    : busy === k
                      ? 'Working…'
                      : priceFor(k, interval) < priceFor(entitlement.plan as Exclude<PlanKey, 'free'>, interval) || !paid
                        ? 'Upgrade'
                        : 'Switch'}
                </button>
              </div>
            );
          })}
        </div>

        {!stripeReady ? (
          <p className="mt-3 text-xs text-muted">
            Checkout activates once Stripe price IDs are configured.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Plan changes apply immediately and are prorated. Cancelling keeps your plan until the period ends.
          </p>
        )}
      </section>

      {notice ? <p className="card p-4 text-sm font-bold text-[#2f8f5b]">{notice}</p> : null}
      {err ? <p className="card p-4 text-sm font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{err}</p> : null}
    </div>
  );
}
