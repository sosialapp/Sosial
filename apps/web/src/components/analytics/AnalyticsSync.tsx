'use client';

/**
 * Keeps the analytics page in step with the real accounts.
 *
 * Opening the page (and the Refresh button) calls request_analytics_refresh,
 * which queues a followers-only read per channel (deduped per minute) and the
 * heavier engagement snapshot (deduped per hour). The worker claims those in
 * seconds; this then watches the newest snapshot timestamp and re-renders the
 * server page each time it moves, for up to WATCH_MS.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMessages } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';

const POLL_MS = 3_000;
const WATCH_MS = 90_000;

async function newestSnapshot(workspaceId: string): Promise<number> {
  const sb = createClient();
  const [a, b] = await Promise.all([
    sb.from('channel_stats').select('fetched_at').eq('workspace_id', workspaceId).order('fetched_at', { ascending: false }).limit(1),
    sb.from('post_stats').select('fetched_at').eq('workspace_id', workspaceId).order('fetched_at', { ascending: false }).limit(1),
  ]);
  const ts = [a.data?.[0]?.fetched_at, b.data?.[0]?.fetched_at].map((v) => (v ? Date.parse(v) : 0));
  return Math.max(0, ...ts);
}

function ago(ms: number, t: (k: string) => string): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return t('anSyncJustNow');
  if (min < 60) return fill(t('anSyncMinAgo'), { n: min });
  const h = Math.round(min / 60);
  if (h < 48) return fill(t('anSyncHourAgo'), { n: h });
  return fill(t('anSyncDayAgo'), { n: Math.round(h / 24) });
}

export default function AnalyticsSync({ workspaceId, lastFetchedAt }: { workspaceId: string; lastFetchedAt: string | null }) {
  const t = useMessages();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const runRef = useRef(0);

  const sync = useCallback(async () => {
    const run = ++runRef.current;
    setSyncing(true);
    try {
      const sb = createClient();
      const baseline = await newestSnapshot(workspaceId);
      const { error } = await sb.rpc('request_analytics_refresh', { p_workspace: workspaceId });
      if (error) return;
      let seen = baseline;
      const stopAt = Date.now() + WATCH_MS;
      while (Date.now() < stopAt && run === runRef.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const latest = await newestSnapshot(workspaceId);
        if (latest > seen) {
          seen = latest;
          router.refresh();
        }
      }
    } catch {
      /* keep the numbers already on screen */
    } finally {
      if (run === runRef.current) setSyncing(false);
    }
  }, [router, workspaceId]);

  useEffect(() => {
    void sync();
    return () => {
      runRef.current += 1;
    };
  }, [sync]);

  // Relative time is client-only so server and client markup agree.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [lastFetchedAt]);

  const updated = lastFetchedAt && now !== null ? ago(now - Date.parse(lastFetchedAt), t) : null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted" aria-live="polite">
        {syncing ? t('anSyncing') : updated ? fill(t('anSyncUpdated'), { when: updated }) : null}
      </span>
      <button
        type="button"
        onClick={() => void sync()}
        disabled={syncing}
        aria-label={t('anSyncRefresh')}
        title={t('anSyncRefresh')}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-soft transition hover:bg-surface disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}
