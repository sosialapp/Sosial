'use client';

/**
 * Community inbox — tab host for the unified Comments feed and the unified
 * Messages inbox (both p92). Data comes from the workspace tables; actions
 * queue through the scan-now / reply-comment / inbox-send edge functions.
 *
 * One refresh pipeline: either tab's refresh button runs a single unified
 * sweep and reloads both lists. Badge counts come from community_unseen()
 * and clear when a section is opened.
 */

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import CommentsFeed from '@/components/CommentsFeed';
import MessagesInbox from '@/components/MessagesInbox';
import { createClient } from '@/lib/supabase/client';
import type { ConnectedChannel } from '@/lib/types';

type InboxTab = 'comments' | 'messages';

export default function CommunityInbox({
  channels,
  workspaceId,
  plan,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  plan: string;
}) {
  const [tab, setTab] = useState<InboxTab>('comments');
  const [unseen, setUnseen] = useState<{ comments: number; messages: number }>({ comments: 0, messages: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** When the lists were last re-read, for the "synced 2m ago" hint. */
  const [syncedAt, setSyncedAt] = useState<number>(() => Date.now());
  const [, setTick] = useState(0);

  // Re-render once a minute so the "synced" hint stays honest.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const fetchUnseen = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb.rpc('community_unseen', { p_workspace: workspaceId });
    if (error) return;
    const j = (data ?? {}) as { comments?: number; messages?: number };
    setUnseen({ comments: Number(j.comments ?? 0), messages: Number(j.messages ?? 0) });
  }, [workspaceId]);

  const markSeen = useCallback(
    async (section: InboxTab) => {
      setUnseen((u) => ({ ...u, [section]: 0 }));
      const sb = createClient();
      await sb.rpc('community_mark_seen', { p_workspace: workspaceId, p_section: section });
      window.dispatchEvent(new CustomEvent('sosial:community-seen'));
    },
    [workspaceId],
  );

  useEffect(() => {
    void fetchUnseen();
    const t = setInterval(() => void fetchUnseen(), 45_000);
    const onFocus = () => void fetchUnseen();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchUnseen]);

  // Opening a section clears its badge.
  useEffect(() => {
    void markSeen(tab);
  }, [tab, markSeen]);

  /** Both tabs share this: one sweep, then both lists re-read. */
  const refreshAll = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.functions.invoke('scan-now', {
        body: { workspace_id: workspaceId },
      });
      if (error) throw new Error(error.message);
      // Jobs claim within seconds; one beat, then read whatever landed.
      await new Promise((r) => setTimeout(r, 8000));
      setReloadKey((k) => k + 1);
      setSyncedAt(Date.now());
      await fetchUnseen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the refresh.');
    } finally {
      setScanning(false);
    }
  }, [scanning, workspaceId, fetchUnseen]);

  const tabs: { key: InboxTab; label: string }[] = [
    { key: 'comments', label: 'Comments' },
    { key: 'messages', label: 'Messages' },
  ];

  const mins = Math.max(0, Math.floor((Date.now() - syncedAt) / 60_000));
  const syncedLabel = mins < 1 ? 'synced just now' : mins < 60 ? `synced ${mins}m ago` : `synced ${Math.floor(mins / 60)}h ago`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Inbox sections" className="flex w-fit gap-1 rounded-full border border-line bg-card p-1">
          {tabs.map(({ key, label }) => {
            const on = tab === key;
            const count = unseen[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={count > 0 ? `${label}, ${count} new` : label}
                onClick={() => setTab(key)}
                className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition ${
                  on ? 'bg-ink text-bone' : 'text-soft hover:bg-surface'
                }`}
              >
                {label}
                {count > 0 ? (
                  <span className="min-w-[20px] rounded-full bg-accent px-1.5 text-center text-[11px] font-extrabold leading-5 text-[#0b1220]">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={scanning}
          title="Refreshes comments and messages in one sweep"
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-card px-4 text-[13px] font-bold text-soft transition hover:bg-surface disabled:opacity-60"
        >
          {scanning ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Refresh
          <span className="hidden font-medium text-muted sm:inline">· {syncedLabel}</span>
        </button>
      </div>

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}

      {tab === 'comments' ? (
        <CommentsFeed
          channels={channels}
          workspaceId={workspaceId}
          reloadKey={reloadKey}
        />
      ) : (
        <MessagesInbox
          workspaceId={workspaceId}
          channels={channels}
          paid={plan !== 'free'}
          reloadKey={reloadKey}
        />
      )}
    </div>
  );
}
