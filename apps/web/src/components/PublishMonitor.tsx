'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PROVIDER_META, providerMeta } from '@/lib/providers';
import { ArrowUpRight, Check, Send, X } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import type { TargetStatus } from '@/lib/types';

/**
 * Post status popup (mobile parity): watches post_targets for the freshly
 * created post(s) and shows per-channel publish progress, with a link out
 * when the channel returns one. Polls every 2.5s.
 *
 * The outcome is confirmed ON SCREEN, never transient: once every target
 * settles the poller stops and the popup stays open until the user dismisses
 * it, so "Posted" can't silently vanish while the worker was still mid-run.
 *
 * One card from the first click to the outcome: the channel rows are there
 * while media still uploads (when the caller passes `channels`), and only
 * their status words change. A single bar on the card's top edge is the only
 * moving part. Bottom sheet on a phone.
 *
 * `mode="schedule"` reuses the same shell for scheduling: there is nothing to
 * publish yet, so it just shows the saving state, then a "Scheduled for …"
 * confirmation and auto-closes.
 */
export default function PublishMonitor({
  postIds,
  onDone,
  mode = 'now',
  scheduleIso = null,
  doneLabel = 'Go to queue',
  channels = [],
}: {
  postIds: string[];
  onDone: () => void;
  mode?: 'now' | 'schedule';
  /** Schedule mode: the instant the post is queued for. */
  scheduleIso?: string | null;
  /** Settled-state button: where landing implies the label (queue nav vs close). */
  doneLabel?: string;
  /** The accounts being posted to, so rows show from the start with their faces. */
  channels?: { id: string; provider: string; avatar?: string; name: string }[];
}) {
  const scheduled = mode === 'schedule';
  const [rows, setRows] = useState<
    {
      channelId: string | null;
      provider: string;
      label: string;
      status: TargetStatus;
      error: string | null;
      url: string | null;
    }[]
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
        .select('channel_id,provider,status,last_error,remote_url')
        .in('post_id', postIds);
      if (!alive) return;
      if (error) {
        setNote(error.message);
        return;
      }
      const list = (data ?? []) as {
        channel_id: string | null;
        provider: string;
        status: TargetStatus;
        last_error: string | null;
        remote_url: string | null;
      }[];
      setRows(
        list.map((t) => ({
          channelId: t.channel_id,
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

  // Schedule mode is a two-step save: working until the row lands, then done.
  const saved = scheduled && postIds.length > 0;
  const busy = scheduled ? !saved : !settled;
  const done = scheduled ? saved : settled;
  const bad = !scheduled && failed > 0 && done;

  const whenLabel = scheduleIso
    ? new Date(scheduleIso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const statusText = (status: TargetStatus | null, error: string | null) =>
    status === null
      ? postIds.length
        ? 'Waiting…'
        : 'Uploading…'
      : status === 'sent'
        ? 'Posted'
        : status === 'failed'
          ? error || 'Failed'
          : status === 'skipped'
            ? 'Skipped'
            : status === 'publishing'
              ? 'Posting…'
              : 'Waiting…';

  /** Rows: the live targets once known, else the accounts the caller passed. */
  const list = rows.length
    ? rows.map((r) => {
        const ch = channels.find((c) => c.id === r.channelId) ?? channels.find((c) => c.provider === r.provider);
        return {
          key: `${r.channelId ?? r.provider}${r.url ?? ''}`,
          provider: r.provider,
          avatar: ch?.avatar,
          name: ch?.name ?? r.label,
          status: r.status as TargetStatus | null,
          error: r.error,
          url: r.url,
        };
      })
    : channels.map((c) => ({
        key: c.id,
        provider: c.provider,
        avatar: c.avatar,
        name: c.name,
        status: null as TargetStatus | null,
        error: null as string | null,
        url: null as string | null,
      }));
  const count = rows.length || channels.length;

  const title = scheduled
    ? saved
      ? 'Scheduled'
      : 'Scheduling…'
    : !settled
      ? count
        ? `Posting to ${count} channel${count === 1 ? '' : 's'}`
        : 'Posting…'
      : failed > 0
        ? `Posted, ${failed} failed`
        : skipped > 0
          ? `Posted, ${skipped} skipped`
          : 'Posted';

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
        {/* The one progress indicator: a sweep while working, solid when settled. */}
        <div className="relative h-1 w-full overflow-hidden bg-surface" aria-hidden="true">
          {busy ? (
            <div className="pub-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-accent" />
          ) : (
            <div className={`h-full w-full ${bad ? 'bg-[#E5484D]' : 'bg-[#12914A]'}`} />
          )}
        </div>

        <div className="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3.5">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors ${
                busy ? 'bg-surface text-ink' : bad ? 'bg-[#E5484D] text-white' : 'bg-[#12914A] text-white'
              }`}
              aria-hidden="true"
            >
              {busy ? (
                <Send className="h-5 w-5" />
              ) : bad ? (
                <X className="h-5 w-5" strokeWidth={3} />
              ) : (
                <Check className="h-5 w-5" strokeWidth={3} />
              )}
            </span>
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="font-display text-[17px] font-extrabold leading-tight tracking-tight">{title}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
            </div>
          </div>

          {!scheduled && list.length > 0 ? (
            <ul className="mt-4 max-h-[45vh] divide-y divide-line-soft overflow-y-auto rounded-2xl border border-line-soft">
              {list.map((r) => (
                <li key={r.key} className="flex items-center gap-3 px-3 py-2.5">
                  <ChannelAvatar provider={r.provider} avatar={r.avatar} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.name}</span>
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
                      {providerMeta(r.provider).label} · {statusText(r.status, r.error)}
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
                  ) : r.status === 'sent' ? (
                    <Check className="h-4 w-4 shrink-0 text-[#346538] dark:text-[#8fd0a0]" strokeWidth={3} aria-hidden="true" />
                  ) : r.status === 'failed' ? (
                    <X className="h-4 w-4 shrink-0 text-[#9F2F2D] dark:text-[#f2a8a8]" strokeWidth={3} aria-hidden="true" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : !scheduled && postIds.length > 0 && note ? (
            <p className="mt-4 text-xs text-muted">{note}</p>
          ) : null}

          {/* TikTok's Content Sharing Guidelines: say that processing takes time. */}
          {list.some((r) => r.provider === 'tiktok' && r.status !== 'failed') ? (
            <p className="mt-3 text-xs text-muted">
              TikTok may take a few minutes to process your post before it appears on your profile.
            </p>
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
