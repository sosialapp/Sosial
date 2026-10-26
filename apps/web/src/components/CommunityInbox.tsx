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
import { Mail, MessageCircle, RefreshCw } from 'lucide-react';
import CommentsFeed from '@/components/CommentsFeed';
import MessagesInbox from '@/components/MessagesInbox';
import SegmentedPills from '@/components/ui/segmented-pills';
import { createClient } from '@/lib/supabase/client';
import { usePostgresChanges } from '@/lib/realtime';
import { requestScan } from '@/lib/scan';
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

  // Coming back to the tab, or opening it, asks the server for a sweep now
  // instead of waiting for the 5-minute cron; the rows it stores then arrive
  // over Realtime. The function's key is per-workspace-per-minute, so a burst
  // of focus events costs nothing.
  useEffect(() => {
    void requestScan(workspaceId);
    const onFocus = () => void requestScan(workspaceId);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [workspaceId]);

  // Badges move the moment a comment or a DM lands, rather than on the timer
  // below (which stays as the safety net).
  usePostgresChanges({
    table: 'comments',
    filter: `workspace_id=eq.${workspaceId}`,
    onChange: () => void fetchUnseen(),
  });

  usePostgresChanges({
    table: 'messages',
    onChange: () => void fetchUnseen(),
  });

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
      await fetchUnseen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the refresh.');
    } finally {
      setScanning(false);
    }
  }, [scanning, workspaceId, fetchUnseen]);

  const tabs: { key: InboxTab; label: string; Icon: typeof MessageCircle }[] = [
    { key: 'comments', label: 'Comments', Icon: MessageCircle },
    { key: 'messages', label: 'Messages', Icon: Mail },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SegmentedPills
          ariaLabel="Inbox sections"
          role="tablist"
          size="lg"
          value={tab}
          onChange={setTab}
          className="min-w-0 flex-1 sm:flex-none"
          buttonClassName="flex-1 sm:flex-none !px-4"
          options={tabs.map(({ key, label, Icon }) => {
            const count = unseen[key];
            return {
              value: key,
              title: count > 0 ? `${label}, ${count} new` : label,
              label: (
                <>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  {count > 0 ? (
                    <span className="min-w-[18px] shrink-0 rounded-full bg-accent px-1 text-center text-[10px] font-extrabold leading-[18px] text-on-accent">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </>
              ),
            };
          })}
        />
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={scanning}
          title="Refreshes comments and messages in one sweep"
          aria-label="Refresh comments and messages"
          className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-bold text-soft transition hover:bg-surface disabled:opacity-60 sm:px-4"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">{scanning ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}

      {tab === 'comments' ? (
        <CommentsFeed channels={channels} workspaceId={workspaceId} reloadKey={reloadKey} />
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
