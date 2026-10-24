'use client';

/**
 * Comments tab — the unified comment feed (p92), organised by POST. Reads the
 * `comments` table (RLS: workspace members) and groups every comment under
 * the post it was left on, like a topic:
 *
 * - The list shows one row per post: its thumbnail and caption, the faces of
 *   who commented, how many comments, and how many still need an answer.
 * - Opening a post shows the whole conversation as chat bubbles, oldest
 *   first: other people on the left, your replies on the right. Each
 *   comment has its own Reply, so you answer people one by one; the composer
 *   pinned to the bottom says who the next reply goes to.
 *
 * Below lg the two panes stack: the list first, the post full-screen with a
 * back button. Replies show the moment they are sent (optimistic row,
 * "Sending…") and are reconciled with the worker's stored row afterwards.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, CornerDownRight, ExternalLink, FileText, Inbox, LoaderCircle, MessageCircle, Play, Send,
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import ChannelAvatar from '@/components/ChannelAvatar';
import {
  ChannelStrip, Face, InboxShell, PaneEmpty, Segmented, composerText, dayLabel, errorBox, grow, isWide, paneFoot, paneHead, when,
} from '@/components/community/parts';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import { edgeErrorMessage } from '@/lib/functions';
import { providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

interface CommentRow {
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
  /** Optimistic row: sent from this page, not yet confirmed by the worker. */
  pending?: boolean;
}

/** Providers the sync engine can reply on. */
const REPLY_PROVIDERS = new Set(['facebook', 'instagram', 'threads', 'x', 'mastodon', 'bluesky']);
const NO_REPLY_TEXT: Record<string, string> = {
  youtube: 'Replies for YouTube are planned.',
  linkedin: 'Replies for LinkedIn are planned.',
  tiktok: 'Replies for TikTok are planned.',
  pinterest: 'Replies are not exposed by the Pinterest API.',
};

const SELECT =
  'id,channel_id,platform,external_post_id,parent_external_id,external_id,author_name,author_avatar,body,created_at,status,is_own';

/** The post a conversation hangs off (p101), cached by the comment sweep. */
interface PostContext {
  channel_id: string;
  external_id: string;
  platform: string;
  url: string | null;
  body: string | null;
  thumbnail: string | null;
  media_kind: string | null;
  posted_at: string | null;
}

const POST_SELECT = 'channel_id,external_id,platform,url,body,thumbnail,media_kind,posted_at';

/** Every comment on one post, as the list and the conversation see it. */
interface PostGroup {
  key: string;
  channelId: string;
  platform: string;
  externalPostId: string | null;
  /** Oldest first: the conversation reads top to bottom. */
  comments: CommentRow[];
  last: string;
  /** Other people's comments nobody on our side has answered yet. */
  open: CommentRow[];
  unread: number;
  /** Distinct commenters (not us), newest first, for the face stack. */
  people: CommentRow[];
}

