'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';

/**
 * "Delete data" confirmation for the channels page. A disconnect only revokes
 * the account; this is the opt-in path that makes Sosial forget it entirely
 * (remove-channel-token with mode:'purge'). It dry-runs first so the warning
 * shows the exact rows that will go, and requires typing the account name --
 * the typed handle is re-checked server-side by nothing more than the owner
 * gate, so it exists to slow the human down, not to protect the row.
 */
type Counts = {
  targets: number;
  scheduled: number;
  posts: number;
  comments: number;
  messages: number;
  conversations: number;
  stats: number;
};

const ROWS: Array<[keyof Counts, string]> = [
  ['posts', 'wcPurgeLPosts'],
  ['targets', 'wcPurgeLDest'],
  ['scheduled', 'wcPurgeLQueued'],
  ['comments', 'wcPurgeLComments'],
  ['messages', 'wcPurgeLMessages'],
  ['conversations', 'wcPurgeLConversations'],
  ['stats', 'wcPurgeLStats'],
];

export default function PurgeChannelDialog({
  workspaceId,
  provider,
  externalId,
  label,
  onClose,
  onDone,
}: {
  workspaceId: string;
  provider: string;
  externalId: string;
  label: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT(appMessages);
  const [mounted, setMounted] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = createClient();
        const { data, error } = await sb.functions.invoke('remove-channel-token', {
          body: {
            workspace_id: workspaceId,
            provider,
            external_id: externalId,
            mode: 'purge',
            dry_run: true,
          },
        });
        if (error) throw new Error(error.message);
        const body = data as { error?: unknown; counts?: Counts } | null;
        if (body && body.error) throw new Error(String(body.error));
        if (!alive) return;
        setCounts(
          body?.counts ?? {
            targets: 0,
            scheduled: 0,
            posts: 0,
            comments: 0,
            messages: 0,
            conversations: 0,
            stats: 0,
          },
        );
      } catch (e: unknown) {
        if (alive) setLoadErr(e instanceof Error ? e.message : t('wcPurgeFailed'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId, provider, externalId, t]);

  const ready = !!counts && !busy && typed.trim() === label.trim();

  const purge = async () => {
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('remove-channel-token', {
        body: { workspace_id: workspaceId, provider, external_id: externalId, mode: 'purge' },
      });
      if (error) throw new Error(error.message);
      const body = data as { error?: unknown } | null;
      if (body && body.error) throw new Error(String(body.error));
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('wcPurgeFailed'));
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('wcPurgeTitle')}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-[0_24px_70px_-24px_rgba(0,0,0,0.5)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
          <h2 className="font-display text-base font-extrabold text-ink">{t('wcPurgeTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-paper-dim hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          <p className="text-sm leading-relaxed text-ink">
            {fill(t('wcPurgeBody'), { name: label })}
          </p>

          {loadErr ? (
            <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
              {loadErr}
            </p>
          ) : counts ? (
            (() => {
              const shown = ROWS.filter(([k]) => counts[k] > 0);
              if (shown.length === 0) return null;
              return (
                <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-faint">
                    {t('wcPurgeCountsHead')}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {shown.map(([k, key]) => (
                      <li key={k} className="text-[13px] tabular-nums text-ink">
                        {fill(t(key), { n: counts[k] })}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()
          ) : (
            <p className="text-xs text-muted">…</p>
          )}

          <p className="rounded-xl bg-paper-dim px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
            {t('wcPurgeKeeps')}
          </p>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-faint">
              {fill(t('wcPurgeTypeLabel'), { name: label })}
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={label}
              spellCheck={false}
              autoComplete="off"
              className="field"
              aria-label={fill(t('wcPurgeTypeLabel'), { name: label })}
            />
          </label>

          {err ? (
            <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
              {err}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft px-4 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost !py-2 !text-xs">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={purge}
            disabled={!ready}
            className="btn !py-2 !text-xs bg-[#9F2F2D] text-white hover:bg-[#8a2020]"
          >
            {busy ? t('wcPurgeWorking') : t('wcPurgeConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector('[data-theme-root]') ?? document.body,
  );
}