import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, currentSession, callEdgeFunction } from './supabase';

/**
 * "Last opened" stamps per post / conversation, on this device (web parity:
 * apps/web community/parts useSeen). Something is new when it arrived after
 * you last opened its post or chat; the comment `status` column only means
 * "not replied yet".
 */
export async function loadSeen(section: 'comments' | 'messages'): Promise<Record<string, string>> {
  try {
    const ws0 = await ws();
    const raw = await AsyncStorage.getItem(`sosial:seen:${section}:${ws0 ?? 'local'}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function saveSeen(section: 'comments' | 'messages', seen: Record<string, string>): Promise<void> {
  try {
    const ws0 = await ws();
    await AsyncStorage.setItem(`sosial:seen:${section}:${ws0 ?? 'local'}`, JSON.stringify(seen));
  } catch {
    /* best effort */
  }
}

/**
 * Unified community inbox on mobile: the same `comments`, `conversations`
 * and `messages` tables the web Community page reads, so both clients show
 * one shared state. Replies/messages queue through the same edge functions
 * as web; the worker performs the platform call.
 */

export interface CommunityComment {
  id: string;
  channel_id: string;
  platform: string;
  external_post_id: string | null;
  parent_external_id: string | null;
  external_id: string;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  created_at: string;
  status: string;
  is_own: boolean;
}

/** The post a comment was left on (cached by the comment sweep, p101). */
export interface CommunityCommentPost {
  channel_id: string;
  external_id: string;
  platform: string;
  url: string | null;
  body: string | null;
  thumbnail: string | null;
  posted_at: string | null;
}

/** Post context for the (channel, post) pairs the loaded comments sit on. */
export async function fetchCommentPosts(
  pairs: { channel: string; external: string }[],
): Promise<Record<string, CommunityCommentPost>> {
  const workspace = await ws();
  if (!workspace || pairs.length === 0) return {};
  const { data, error } = await supabase()
    .from('comment_posts')
    .select('channel_id,external_id,platform,url,body,thumbnail,posted_at')
    .eq('workspace_id', workspace)
    .in('channel_id', [...new Set(pairs.map((x) => x.channel))])
    .in('external_id', [...new Set(pairs.map((x) => x.external))]);
  if (error) return {};
  const out: Record<string, CommunityCommentPost> = {};
  for (const r of (data ?? []) as any[]) {
    out[`${r.channel_id}:${r.external_id}`] = {
      channel_id: String(r.channel_id),
      external_id: String(r.external_id),
      platform: String(r.platform ?? ''),
      url: r.url ?? null,
      body: r.body ?? null,
      thumbnail: r.thumbnail ?? null,
      posted_at: r.posted_at ?? null,
    };
  }
  return out;
}

export interface CommunityConversation {
  id: string;
  channel_id: string;
  platform: string;
  participant_name: string | null;
  participant_avatar: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface CommunityMessage {
  id: string;
  conversation_id: string;
  direction: 'in' | 'out';
  body: string;
  sent_at: string;
  status: string;
}

export interface CommunityUnseen {
  comments: number;
  messages: number;
}

async function ws(): Promise<string | null> {
  const session = await currentSession().catch(() => null);
  return session?.workspace.id ?? null;
}

export async function fetchCommunityComments(): Promise<CommunityComment[]> {
  const workspace = await ws();
  if (!workspace) return [];
  const { data, error } = await supabase()
    .from('comments')
    .select(
      'id,channel_id,platform,external_post_id,parent_external_id,external_id,author_name,author_avatar,body,created_at,status,is_own',
    )
    .eq('workspace_id', workspace)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: String(r.id),
    channel_id: String(r.channel_id),
    platform: String(r.platform),
    external_post_id: r.external_post_id ?? null,
    parent_external_id: r.parent_external_id ?? null,
    external_id: String(r.external_id),
    author_name: r.author_name ?? null,
    author_avatar: r.author_avatar ?? null,
    body: String(r.body ?? ''),
    created_at: String(r.created_at ?? ''),
    status: String(r.status ?? 'new'),
    is_own: r.is_own === true,
  }));
}

export async function fetchCommunityConversations(): Promise<CommunityConversation[]> {
  const workspace = await ws();
  if (!workspace) return [];
  const { data, error } = await supabase()
    .from('conversations')
    .select('id,channel_id,platform,participant_name,participant_avatar,last_message_at,unread_count')
    .eq('workspace_id', workspace)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: String(r.id),
    channel_id: String(r.channel_id),
    platform: String(r.platform),
    participant_name: r.participant_name ?? null,
    participant_avatar: r.participant_avatar ?? null,
    last_message_at: r.last_message_at ?? null,
    unread_count: Number(r.unread_count ?? 0),
  }));
}

export async function fetchCommunityThread(conversationId: string): Promise<CommunityMessage[]> {
  const { data, error } = await supabase()
    .from('messages')
    .select('id,conversation_id,direction,body,sent_at,status')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: String(r.id),
    conversation_id: String(r.conversation_id),
    direction: r.direction === 'out' ? 'out' : 'in',
    body: String(r.body ?? ''),
    sent_at: String(r.sent_at ?? ''),
    status: String(r.status ?? ''),
  }));
}

/** Unified sweep: one scan-now queues both comment and DM syncs. */
export async function refreshCommunityInbox(): Promise<void> {
  const workspace = await ws();
  if (!workspace) return;
  await callEdgeFunction('scan-now', { workspace_id: workspace });
}

export async function sendCommunityMessage(conversationId: string, text: string): Promise<string | null> {
  const res = await callEdgeFunction('inbox-send', { conversation_id: conversationId, text });
  if (res && res.ok === false) {
    return String(res.error ?? 'Could not queue the message.');
  }
  return null;
}

export async function replyToCommunityComment(commentId: string, text: string): Promise<void> {
  await callEdgeFunction('reply-comment', { comment_id: commentId, text });
}

export async function fetchCommunityUnseen(workspaceOverride?: string): Promise<CommunityUnseen> {
  const workspace = workspaceOverride ?? (await ws());
  if (!workspace) return { comments: 0, messages: 0 };
  const { data, error } = await supabase().rpc('community_unseen', { p_workspace: workspace });
  if (error) return { comments: 0, messages: 0 };
  const j = (data ?? {}) as { comments?: number; messages?: number };
  return { comments: Number(j.comments ?? 0), messages: Number(j.messages ?? 0) };
}

export async function markCommunitySeen(section: 'comments' | 'messages'): Promise<void> {
  const workspace = await ws();
  if (!workspace) return;
  await supabase().rpc('community_mark_seen', { p_workspace: workspace, p_section: section });
}