/** Poster frame of the post; a page glyph when there is none. */
function PostThumb({ post, size }: { post: PostContext | undefined; size: number }) {
  const video = post?.media_kind === 'video';
  return post?.thumbnail ? (
    <span className="relative block shrink-0 overflow-hidden rounded-xl bg-surface" style={{ width: size, height: size }}>
      <SafeImg src={post.thumbnail} alt="" width={size} height={size} className="h-full w-full object-cover" />
      {video ? (
        <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
          <Play className="h-3 w-3 fill-current" aria-hidden="true" />
        </span>
      ) : null}
    </span>
  ) : (
    <span className="grid shrink-0 place-items-center rounded-xl bg-surface text-faint" style={{ width: size, height: size }}>
      <FileText className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export default function CommentsFeed({
  channels,
  workspaceId,
  reloadKey = 0,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  reloadKey?: number;
}) {
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [posts, setPosts] = useState<Record<string, PostContext>>({});
  const [chan, setChan] = useState<string>('all');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [show, setShow] = useState<'all' | 'open'>('all');
  /** Open post (group key). */
  const [sel, setSel] = useState<string | null>(null);
  /** group key -> draft text */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** group key -> comment id the next reply answers */
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const convoScroll = useRef<HTMLDivElement | null>(null);

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  /** Keep optimistic rows until the worker's copy of them shows up. */
  const reconcile = useCallback((prev: CommentRow[] | null, next: CommentRow[]): CommentRow[] => {
    const pending = (prev ?? []).filter((r) => r.pending);
    if (!pending.length) return next;
    const kept = pending.filter(
      (p) =>
        !next.some(
          (n) =>
            n.is_own &&
            n.body === p.body &&
            (n.parent_external_id ?? null) === (p.parent_external_id ?? null) &&
            Math.abs(new Date(n.created_at).getTime() - new Date(p.created_at).getTime()) < 5 * 60_000,
        ),
    );
    return kept.length ? [...next, ...kept] : next;
  }, []);

  const load = useCallback(async (): Promise<CommentRow[]> => {
    const sb = createClient();
    const { data, error } = await sb
      .from('comments')
      .select(SELECT)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(200);
    const next = (data ?? []) as CommentRow[];
    setRows((prev) => reconcile(prev, next));
    if (error) setErr(error.message);
    return next;
  }, [workspaceId, reconcile]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  // Keep the feed live: new comments land without pressing Refresh, and the
  // page stops polling while it is in a background tab.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  /** Distinct (channel, post) pairs the loaded comments belong to. */
  const postPairs = useMemo(() => {
    const seen = new Map<string, { channel: string; external: string }>();
    for (const r of rows ?? []) {
      if (!r.external_post_id) continue;
      seen.set(`${r.channel_id}:${r.external_post_id}`, { channel: r.channel_id, external: r.external_post_id });
    }
    return [...seen.values()];
  }, [rows]);

  // Only the identity of the set matters: polling rewrites `rows` every 20s
  // but the posts behind them never change, so a refetch per poll would be a
  // query for nothing.
  const postPairKey = postPairs.map((p) => `${p.channel}:${p.external}`).join('|');
  const loadedPairs = useRef('');

  useEffect(() => {
    const want = `${workspaceId}|${postPairKey}`;
    if (!postPairKey) {
      loadedPairs.current = want;
      setPosts({});
      return;
    }
    if (loadedPairs.current === want) return;
    // channel ids are uuids and no platform id carries a colon, so the key
    // splits back into the pair it was built from.
    const pairs = postPairKey.split('|').map((k) => {
      const at = k.indexOf(':');
      return { channel: k.slice(0, at), external: k.slice(at + 1) };
    });
    let alive = true;
    void (async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from('comment_posts')
        .select(POST_SELECT)
        .eq('workspace_id', workspaceId)
        .in('channel_id', [...new Set(pairs.map((p) => p.channel))])
        .in('external_id', [...new Set(pairs.map((p) => p.external))]);
      if (!alive || error) return; // a failed read retries on the next poll
      loadedPairs.current = want;
      const next: Record<string, PostContext> = {};
      for (const p of (data ?? []) as PostContext[]) next[`${p.channel_id}:${p.external_id}`] = p;
      setPosts(next);
    })();
    return () => {
      alive = false;
    };
  }, [postPairKey, workspaceId]);

  const send = async (groupKey: string, target: CommentRow) => {
    const text = (drafts[groupKey] ?? '').trim();
    if (!text || busy) return;
    const ch = channelById.get(target.channel_id);
    const localId = `local:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: CommentRow = {
      id: localId,
      channel_id: target.channel_id,
      platform: target.platform,
      external_post_id: target.external_post_id,
      parent_external_id: target.external_id,
      external_id: localId,
      author_name: ch?.display_name ?? null,
      author_avatar: null,
      body: text,
      created_at: new Date().toISOString(),
      status: 'replied',
      is_own: true,
      pending: true,
    };

    // Show it immediately; the platform round trip happens behind this.
    setRows((prev) => [...(prev ?? []), optimistic]);
    setDrafts((d) => ({ ...d, [groupKey]: '' }));
    setTargets((t) => {
      const next = { ...t };
      delete next[groupKey];
      return next;
    });
    grow(composerRef.current);
    setBusy(groupKey);
    setErr(null);
    setNote(null);
    requestAnimationFrame(() => convoScroll.current?.scrollTo({ top: convoScroll.current.scrollHeight, behavior: 'smooth' }));

    try {
      const sb = createClient();
      const { error } = await sb.functions.invoke('reply-comment', {
        body: { comment_id: target.id, text },
      });
      if (error) {
        const detail = await edgeErrorMessage(error);
        throw new Error(detail ?? error.message);
      }

      // Wait for the worker's copy so the optimistic row can be swapped for
      // the real one (which carries the platform id and the true timestamp).
      let landed = false;
      for (let i = 0; i < 24 && !landed; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const next = await load();
        landed = next.some((n) => n.is_own && n.body === text && (n.parent_external_id ?? null) === target.external_id);
      }
      if (landed) {
        setRows((prev) => (prev ?? []).filter((r) => r.id !== localId));
      } else {
        setNote('Reply posted, still syncing into Sosial.');
      }
    } catch (e) {
      setRows((prev) => (prev ?? []).filter((r) => r.id !== localId));
      setDrafts((d) => ({ ...d, [groupKey]: text }));
      setErr(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusy(null);
    }
  };

  const channelsWithRows = useMemo(() => {
    const ids = new Set((rows ?? []).map((r) => r.channel_id));
    return channels.filter((c) => ids.has(c.id));
  }, [channels, rows]);

  /** Every comment, bucketed by the post it was left on. */
  const groups = useMemo(() => {
    const list = (rows ?? []).filter((r) => chan === 'all' || r.channel_id === chan);
    const byKey = new Map<string, PostGroup>();
    for (const r of list) {
      const key = `${r.channel_id}:${r.external_post_id ?? '-'}`;
      const g =
        byKey.get(key) ??
        ({
          key,
          channelId: r.channel_id,
          platform: r.platform,
          externalPostId: r.external_post_id,
          comments: [],
          last: r.created_at,
          open: [],
          unread: 0,
          people: [],
        } as PostGroup);
      g.comments.push(r);
      if (r.created_at > g.last) g.last = r.created_at;
      byKey.set(key, g);
    }
    for (const g of byKey.values()) {
      g.comments.sort((a, b) => a.created_at.localeCompare(b.created_at));
      // A comment is answered once one of our replies points at it (or the
      // platform already marked it replied).
      const answered = new Set(g.comments.filter((c) => c.is_own && c.parent_external_id).map((c) => c.parent_external_id));
      g.open = REPLY_PROVIDERS.has(g.platform)
        ? g.comments.filter((c) => !c.is_own && c.status !== 'replied' && !answered.has(c.external_id))
        : [];
      g.unread = g.comments.filter((c) => !c.is_own && c.status === 'new').length;
      const seen = new Set<string>();
      g.people = [...g.comments]
        .reverse()
        .filter((c) => !c.is_own)
        .filter((c) => {
          const who = c.author_name ?? c.id;
          if (seen.has(who)) return false;
          seen.add(who);
          return true;
        });
    }
    const all = [...byKey.values()];
    all.sort((a, b) => (order === 'new' ? b.last.localeCompare(a.last) : a.last.localeCompare(b.last)));
    return all;
  }, [rows, chan, order]);

  const shown = useMemo(() => (show === 'open' ? groups.filter((g) => g.open.length > 0) : groups), [groups, show]);
  const openCount = useMemo(() => groups.reduce((n, g) => n + g.open.length, 0), [groups]);

  // Desktop shows both panes, so open the first post instead of an empty
  // right side; a phone stays on the list until a post is tapped.
  useEffect(() => {
    if (!shown.length) return;
    if (sel && shown.some((g) => g.key === sel)) return;
    if (sel || isWide()) setSel(isWide() ? shown[0].key : null);
  }, [shown, sel]);

  const current = sel ? groups.find((g) => g.key === sel) : undefined;

  // Opening a post lands on its newest comments, like any chat.
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = convoScroll.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [sel]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const postOf = (g: PostGroup) => (g.externalPostId ? posts[`${g.channelId}:${g.externalPostId}`] : undefined);

  /* ------------------------------ list pane ------------------------------ */

  const listRow = (g: PostGroup) => {
    const on = g.key === sel;
    const post = postOf(g);
    const meta = providerMeta(g.platform).label;
    const ch = channelById.get(g.channelId);
    const caption = (post?.body ?? '').trim();
    const latest = g.comments[g.comments.length - 1];
    const others = g.comments.filter((c) => !c.is_own).length;
    return (
      <li key={g.key}>
        <button
          type="button"
          onClick={() => setSel(g.key)}
          aria-current={on ? 'true' : undefined}
          className={`relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${on ? 'bg-accent-soft' : 'hover:bg-surface'}`}
        >
          {on ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" aria-hidden="true" /> : null}
          <span className="relative shrink-0">
            <PostThumb post={post} size={52} />
            <span className="absolute -right-1.5 -bottom-1.5 rounded-full ring-2 ring-card">
              <ChannelAvatar provider={g.platform} avatar={ch ? channelAvatar(ch.metadata) : undefined} size={20} badge={false} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={`min-w-0 flex-1 truncate text-sm ${g.unread ? 'font-extrabold text-ink' : 'font-bold text-soft'}`}>
                {caption || (g.externalPostId ? `${meta} post` : `${meta} comments`)}
              </span>
              <span className="shrink-0 text-[11px] text-faint">{when(g.last)}</span>
            </span>
            {latest ? (
              <span className={`mt-0.5 block truncate text-[13px] ${g.unread ? 'text-ink' : 'text-muted'}`}>
                <b className="font-bold">{latest.is_own ? 'You' : latest.author_name || 'Someone'}:</b> {latest.body}
              </span>
            ) : null}
            <span className="mt-2 flex items-center gap-2">
              {/* Who is talking under this post. */}
              <span className="flex items-center">
                {g.people.slice(0, 4).map((p, i) => (
                  <span key={p.id} className="rounded-full ring-2 ring-card" style={{ marginLeft: i ? -7 : 0, zIndex: 4 - i }}>
                    <Face name={p.author_name} avatar={p.author_avatar} size={20} />
                  </span>
                ))}
              </span>
              <span className="text-[11px] font-bold text-muted">
                {others} comment{others === 1 ? '' : 's'}
              </span>
              <span className="flex-1" />
              {g.unread ? (
                <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-extrabold text-[#0b1220]">{g.unread} new</span>
              ) : g.open.length ? (
                <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-bold text-muted">
                  {g.open.length} to answer
                </span>
              ) : others ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-faint">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  All answered
                </span>
              ) : null}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const list = (
    <>
      <div className="space-y-2.5 border-b border-line px-4 pt-3.5 pb-3">
        <ChannelStrip channels={channelsWithRows} value={chan} onChange={setChan} />
        <div className="flex items-center justify-between gap-2">
          <Segmented
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: 'all', label: 'All posts' },
              { value: 'open', label: openCount ? `To answer · ${openCount}` : 'To answer' },
            ]}
          />
          <Segmented
            label="Sort posts"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'new', label: 'Newest' },
              { value: 'old', label: 'Oldest' },
            ]}
          />
        </div>
      </div>
      {rows === null ? (
        <div className="flex flex-1 items-center justify-center">
          <LoaderCircle className="h-5 w-5 animate-spin text-faint" aria-hidden="true" />
        </div>
      ) : shown.length === 0 ? (
        <PaneEmpty
          icon={show === 'open' ? <Inbox className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          title={show === 'open' && groups.length ? 'All caught up' : chan === 'all' ? 'No comments yet' : 'No comments on this channel yet'}
        >
          {show === 'open' && groups.length
            ? 'Every comment has an answer from you.'
            : 'Publish to your channels, get a comment, and it lands here when the engine sweeps - every 5 minutes or on Refresh.'}
        </PaneEmpty>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto">{shown.map(listRow)}</ul>
      )}
    </>
  );

  /* -------------------------- conversation pane -------------------------- */

  const detail = current
    ? (() => {
        const g = current;
        const post = postOf(g);
        const ch = channelById.get(g.channelId);
        const meta = providerMeta(g.platform).label;
        const caption = (post?.body ?? '').trim();
        const byExternal = new Map(g.comments.map((c) => [c.external_id, c]));
        const canReply = REPLY_PROVIDERS.has(g.platform);
        // Next reply goes to the picked comment, else the newest one still
        // waiting for an answer, else the newest comment from someone else.
        const pickedId = targets[g.key];
        const target =
          (pickedId ? g.comments.find((c) => c.id === pickedId) : undefined) ??
          g.open[g.open.length - 1] ??
          [...g.comments].reverse().find((c) => !c.is_own);
        const draft = drafts[g.key] ?? '';
        const sendAs = ch?.display_name || ch?.handle || meta;
        const answered = new Set(g.comments.filter((c) => c.is_own && c.parent_external_id).map((c) => c.parent_external_id));

        return (
          <>
            <header className={paneHead}>
              <button
                type="button"
                onClick={() => setSel(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-soft transition hover:bg-surface lg:hidden"
                aria-label="Back to posts"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <PostThumb post={post} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                  {meta} post{ch?.display_name ? ` · ${ch.display_name}` : ''}
                  {post?.posted_at ? ` · ${when(post.posted_at)}` : ''}
                </p>
                <p className="truncate text-[13px] font-bold text-soft">{caption || `A ${meta} post`}</p>
              </div>
              <span className="hidden shrink-0 text-[11px] font-bold text-muted sm:block">
                {g.comments.filter((c) => !c.is_own).length} comments
              </span>
              {post?.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open the ${meta} post`}
                  aria-label={`Open the ${meta} post`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </header>

            <div ref={convoScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-paper px-3 py-4 sm:px-5">
              {err ? <p className={`${errorBox} mb-3`}>{err}</p> : null}
              {note ? (
                <p className="mb-3 rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
                  {note}
                </p>
              ) : null}
              {g.comments.map((c, i) => {
                const prev = g.comments[i - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(c.created_at).toDateString();
                const parent = c.parent_external_id ? byExternal.get(c.parent_external_id) : undefined;
                const body = c.body || '(empty comment)';
                const long = body.length > 320;
                const open = expanded.has(c.id);
                const isTarget = canReply && target?.id === c.id;
                const done = !c.is_own && (c.status === 'replied' || answered.has(c.external_id));
                return (
                  <Fragment key={c.id}>
                    {newDay ? (
                      <div className="my-3 flex items-center gap-3 first:mt-0" role="separator">
                        <span className="h-px flex-1 bg-line" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-faint">{dayLabel(c.created_at)}</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    ) : null}
                    {c.is_own ? (
                      /* Your reply: right side, yellow, with what it answers. */
                      <div className="mt-3 flex flex-col items-end">
                        {parent && !parent.is_own ? (
                          <p className="mb-1 flex max-w-[80%] items-center gap-1 truncate pr-1 text-[11px] text-muted">
                            <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              to <b className="font-bold">{parent.author_name || 'comment'}</b>: {parent.body}
                            </span>
                          </p>
                        ) : null}
                        <div
                          className={`max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[15px] leading-snug text-[#0b1220] sm:max-w-[68%] lg:text-sm lg:leading-relaxed ${
                            c.pending ? 'opacity-70' : ''
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{body}</p>
                        </div>
                        <p className="mt-1 flex items-center gap-1 pr-1 text-[10px] text-faint">
                          {c.pending ? (
                            <>
                              <LoaderCircle className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                              Sending
                            </>
                          ) : (
                            <>You · {when(c.created_at)}</>
                          )}
                        </p>
                      </div>
                    ) : (
                      /* Someone else: left side, their face, its own Reply. */
                      <div className="mt-3 flex items-end gap-2">
                        <Face name={c.author_name} avatar={c.author_avatar} size={30} />
                        <div className="min-w-0 max-w-[80%] sm:max-w-[68%]">
                          <div
                            className={`rounded-2xl rounded-bl-md border bg-card px-3.5 py-2 transition ${
                              isTarget ? 'border-accent ring-2 ring-accent/40' : 'border-line-soft'
                            }`}
                          >
                            <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                              <span className="truncate">{c.author_name || 'Unknown'}</span>
                              {c.status === 'new' ? (
                                <span className="rounded-full bg-accent px-1.5 text-[9px] font-extrabold uppercase leading-4 text-[#0b1220]">
                                  New
                                </span>
                              ) : null}
                            </p>
                            {parent ? (
                              <p className="mt-0.5 truncate text-[11px] text-muted">
                                ↳ {parent.is_own ? 'to you' : `to ${parent.author_name || 'a comment'}`}
                              </p>
                            ) : null}
                            <p
                              className={`mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug text-soft lg:text-sm lg:leading-relaxed ${
                                long && !open ? 'line-clamp-6' : ''
                              }`}
                            >
                              {body}
                            </p>
                            {long ? (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(c.id)}
                                className="mt-1 text-[11px] font-bold text-accent-ink hover:underline"
                              >
                                {open ? 'Show less' : 'Show more'}
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 flex items-center gap-3 pl-1 text-[11px] text-faint">
                            <span>{when(c.created_at)}</span>
                            {canReply ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTargets((t) => ({ ...t, [g.key]: c.id }));
                                  composerRef.current?.focus();
                                }}
                                className={`font-bold transition ${isTarget ? 'text-ink' : 'text-muted hover:text-ink'}`}
                              >
                                {isTarget ? 'Replying…' : 'Reply'}
                              </button>
                            ) : null}
                            {done ? (
                              <span className="inline-flex items-center gap-0.5 font-bold text-[#346538] dark:text-[#8fd0a0]">
                                <Check className="h-3 w-3" aria-hidden="true" />
                                Answered
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>

            {!canReply ? (
              <p className="border-t border-line px-4 py-3 text-center text-xs text-faint">
                {NO_REPLY_TEXT[g.platform] ?? 'Replies not available on this platform.'}
              </p>
            ) : target ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(g.key, target);
                }}
                className={paneFoot}
              >
                {/* Who this reply goes to; tap Reply under any comment to switch. */}
                <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] text-muted">
                  <Face name={target.author_name} avatar={target.author_avatar} size={18} />
                  <span className="min-w-0 truncate">
                    Replying to <b className="font-bold text-soft">{target.author_name || 'comment'}</b>
                    <span className="text-faint"> · {target.body}</span>
                  </span>
                </div>
                <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper py-1.5 pr-1.5 pl-2 transition focus-within:border-accent">
                  <ChannelAvatar provider={g.platform} avatar={ch ? channelAvatar(ch.metadata) : undefined} size={28} badge={false} />
                  <textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => {
                      setDrafts((d) => ({ ...d, [g.key]: e.target.value }));
                      grow(e.target);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send(g.key, target);
                      }
                    }}
                    rows={1}
                    placeholder={`Reply as ${sendAs}…`}
                    aria-label={`Reply to ${target.author_name || 'comment'} as ${sendAs}`}
                    className={composerText}
                  />
                  <button
                    type="submit"
                    disabled={!!busy || !draft.trim()}
                    aria-label="Send reply"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[#0b1220] transition hover:bg-accent-bright disabled:opacity-40"
                  >
                    {busy === g.key ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        );
      })()
    : (
      <PaneEmpty icon={<MessageCircle className="h-5 w-5" />} title="Pick a post">
        Open a post on the left to see everyone&apos;s comments and reply to each one.
      </PaneEmpty>
    );

  return (
    <div className="space-y-3">
      {err && !current ? <p className={errorBox}>{err}</p> : null}
      <InboxShell list={list} detail={detail} detailOpen={!!current} />
    </div>
  );
}
