'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PROVIDER_META, providerMeta } from '@/lib/providers';
import type { TargetStatus } from '@/lib/types';

/**
 * Post-now status popup (mobile parity): watches post_targets for the freshly
 * created post(s) and shows per-channel publish progress — spinner while
 * queued/publishing, ✓ with link when sent, ✗ with the worker's error when
 * failed. Polls every 2.5s; done-state auto-closes into the queue view.
 */
export default function PublishMonitor({
  postIds,
  onDone,
}: {
  postIds: string[];
  onDone: () => void;
}) {
  const [rows, setRows] = useState<
    { provider: string; label: string; status: TargetStatus; error: string | null; url: string | null }[]
  >([]);
  const [note, setNote] = useState<string | null>(null);
  const autoClosed = useRef(false);

  useEffect(() => {
    const sb = createClient();
    let alive = true;
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
      const settled = list.every((t) => !['pending', 'queued', 'publishing'].includes(t.status));
      if (settled && list.length > 0 && !autoClosed.current) {
        autoClosed.current = true;
        const failed = list.filter((t) => t.status === 'failed').length;
        setTimeout(() => {
          if (alive) onDone();
        }, failed ? 4000 : 1400);
      }
    }
    void poll();
    const timer = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = rows.filter((r) => ['pending', 'queued', 'publishing'].includes(r.status)).length;
  const sent = rows.filter((r) => r.status === 'sent').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const settled = rows.length > 0 && pending === 0;

  const icon = (s: TargetStatus) => {
    if (s === 'sent') return <span className="text-[#346538] dark:text-[#8fd0a0]">✓</span>;
    if (s === 'failed') return <span className="text-[#9F2F2D] dark:text-[#f2a8a8]">✕</span>;
    if (s === 'skipped') return <span className="text-faint">—</span>;
    return (
      <span
        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-ink"
        aria-hidden="true"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Publishing status">
      <div className="absolute inset-0 bg-ink/60" aria-hidden="true" />
      <div className="relative w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-line bg-card p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          {!settled ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden="true" />
          ) : failed > 0 ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FDEBEC] text-sm font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">!</span>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EDF3EC] text-sm font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">✓</span>
          )}
          <p className="font-display text-base font-extrabold">
            {!settled
              ? `Publishing to ${rows.length || '…'} channel${rows.length === 1 ? '' : 's'}…`
              : failed > 0
                ? `Posted — ${failed} failed`
                : 'Posted to all channels'}
          </p>
        </div>

        <div className="mt-4 space-y-1.5">
          {rows.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted">{note ?? 'Reading targets…'}</p>
          ) : (
            rows.map((r) => (
              <div key={r.provider + (r.url ?? '')} className="flex items-center gap-2.5 rounded-xl bg-paper px-3 py-2">
                <span className="flex w-4 shrink-0 items-center justify-center text-xs font-bold">{icon(r.status)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{r.label}</span>
                {r.status === 'sent' && r.url ? (
                  <a href={r.url} target="_blank" rel="noopener" className="shrink-0 text-[11px] font-bold text-accent-ink">
                    View
                  </a>
                ) : r.status === 'failed' && r.error ? (
                  <span className="max-w-[55%] truncate text-[11px] text-[#9F2F2D] dark:text-[#f2a8a8]" title={r.error}>
                    {r.error}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-faint">
            {settled
              ? `${sent} sent${failed ? ` · ${failed} failed` : ''}`
              : 'This usually takes a few seconds…'}
          </p>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-line px-3.5 py-1.5 text-xs font-bold text-muted transition hover:text-ink"
          >
            {settled ? 'Go to queue' : 'Hide'}
          </button>
        </div>
      </div>
    </div>
  );
}
