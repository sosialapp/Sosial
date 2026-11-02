import { supabase, currentSession } from './supabase';

/**
 * Cloud analytics data, the same tables the web dashboard reads
 * (posts + post_stats + channel_stats snapshots). Mobile previously
 * scraped each platform API with device tokens, which showed nothing
 * whenever a token wasn't on this phone; the cloud snapshots are always
 * there (the worker refreshes them daily) and respect RLS membership.
 */

export interface CloudTarget {
  id: string;
  provider: string;
  channel_id: string;
  status: string;
}

export interface CloudPost {
  id: string;
  title: string | null;
  body: string | null;
  status: string;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string | null;
  targets: CloudTarget[];
}

export interface CloudChannel {
  id: string;
  provider: string;
  display_name: string | null;
  handle: string | null;
  status: string;
  /** Profile picture from the avatar sync (metadata.avatar), for ChannelAvatar. */
  avatar?: string;
}

export interface CloudStatRow {
  post_id: string;
  channel_id: string;
  provider: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number | null;
}

export interface CloudFollowerRow {
  channel_id: string;
  provider: string;
  followers: number | null;
  fetched_at: string;
}

/** One follower total per channel per day (p77), for the followers trend. */
export interface CloudFollowerHistoryRow {
  channel_id: string;
  followers: number | null;
  captured_on: string;
}

export interface CloudAnalytics {
  posts: CloudPost[];
  channels: CloudChannel[];
  postStats: CloudStatRow[];
  channelStats: CloudFollowerRow[];
  followerHistory: CloudFollowerHistoryRow[];
}

export async function fetchCloudAnalytics(): Promise<CloudAnalytics | null> {
  const sb = supabase();
  const session = await currentSession().catch(() => null);
  if (!session) return null;
  const wsId = session.workspace.id;

  // Same window as the web loader (apps/web analytics/page.tsx).
  const historyFloor = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [postsQ, chansQ, statsQ, folQ, histQ] = await Promise.all([
    sb
      .from('posts')
      .select('id, title, body, status, sent_at, scheduled_at, created_at, post_targets(id, provider, channel_id, status)')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      // Web's analytics read is unlimited; keep the mobile cap far above any
      // real workspace so both platforms compute the same numbers.
      .limit(2000),
    sb
      .from('connected_channels')
      .select('id, provider, display_name, handle, status, metadata')
      .eq('workspace_id', wsId),
    // saves/clicks arrive with p119; until that migration runs the wider
    // select fails, so fall back to the original columns (web parity).
    sb
      .from('post_stats')
      .select('post_id, channel_id, provider, likes, comments, shares, saves, clicks, views')
      .eq('workspace_id', wsId)
      .then(async (r) =>
        r.error
          ? sb.from('post_stats').select('post_id, channel_id, provider, likes, comments, shares, views').eq('workspace_id', wsId)
          : r,
      ),
    sb
      .from('channel_stats')
      .select('channel_id, provider, followers, fetched_at')
      .eq('workspace_id', wsId),
    sb
      .from('channel_stats_history')
      .select('channel_id, followers, captured_on')
      .eq('workspace_id', wsId)
      .gte('captured_on', historyFloor),
  ]);

  return {
    posts: ((postsQ.data ?? []) as any[]).map((p) => ({
      id: String(p.id),
      title: p.title ?? null,
      body: p.body ?? null,
      status: String(p.status ?? 'draft'),
      sent_at: p.sent_at ?? null,
      scheduled_at: p.scheduled_at ?? null,
      created_at: p.created_at ?? null,
      targets: ((p.post_targets ?? []) as any[]).map((t) => ({
        id: String(t.id),
        provider: String(t.provider),
        channel_id: String(t.channel_id),
        status: String(t.status ?? ''),
      })),
    })),
    channels: ((chansQ.data ?? []) as any[]).map((c) => ({
      id: String(c.id),
      provider: String(c.provider),
      display_name: c.display_name ?? null,
      handle: c.handle ?? null,
      status: String(c.status ?? ''),
      avatar: typeof c.metadata?.avatar === 'string' && c.metadata.avatar ? String(c.metadata.avatar) : undefined,
    })),
    postStats: ((statsQ.data ?? []) as any[]).map((r) => ({
      post_id: String(r.post_id),
      channel_id: String(r.channel_id),
      provider: String(r.provider),
      likes: Number(r.likes ?? 0),
      comments: Number(r.comments ?? 0),
      shares: Number(r.shares ?? 0),
      saves: Number(r.saves ?? 0),
      clicks: Number(r.clicks ?? 0),
      views: r.views == null ? null : Number(r.views),
    })),
    channelStats: ((folQ.data ?? []) as any[]).map((r) => ({
      channel_id: String(r.channel_id),
      provider: String(r.provider),
      followers: r.followers == null ? null : Number(r.followers),
      fetched_at: String(r.fetched_at ?? ''),
    })),
    followerHistory: ((histQ.data ?? []) as any[]).map((r) => ({
      channel_id: String(r.channel_id),
      followers: r.followers == null ? null : Number(r.followers),
      captured_on: String(r.captured_on ?? ''),
    })),
  };
}

/**
 * Ask the worker for fresh numbers now (followers per minute, engagement per
 * hour, both deduped server-side). Best-effort: false when signed out or
 * the request failed, the screen just keeps the last snapshot.
 */
export async function requestAnalyticsRefresh(): Promise<boolean> {
  const session = await currentSession().catch(() => null);
  if (!session) return false;
  const { error } = await supabase().rpc('request_analytics_refresh', { p_workspace: session.workspace.id });
  return !error;
}

/** Newest follower/engagement snapshot time (ms), 0 when none or signed out. */
export async function newestSnapshotAt(): Promise<number> {
  const session = await currentSession().catch(() => null);
  if (!session) return 0;
  const sb = supabase();
  const wsId = session.workspace.id;
  const [a, b] = await Promise.all([
    sb.from('channel_stats').select('fetched_at').eq('workspace_id', wsId).order('fetched_at', { ascending: false }).limit(1),
    sb.from('post_stats').select('fetched_at').eq('workspace_id', wsId).order('fetched_at', { ascending: false }).limit(1),
  ]);
  const ts = [a.data?.[0]?.fetched_at, b.data?.[0]?.fetched_at].map((v) => (v ? Date.parse(String(v)) : 0));
  return Math.max(0, ...ts);
}

/**
 * Refresh, then call onFresh each time a newer snapshot lands, for up to
 * watchMs. Returns a cancel function for unmounts.
 */
export function syncAnalytics(onFresh: () => void, watchMs = 60_000, pollMs = 3_000): () => void {
  let cancelled = false;
  void (async () => {
    try {
      let seen = await newestSnapshotAt();
      if (!(await requestAnalyticsRefresh())) return;
      const stopAt = Date.now() + watchMs;
      while (!cancelled && Date.now() < stopAt) {
        await new Promise((r) => setTimeout(r, pollMs));
        if (cancelled) return;
        const latest = await newestSnapshotAt();
        if (latest > seen) {
          seen = latest;
          onFresh();
        }
      }
    } catch {
      /* keep what is on screen */
    }
  })();
  return () => {
    cancelled = true;
  };
}
