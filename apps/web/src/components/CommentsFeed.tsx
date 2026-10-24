'use client';

/**
 * Comments tab — the unified comment feed (p92). Reads the `comments`
 * table (RLS: workspace members) and lays it out like a messaging inbox:
 * one row per thread on the left (who, what, which post, needs-a-reply),
 * the open thread on the right with the comment chain on a rail and a
 * single composer pinned to the bottom. Below lg the two panes stack: the
 * list first, the thread full-width with a back button.
 *
 * Replies are shown the moment they are sent (optimistic row, marked
 * "Sending…") and reconciled with the worker's stored row afterwards, so the
 * page never has to be refreshed to see what was just written.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, CornerDownRight, ExternalLink, FileText, Inbox, LoaderCircle, MessageCircle, MessagesSquare, Play, Send, X,
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import ChannelAvatar from '@/components/ChannelAvatar';
import {
  ChannelStrip, Face, InboxShell, PaneEmpty, Segmented, composerText, errorBox, grow, isWide, paneFoot, paneHead, when,
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

/** The post a thread hangs off (p101), cached by the comment sweep. */
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

/** One thread as the list sees it. */
interface ThreadSummary {
  root: CommentRow;
  replies: number;
  /** Newest activity anywhere in the chain; the list sorts on it. */
  last: string;
  /** Someone else spoke last and nobody on our side has answered. */
  needsReply: boolean;
  unread: boolean;
}

