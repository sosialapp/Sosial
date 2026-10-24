'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PROVIDER_META, providerMeta } from '@/lib/providers';
import { ArrowUpRight, Check, LoaderCircle, Minus, Send, X } from 'lucide-react';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import type { TargetStatus } from '@/lib/types';

/**
 * Post status popup (mobile parity): watches post_targets for the freshly
 * created post(s) and shows per-channel publish progress, a full bar means
 * sent, with a link out when the channel returns one. Polls every 2.5s.
 *
 * The outcome is confirmed ON SCREEN, never transient: once every target
 * settles the poller stops and the popup stays open until the user dismisses
 * it, so "Posted" can't silently vanish while the worker was still mid-run.
 *
 * Each channel shows as its own brand tile with a live status line; the
 * header stacks the channel logos with a spinner / check / cross badge, and
 * the card's top edge is the overall progress. Bottom sheet on a phone.
 *
 * `mode="schedule"` reuses the same shell for scheduling: there is nothing to
 * publish yet, so it just shows the saving spinner, then a "Scheduled for …"
 * confirmation and auto-closes. Same loading animation as post-now.
 */
export default function PublishMonitor({
  postIds,
  onDone,
  mode = 'now',
  scheduleIso = null,
  doneLabel = 'Go to queue',
}: {
  postIds: string[];
  onDone: () => void;
  mode?: 'now' | 'schedule';
  /** Schedule mode: the instant the post is queued for. */
  scheduleIso?: string | null;
  /** Settled-state button: where landing implies the label (queue nav vs close). */
  doneLabel?: string;
}) {
  const scheduled = mode === 'schedule';
  const [rows, setRows] = useState<
    { provider: string; label: string; status: TargetStatus; error: string | null; url: string | null }[]
  >([]);
  const [note, setNote] = useState<string | null>(null);
  // The dialog opens early in "saving" state (postIds=[]) and receives the
  // real ids a beat later WITHOUT remounting, so the poller must restart
  // when the id set changes, or it watches [] forever ("Reading targets…").
  const idsKey = postIds.join(',');

  useEffect(() => {
    // Schedule mode has nothing to poll (the post is only queued): once the
    // ids land we show the confirmation and close ourselves.
    if (mode === 'schedule') {
      if (!postIds.length) return;
      const t = setTimeout(onDone, 1600);
      return () => clearTimeout(t);
    }
    if (!postIds.length) return; // Still saving, nothing to watch yet.
    setRows([]);
    const sb = createClient();
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function poll() {
      const { data, error } = await sb
        .from('post_targets')
        .select('provider,status,last_error,remote_url')
        .in('post_id', postIds);
      if (!alive) return;
      if (error) {
        setNote(error.message);
        return;
      }
      const list = (data ?? []) as {
        provider: string;
        status: TargetStatus;
        last_error: string | null;
        remote_url: string | null;
      }[];
      setRows(
        list.map((t) => ({
          provider: t.provider,
          label:
            (PROVIDER_META as Record<string, { label: string }>)[t.provider]?.label ??
            providerMeta(t.provider)?.label ??
            t.provider,
          status: t.status,
          error: t.last_error,
          url: t.remote_url,
        })),
      );
      // Stop polling the moment everything settled: the outcome is final and
      // stays on screen until the user dismisses it. Polling past this point
      // would only burn battery against rows that can no longer change.
      const settled = list.every((t) => !['pending', 'queued', 'publishing'].includes(t.status));
      if (settled && list.length > 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    void poll();
    timer = setInterval(poll, 2500);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, mode]);

  const pending = rows.filter((r) => ['pending', 'queued', 'publishing'].includes(r.status)).length;
  const sent = rows.filter((r) => r.status === 'sent').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const skipped = rows.filter((r) => r.status === 'skipped').length;
  const settled = rows.length > 0 && pending === 0;

  // Schedule mode is a two-step save: spinner until the row lands, then done.
  const saved = scheduled && postIds.length > 0;
  const busy = scheduled ? !saved : !settled;
  const done = scheduled ? saved : settled;

  const whenLabel = scheduleIso
    ? new Date(scheduleIso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const pct = scheduled
    ? saved
      ? 100
      : 15
    : rows.length
      ? ((rows.length - pending) / rows.length) * 100
      : !postIds.length
        ? 8
        : 15;

  const isLive = (s: TargetStatus) => ['pending', 'queued', 'publishing'].includes(s);

  const statusText = (r: (typeof rows)[number]) =>
    r.status === 'sent'
      ? 'Posted'
      : r.status === 'failed'
        ? r.error || 'Failed'
        : r.status === 'skipped'
          ? 'Skipped'
          : r.status === 'publishing'
            ? 'Publishing…'
            : 'Waiting…';

  // Logos for the header stack: the channels being posted to.
  const stack = rows.slice(0, 5);

  const title = scheduled
    ? saved
      ? 'Scheduled'
      : 'Scheduling…'
    : !postIds.length
      ? 'Getting your post ready…'
      : !settled
        ? `Posting to ${rows.length || '…'} channel${rows.length === 1 ? '' : 's'}`
        : failed > 0
          ? `Posted, ${failed} failed`
          : skipped > 0
            ? `Posted, ${skipped} skipped`
            : 'Posted everywhere';

  const subtitle = scheduled
    ? saved
      ? whenLabel
        ? `Goes out ${whenLabel}`
        : 'Queued to publish at the scheduled time.'
      : 'Saving your post…'
    : !postIds.length
      ? 'Uploading media…'
      : !settled
        ? 'This usually takes a few seconds.'
        : `${sent} sent${failed ? ` · ${failed} failed` : ''}${skipped ? ` · ${skipped} skipped` : ''}`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Publishing status"
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="relative w-full overflow-hidden rounded-t-3xl border border-line bg-card shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-[400px] sm:rounded-3xl">
        {/* Overall progress rides the top edge of the card. */}
        <div className="h-1 w-full bg-surface" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-500 ease-out ${!scheduled && failed > 0 && done ? 'bg-[#E5484D]' : done ? 'bg-[#12914A]' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3.5">
            {/* Channel logos, stacked like avatars; a status badge pins the corner. */}
            <span className="relative flex shrink-0 items-center">
              {stack.length ? (
                stack.map((r, i) => (
                  <span
                    key={r.provider + i}
                    className="grid h-11 w-11 place-items-center rounded-2xl ring-[3px] ring-card"
                    style={{ background: providerMeta(r.provider).color, marginLeft: i ? -14 : 0, zIndex: stack.length - i }}
                  >
                    <BrandIcon provider={r.provider as BrandProvider} mono className="h-5 w-5 text-white" />
                  </span>
                ))
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface text-muted">
                  <Send className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <span
                className={`absolute -right-1.5 -bottom-1.5 z-10 grid h-6 w-6 place-items-center rounded-full ring-[3px] ring-card ${
                  busy
                    ? 'bg-card'
                    : !scheduled && failed > 0
                      ? 'bg-[#E5484D] text-white'
                      : 'bg-[#12914A] text-white'
                }`}
                aria-hidden="true"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-ink" />
                ) : !scheduled && failed > 0 ? (
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                )}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[17px] font-extrabold leading-tight tracking-tight">{title}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
            </div>
          </div>

          {!scheduled && rows.length > 0 ? (
            <ul className="mt-5 max-h-[45vh] space-y-2 overflow-y-auto">
              {rows.map((r) => {
                const live = isLive(r.status);
                const meta = providerMeta(r.provider);
                return (
                  <li key={r.provider + (r.url ?? '')} className="rounded-2xl border border-line-soft bg-paper p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: meta.color }}>
                        <BrandIcon provider={r.provider as BrandProvider} mono className="h-[18px] w-[18px] text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{r.label}</span>
                        <span
                          className={`block truncate text-xs ${
                            r.status === 'failed'
                              ? 'text-[#9F2F2D] dark:text-[#f2a8a8]'
                              : r.status === 'sent'
                                ? 'text-[#346538] dark:text-[#8fd0a0]'
                                : 'text-muted'
                          }`}
                          title={r.status === 'failed' ? (r.error ?? undefined) : undefined}
                        >
                          {statusText(r)}
                        </span>
                      </span>
                      {r.status === 'sent' && r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-surface"
                        >
                          View
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : live ? (
                        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-faint" aria-hidden="true" />
                      ) : r.status === 'sent' ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : r.status === 'failed' ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : (
                        <Minus className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                      )}
                    </div>
                    {live ? (
                      // Indeterminate sweep in the channel's colour while the worker runs.
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
                        <div className="pub-sweep h-full w-1/3 rounded-full" style={{ background: meta.color }} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : !scheduled && postIds.length > 0 && note ? (
            <p className="mt-4 text-xs text-muted">{note}</p>
          ) : null}

          <button
            type="button"
            onClick={onDone}
            className={`mt-5 w-full rounded-full py-2.5 text-sm font-bold transition ${
              done ? 'bg-ink text-bone hover:opacity-90' : 'bg-surface text-soft hover:text-ink'
            }`}
          >
            {done ? doneLabel : 'Hide, keep posting in the background'}
          </button>
        </div>
      </div>
    </div>
  );
}
