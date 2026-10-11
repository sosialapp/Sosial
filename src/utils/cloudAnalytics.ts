import { supabase, currentSession } from './supabase';

/**
 * Cloud analytics data — the same tables the web dashboard reads
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
}

export interface CloudStatRow {
  post_id: string;
  channel_id: string;
  provider: string;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
}

export interface CloudFollowerRow {
  channel_id: string;
  provider: string;
  followers: number | null;
  fetched_at: string;
}

export interface CloudAnalytics {
  posts: CloudPost[];
  channels: CloudChannel[];
  postStats: CloudStatRow[];
  channelStats: CloudFollowerRow[];
}

export async function fetchCloudAnalytics(): Promise<CloudAnalytics | null> {
  const sb = supabase();
  const session = await currentSession().catch(() => null);
  if (!session) return null;
  const wsId = session.workspace.id;

  const [postsQ, chansQ, statsQ, folQ] = await Promise.all([
    sb
      .from('posts')
      .select('id, title, body, status, sent_at, scheduled_at, created_at, post_targets(id, provider, channel_id, status)')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(500),
    sb
      .from('connected_channels')
      .select('id, provider, display_name, handle, status')
      .eq('workspace_id', wsId),
    sb
      .from('post_stats')
      .select('post_id, channel_id, provider, likes, comments, shares, views')
      .eq('workspace_id', wsId),
    sb
      .from('channel_stats')
      .select('channel_id, provider, followers, fetched_at')
      .eq('workspace_id', wsId),
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
    })),
    postStats: ((statsQ.data ?? []) as any[]).map((r) => ({
      post_id: String(r.post_id),
      channel_id: String(r.channel_id),
      provider: String(r.provider),
      likes: Number(r.likes ?? 0),
      comments: Number(r.comments ?? 0),
      shares: Number(r.shares ?? 0),
      views: r.views == null ? null : Number(r.views),
    })),
    channelStats: ((folQ.data ?? []) as any[]).map((r) => ({
      channel_id: String(r.channel_id),
      provider: String(r.provider),
      followers: r.followers == null ? null : Number(r.followers),
      fetched_at: String(r.fetched_at ?? ''),
    })),
  };
}