/** Poster frame of the post a thread is on; a page glyph when there is none. */
function PostThumb({ post, size }: { post: PostContext | undefined; size: number }) {
  const video = post?.media_kind === 'video';
  return post?.thumbnail ? (
    <span
      className="relative block shrink-0 overflow-hidden rounded-lg bg-surface"
      style={{ width: size, height: size }}
    >
      <SafeImg src={post.thumbnail} alt="" width={size} height={size} className="h-full w-full object-cover" />
      {video ? (
        <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
          <Play className="h-3 w-3 fill-current" aria-hidden="true" />
        </span>
      ) : null}
    </span>
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-lg bg-surface text-faint"
      style={{ width: size, height: size }}
    >
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
  /** Open thread (root comment id). */
  const [sel, setSel] = useState<string | null>(null);
  /** thread id -> draft text */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** thread id -> comment id the next message replies to (defaults to root) */
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadScroll = useRef<HTMLDivElement | null>(null);

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
      seen.set(`${r.channel_id}:${r.external_post_id}`, {
        channel: r.channel_id,
        external: r.external_post_id,
      });
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

  const send = async (threadId: string, target: CommentRow) => {
    const text = (drafts[threadId] ?? '').trim();
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
    setDrafts((d) => ({ ...d, [threadId]: '' }));
    setTargets((t) => {
      const next = { ...t };
      delete next[threadId];
      return next;
    });
    grow(composerRef.current);
    setBusy(threadId);
    setErr(null);
    setNote(null);

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
        landed = next.some(
          (n) => n.is_own && n.body === text && (n.parent_external_id ?? null) === target.external_id,
        );
      }
      if (landed) {
        setRows((prev) => (prev ?? []).filter((r) => r.id !== localId));
      } else {
        setNote('Reply posted, still syncing into Sosial.');
      }
    } catch (e) {
      setRows((prev) => (prev ?? []).filter((r) => r.id !== localId));
      setDrafts((d) => ({ ...d, [threadId]: text }));
      setErr(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusy(null);
    }
  };

  const channelsWithRows = useMemo(() => {
    const ids = new Set((rows ?? []).map((r) => r.channel_id));
    return channels.filter((c) => ids.has(c.id));
  }, [channels, rows]);

  /**
   * Threads: roots (comments nobody in this view replies to), each carrying
   * its reply tree. A reply whose parent is filtered out is promoted to a
   * root so nothing disappears.
   */
  const threads = useMemo(() => {
    const list = (rows ?? []).filter((r) => chan === 'all' || r.channel_id === chan);
    const byKey = new Map(list.map((r) => [`${r.channel_id}:${r.external_id}`, r]));
    const kids = new Map<string, CommentRow[]>();
    const roots: CommentRow[] = [];
    for (const r of list) {
      const parent = r.parent_external_id
        ? byKey.get(`${r.channel_id}:${r.parent_external_id}`)
        : undefined;
      if (parent && parent.id !== r.id) {
        const arr = kids.get(parent.id) ?? [];
        arr.push(r);
        kids.set(parent.id, arr);
      } else {
        roots.push(r);
      }
    }
    for (const arr of kids.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    // Every row points at the thread it belongs to, so a "Reply" click deep in
    // the chain drives the composer pinned at the bottom of that thread.
    const rootOf = new Map<string, string>();
    const summaries: ThreadSummary[] = [];
    for (const root of roots) {
      const all: CommentRow[] = [];
      const walk = (r: CommentRow) => {
        rootOf.set(r.id, root.id);
        all.push(r);
        for (const k of kids.get(r.id) ?? []) walk(k);
      };
      walk(root);
      const newest = all.reduce((a, b) => (b.created_at > a.created_at ? b : a), root);
      summaries.push({
        root,
        replies: all.length - 1,
        last: newest.created_at,
        needsReply: !newest.is_own && REPLY_PROVIDERS.has(root.platform),
        unread: all.some((r) => !r.is_own && r.status === 'new'),
      });
    }
    summaries.sort((a, b) => (order === 'new' ? b.last.localeCompare(a.last) : a.last.localeCompare(b.last)));
    return { summaries, kids, rootOf };
  }, [rows, chan, order]);

  const shown = useMemo(
    () => (show === 'open' ? threads.summaries.filter((t) => t.needsReply) : threads.summaries),
    [threads.summaries, show],
  );
  const openCount = useMemo(() => threads.summaries.filter((t) => t.needsReply).length, [threads.summaries]);

  // Desktop shows both panes, so open the first thread instead of an empty
  // right side; a phone stays on the list until a thread is tapped.
  useEffect(() => {
    if (!shown.length) return;
    if (sel && shown.some((t) => t.root.id === sel)) return;
    if (sel || isWide()) setSel(isWide() ? shown[0].root.id : null);
  }, [shown, sel]);

  const current = sel ? threads.summaries.find((t) => t.root.id === sel) : undefined;

  // A freshly opened thread starts at its top; a new reply scrolls into view.
  useEffect(() => {
    threadScroll.current?.scrollTo({ top: 0 });
  }, [sel]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const postFor = (r: CommentRow) =>
    r.external_post_id ? posts[`${r.channel_id}:${r.external_post_id}`] : undefined;

  /* ------------------------------ list pane ------------------------------ */

  const listRow = (t: ThreadSummary) => {
    const r = t.root;
    const on = r.id === sel;
    const post = postFor(r);
    return (
      <li key={r.id}>
        <button
          type="button"
          onClick={() => setSel(r.id)}
          aria-current={on ? 'true' : undefined}
          className={`relative flex w-full items-start gap-3 px-4 py-3 text-left transition ${
            on ? 'bg-accent-soft' : 'hover:bg-surface'
          }`}
        >
          {on ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" aria-hidden="true" /> : null}
          {r.is_own ? (
            <ChannelAvatar
              provider={r.platform}
              avatar={(() => {
                const ch = channelById.get(r.channel_id);
                return ch ? channelAvatar(ch.metadata) : undefined;
              })()}
              size={40}
            />
          ) : (
            <Face name={r.author_name} avatar={r.author_avatar} platform={r.platform} size={40} />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={`min-w-0 flex-1 truncate text-sm ${t.unread ? 'font-extrabold text-ink' : 'font-bold text-soft'}`}>
                {r.is_own ? 'You' : r.author_name || 'Unknown'}
              </span>
              <span className="shrink-0 text-[11px] text-faint">{when(t.last)}</span>
            </span>
            <span className={`mt-0.5 block text-[13px] leading-snug line-clamp-2 ${t.unread ? 'text-ink' : 'text-muted'}`}>
              {r.body || '(empty comment)'}
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint">
              {t.unread ? (
                <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-[#0b1220]">
                  New
                </span>
              ) : t.needsReply ? (
                <span className="rounded-full border border-line px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-muted">
                  Needs reply
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                  <CornerDownRight className="h-3 w-3" aria-hidden="true" />
                  Answered
                </span>
              )}
              {t.replies > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <MessagesSquare className="h-3 w-3" aria-hidden="true" />
                  {t.replies}
                </span>
              ) : null}
            </span>
          </span>
          <PostThumb post={post} size={44} />
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
              { value: 'all', label: 'All' },
              { value: 'open', label: openCount ? `Needs reply · ${openCount}` : 'Needs reply' },
            ]}
          />
          <Segmented
            label="Sort comments"
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
          title={show === 'open' && threads.summaries.length ? 'All caught up' : chan === 'all' ? 'No comments yet' : 'No comments on this channel yet'}
        >
          {show === 'open' && threads.summaries.length
            ? 'Every comment has an answer from you.'
            : 'Publish to your channels, get a comment, and it lands here when the engine sweeps - every 5 minutes or on Refresh.'}
        </PaneEmpty>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto">{shown.map(listRow)}</ul>
      )}
    </>
  );

  /* ----------------------------- thread pane ----------------------------- */

  const bubble = (r: CommentRow, depth: number) => {
    const ch = channelById.get(r.channel_id);
    const canReply = REPLY_PROVIDERS.has(r.platform) && !r.is_own;
    const body = r.body || '(empty comment)';
    const long = body.length > 280;
    const open = expanded.has(r.id);
    const threadId = threads.rootOf.get(r.id) ?? r.id;
    const size = depth === 0 ? 36 : 28;
    return (
      <div className="flex items-start gap-2.5">
        {r.is_own ? (
          <ChannelAvatar provider={r.platform} avatar={ch ? channelAvatar(ch.metadata) : undefined} size={size} />
        ) : (
          <Face name={r.author_name} avatar={r.author_avatar} size={size} />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`inline-block max-w-full rounded-2xl rounded-tl-md px-3.5 py-2.5 ${
              r.is_own ? 'bg-accent-soft' : 'bg-surface'
            }`}
          >
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="min-w-0 truncate text-[13px] font-bold">
                {r.is_own ? (ch?.display_name ? `You · ${ch.display_name}` : 'You') : r.author_name || 'Unknown'}
              </span>
              {r.pending ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted">
                  <LoaderCircle className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                  Sending
                </span>
              ) : r.status === 'hidden' || r.status === 'deleted' ? (
                <span className="text-[10px] font-bold uppercase tracking-wide text-faint">
                  {r.status === 'hidden' ? 'Hidden' : 'Deleted'}
                </span>
              ) : null}
            </p>
            <p
              className={`mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-soft ${
                long && !open ? 'line-clamp-5' : ''
              }`}
            >
              {body}
            </p>
            {long ? (
              <button
                type="button"
                onClick={() => toggleExpanded(r.id)}
                className="mt-1 text-[11px] font-bold text-accent-ink hover:underline"
              >
                {open ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-3 pl-1 text-[11px] text-faint">
            <span>{when(r.created_at)}</span>
            {canReply ? (
              <button
                type="button"
                onClick={() => {
                  setTargets((t) => ({ ...t, [threadId]: r.id }));
                  composerRef.current?.focus();
                }}
                className="font-bold text-muted transition hover:text-ink"
              >
                Reply
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  /** Recursive chain: a comment, then its replies on a connecting rail. */
  const chain = (r: CommentRow, depth: number) => {
    const kids = threads.kids.get(r.id) ?? [];
    return (
      <li key={r.id}>
        {bubble(r, depth)}
        {kids.length ? (
          <ol className={`mt-3 space-y-3 border-l-2 border-line-soft ${depth > 1 ? 'ml-3 pl-3' : 'ml-[17px] pl-4'}`}>
            {kids.map((k) => chain(k, depth + 1))}
          </ol>
        ) : null}
      </li>
    );
  };

  const composer = (root: CommentRow) => {
    const threadId = root.id;
    const ch = channelById.get(root.channel_id);
    const draft = drafts[threadId] ?? '';
    const targetId = targets[threadId];
    const target = targetId ? (rows ?? []).find((r) => r.id === targetId) : undefined;
    const replyingTo = target && target.id !== root.id ? target : null;
    const name = ch?.display_name || ch?.handle || providerMeta(root.platform).label;
    const disabled = !!busy || !draft.trim();

    if (!REPLY_PROVIDERS.has(root.platform)) {
      return (
        <p className="border-t border-line px-4 py-3 text-center text-xs text-faint">
          {NO_REPLY_TEXT[root.platform] ?? 'Replies not available on this platform.'}
        </p>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(threadId, replyingTo ?? root);
        }}
        className={paneFoot}
      >
        {replyingTo ? (
          <div className="mb-1.5 flex items-center gap-1 px-1 text-[11px] text-muted">
            <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Replying to <b className="font-bold text-soft">{replyingTo.author_name || 'comment'}</b>
            </span>
            <button
              type="button"
              onClick={() =>
                setTargets((t) => {
                  const next = { ...t };
                  delete next[threadId];
                  return next;
                })
              }
              aria-label="Reply to the whole thread instead"
              className="ml-auto shrink-0 rounded p-0.5 text-faint transition hover:bg-surface hover:text-soft"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper py-1.5 pr-1.5 pl-2 transition focus-within:border-accent">
          <ChannelAvatar provider={root.platform} avatar={ch ? channelAvatar(ch.metadata) : undefined} size={28} badge={false} />
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => {
              setDrafts((d) => ({ ...d, [threadId]: e.target.value }));
              grow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(threadId, replyingTo ?? root);
              }
            }}
            rows={1}
            placeholder={`Reply as ${name}…`}
            aria-label={`Reply as ${name}`}
            className={composerText}
          />
          <button
            type="submit"
            disabled={disabled}
            aria-label="Send reply"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[#0b1220] transition hover:bg-accent-bright disabled:opacity-40"
          >
            {busy === threadId ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    );
  };

  const detail = current ? (() => {
    const root = current.root;
    const post = postFor(root);
    const ch = channelById.get(root.channel_id);
    const meta = providerMeta(root.platform).label;
    const caption = (post?.body ?? '').trim();
    return (
      <>
        <header className={paneHead}>
          <button
            type="button"
            onClick={() => setSel(null)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-soft transition hover:bg-surface lg:hidden"
            aria-label="Back to comments"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <PostThumb post={post} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
              {meta} post{ch?.display_name ? ` · ${ch.display_name}` : ''}
              {post?.posted_at ? ` · ${when(post.posted_at)}` : ''}
            </p>
            <p className="truncate text-[13px] text-soft">{caption || `A ${meta} post`}</p>
          </div>
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
        <div ref={threadScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          {err ? <p className={`${errorBox} mb-3`}>{err}</p> : null}
          {note ? (
            <p className="mb-3 rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
              {note}
            </p>
          ) : null}
          <ol className="space-y-3">{chain(root, 0)}</ol>
        </div>
        {composer(root)}
      </>
    );
  })() : (
    <PaneEmpty icon={<MessageCircle className="h-5 w-5" />} title="Pick a comment">
      Open a thread on the left to read it and reply.
    </PaneEmpty>
  );

  return (
    <div className="space-y-3">
      {err && !current ? <p className={errorBox}>{err}</p> : null}
      <InboxShell list={list} detail={detail} detailOpen={!!current} />
    </div>
  );
}
