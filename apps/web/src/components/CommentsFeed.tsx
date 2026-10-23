'use client';

/**
 * Comments tab — the unified comment feed (p92). Reads the `comments`
 * table (RLS: workspace members) and renders real-social chains: one card
 * per thread, the comment at the top and every reply hanging off a rail
 * beneath it, with a single composer pinned to the bottom of the thread.
 *
 * Replies are shown the moment they are sent (optimistic row, marked
 * "Sending…") and reconciled with the worker's stored row afterwards, so the
 * page never has to be refreshed to see what was just written.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, CornerDownRight, ExternalLink, FileText, LoaderCircle, MessageCircle, Play, Search, Send, X,
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import ChannelAvatar from '@/components/ChannelAvatar';
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

function when(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Quick replies: one tap drops the text into the composer, never sends. */
const QUICK_REPLIES = ['Thanks for the kind words!', 'Thanks for reaching out', 'Check your DMs'];

/** Commenter face: platform avatar when known, initial bubble when not.
 *  `provider` adds the platform's logo disc in the corner. */
function CommentFace({
  name,
  avatar,
  size = 32,
  provider,
}: {
  name: string | null;
  avatar: string | null;
  size?: number;
  provider?: string;
}) {
  const letter = (name ?? '').trim().replace('@', '').charAt(0).toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <span className="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-line bg-paper text-soft">
        {avatar ? (
          <SafeImg src={avatar} alt="" width={size} height={size} className="h-full w-full object-cover" />
        ) : letter ? (
          <span className="font-extrabold" style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
      </span>
      {provider ? (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
          <ChannelAvatar provider={provider} size={Math.max(16, Math.round(size * 0.46))} />
        </span>
      ) : null}
    </span>
  );
}

/** Grow a textarea with its content, up to a comfortable cap. */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

/**
 * What the thread is commenting on: the post's poster frame, a two-line
 * caption and a link out to the platform. Everything here comes from the
 * cached row, so opening the feed never calls a platform API.
 */
function PostStrip({ post, platform }: { post: PostContext; platform: string }) {
  const caption = (post.body ?? '').trim();
  const video = post.media_kind === 'video';
  const meta = providerMeta(platform).label;

  const inner = (
    <>
      {post.thumbnail ? (
        <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface">
          <SafeImg
            src={post.thumbnail}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
          {video ? (
            <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            </span>
          ) : null}
        </span>
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface text-faint">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-faint">
          {meta} post{post.posted_at ? ` · ${when(post.posted_at)}` : ''}
        </span>
        <span className="mt-0.5 block break-words text-xs leading-snug text-soft line-clamp-2">
          {caption || `A ${meta} post`}
        </span>
      </span>
      {post.url ? (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
      ) : null}
    </>
  );

  const shell =
    'mb-3 flex items-center gap-2.5 rounded-xl border border-line-soft bg-paper px-2.5 py-2 transition';

  return post.url ? (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      title={`Open the ${meta} post`}
      className={`${shell} hover:border-line hover:bg-surface`}
    >
      {inner}
    </a>
  ) : (
    <div className={shell}>{inner}</div>
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
  const [status, setStatus] = useState<'all' | 'needs' | 'replied'>('all');
  const [q, setQ] = useState('');
  /** Open thread (root comment id); falls back to the first visible one. */
  const [selId, setSelId] = useState<string | null>(null);
  /** Below the lg breakpoint list and thread are separate screens. */
  const [mobileOpen, setMobileOpen] = useState(false);
  /** thread id -> draft text */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** thread id -> comment id the next message replies to (defaults to root) */
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

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
   * Threads: roots (comments nobody in this view replies to) sorted by the
   * chosen order, each carrying its reply tree. A reply whose parent is
   * filtered out is promoted to a root so nothing disappears.
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
    roots.sort((a, b) =>
      order === 'new' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at),
    );
    for (const arr of kids.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    // Every row points at the thread it belongs to, so a "Reply" click deep in
    // the chain drives the composer pinned at the bottom of that thread.
    const rootOf = new Map<string, string>();
    const walk = (r: CommentRow, rootId: string) => {
      rootOf.set(r.id, rootId);
      for (const k of kids.get(r.id) ?? []) walk(k, rootId);
    };
    for (const root of roots) walk(root, root.id);
    return { roots, kids, rootOf };
  }, [rows, chan, order]);

  /** Per thread: newest comment, whether anything is unseen, whether it still needs us. */
  const threadInfo = useMemo(() => {
    const info = new Map<string, { last: CommentRow; hasNew: boolean; needs: boolean; count: number }>();
    const collect = (r: CommentRow, acc: CommentRow[]): CommentRow[] => {
      acc.push(r);
      for (const k of threads.kids.get(r.id) ?? []) collect(k, acc);
      return acc;
    };
    for (const root of threads.roots) {
      const all = collect(root, []);
      const last = all.reduce((a, b) => (b.created_at > a.created_at ? b : a));
      const hasNew = all.some((r) => !r.is_own && r.status === 'new');
      const closed = last.status === 'replied' || last.status === 'hidden' || last.status === 'deleted';
      info.set(root.id, { last, hasNew, needs: hasNew || (!last.is_own && !closed), count: all.length });
    }
    return info;
  }, [threads]);

  const needsCount = useMemo(
    () => threads.roots.filter((r) => threadInfo.get(r.id)?.needs).length,
    [threads, threadInfo],
  );

  const visibleRoots = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return threads.roots.filter((r) => {
      const i = threadInfo.get(r.id);
      if (status === 'needs' && !i?.needs) return false;
      if (status === 'replied' && i?.needs) return false;
      if (needle) {
        const hay = `${r.author_name ?? ''} ${r.body} ${i?.last.body ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [threads, threadInfo, status, q]);

  const activeRoot = visibleRoots.find((r) => r.id === selId) ?? visibleRoots[0] ?? null;

  const bubble = (r: CommentRow, depth: number) => {
    const ch = channelById.get(r.channel_id);
    const canReply = REPLY_PROVIDERS.has(r.platform) && !r.is_own;
    const body = r.body || '(empty comment)';
    const long = body.length > 240;
    const open = expanded.has(r.id);
    const threadId = threads.rootOf.get(r.id) ?? r.id;
    return (
      <div className="flex items-start gap-2.5">
        {r.is_own ? (
          <ChannelAvatar
            provider={r.platform}
            avatar={ch ? channelAvatar(ch.metadata) : undefined}
            size={depth > 0 ? 28 : 32}
          />
        ) : (
          <CommentFace name={r.author_name} avatar={r.author_avatar} />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="min-w-0 truncate text-sm font-bold">
              {r.is_own ? 'You' : r.author_name || 'Unknown'}
            </span>
            {depth === 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted">
                <span>via</span>
                <ChannelAvatar provider={r.platform} size={14} />
                <span>
                  {providerMeta(r.platform).label}
                  {ch?.display_name ? ` · ${ch.display_name}` : ''}
                </span>
              </span>
            ) : null}
            <span className="shrink-0 text-[11px] text-faint">· {when(r.created_at)}</span>
            {r.pending ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper-dim px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-muted">
                <LoaderCircle className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                Sending
              </span>
            ) : r.is_own ? (
              <span className="shrink-0 rounded-full bg-accent/20 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-accent-ink">
                Sent
              </span>
            ) : r.status === 'new' ? (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-[#0b1220]">
                New
              </span>
            ) : r.status === 'replied' || r.status === 'hidden' || r.status === 'deleted' ? (
              <span className="shrink-0 rounded-full bg-paper-dim px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-muted">
                {r.status === 'replied' ? 'Replied' : r.status === 'hidden' ? 'Hidden' : 'Deleted'}
              </span>
            ) : null}
          </p>

          <p
            className={`mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-soft ${
              long && !open ? 'line-clamp-4' : ''
            }`}
          >
            {body}
          </p>
          {long ? (
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(r.id)) next.delete(r.id);
                  else next.add(r.id);
                  return next;
                })
              }
              className="mt-1 text-[11px] font-bold text-accent-ink hover:underline"
            >
              {open ? 'Show less' : 'Show more'}
            </button>
          ) : null}

          {canReply ? (
            <button
              type="button"
              onClick={() => {
                setTargets((t) => ({ ...t, [threadId]: r.id }));
                const el = document.getElementById(`composer-${threadId}`);
                el?.focus();
              }}
              className="mt-1.5 text-[11px] font-bold text-muted transition hover:text-accent-ink"
            >
              Reply
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  /** Recursive chain: a comment, then its replies on a connecting rail. */
  const chain = (r: CommentRow, depth: number) => {
    const kids = threads.kids.get(r.id) ?? [];
    return (
      <li key={r.id} className="relative">
        {bubble(r, depth)}
        {kids.length ? (
          <ol
            className={`mt-2.5 space-y-2.5 border-l border-line ${
              depth > 1 ? 'ml-3 pl-3' : 'ml-4 pl-4'
            }`}
          >
            {kids.map((k) => chain(k, depth + 1))}
          </ol>
        ) : null}
      </li>
    );
  };

  /** One composer per thread, pinned under the chain. */
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
        <p className="text-[11px] text-faint">
          {NO_REPLY_TEXT[root.platform] ?? 'Replies not available on this platform.'}
        </p>
      );
    }

    return (
      <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-muted">Quick replies</span>
        {QUICK_REPLIES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setDrafts((d) => ({ ...d, [threadId]: t }));
              requestAnimationFrame(() => {
                const el = document.getElementById(`composer-${threadId}`) as HTMLTextAreaElement | null;
                el?.focus();
                grow(el);
              });
            }}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-soft transition hover:bg-surface"
          >
            {t}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(threadId, replyingTo ?? root);
        }}
        className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-2 transition focus-within:border-accent/70"
      >
        <ChannelAvatar
          provider={root.platform}
          avatar={ch ? channelAvatar(ch.metadata) : undefined}
          size={28}
        />
        <div className="min-w-0 flex-1">
          {replyingTo ? (
            <div className="mb-1 flex items-center gap-1 text-[11px] text-muted">
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
                className="ml-auto shrink-0 rounded p-0.5 text-faint transition hover:bg-paper-dim hover:text-soft"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <textarea
            id={`composer-${threadId}`}
            value={draft}
            onChange={(e) => {
              setDrafts((d) => ({ ...d, [threadId]: e.target.value }));
              grow(e.target);
            }}
            onInput={(e) => grow(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(threadId, replyingTo ?? root);
              }
            }}
            rows={1}
            placeholder={`Reply as ${name}…`}
            aria-label={`Reply as ${name}`}
            className="block w-full resize-none bg-transparent py-1 text-sm leading-relaxed text-soft outline-none placeholder:text-faint"
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send reply"
          className="btn btn-primary !px-2.5 !py-2 disabled:opacity-40"
        >
          {busy === threadId ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
      </>
    );
  };

  const statusTabs: { key: 'all' | 'needs' | 'replied'; label: string }[] = [
    { key: 'needs', label: `Needs reply${needsCount > 0 ? ` · ${needsCount}` : ''}` },
    { key: 'replied', label: 'Replied' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by channel">
          <button
            type="button"
            onClick={() => setChan('all')}
            aria-pressed={chan === 'all'}
            className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${
              chan === 'all' ? 'border-ink bg-ink text-bone' : 'border-line bg-card text-muted hover:bg-surface'
            }`}
          >
            All channels
          </button>
          {channelsWithRows.map((c) => {
            const on = chan === c.id;
            const name = c.display_name || providerMeta(c.provider).label;
            const handle = c.handle ? (c.handle.startsWith('@') ? c.handle : `@${c.handle}`) : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChan(on ? 'all' : c.id)}
                aria-pressed={on}
                title={`${name}${handle ? ` ${handle}` : ''} - ${providerMeta(c.provider).label}`}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition ${
                  on ? 'border-accent bg-accent' : 'border-line bg-card hover:bg-surface'
                }`}
              >
                <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={28} />
                <span className="flex min-w-0 max-w-40 flex-col leading-tight">
                  <span className={`truncate text-xs font-bold ${on ? 'text-on-accent' : 'text-soft'}`}>{name}</span>
                  {handle ? (
                    <span className={`truncate text-[10px] ${on ? 'text-on-accent/70' : 'text-faint'}`}>{handle}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5" role="group" aria-label="Filter by status">
            {statusTabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                aria-pressed={status === key}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  status === key ? 'bg-accent/25 text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5" role="group" aria-label="Sort comments">
            {(['new', 'old'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrder(o)}
                aria-pressed={order === o}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  order === o ? 'bg-accent/25 text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {o === 'new' ? 'Newest' : 'Oldest'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}
      {note ? (
        <p className="rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
          {note}
        </p>
      ) : null}

      {rows === null ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center text-sm text-muted">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : threads.roots.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center">
          <MessageCircle className="mx-auto h-6 w-6 text-faint" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold">
            {chan === 'all' ? 'No comments yet' : 'No comments on this channel yet'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {chan === 'all'
              ? 'Publish to your channels, get a comment, and it lands here when the engine sweeps - every 5 minutes or on Refresh.'
              : 'Comments on this account land here when the engine sweeps - every 5 minutes or on Refresh.'}
          </p>
        </div>
      ) : (
        <div className="flex overflow-hidden rounded-3xl border border-line bg-card lg:h-[calc(100vh-17rem)] lg:min-h-[560px]">
          {/* Thread list */}
          <aside
            aria-label="Comment threads"
            className={`${mobileOpen ? 'hidden' : 'flex'} min-w-0 w-full flex-col lg:flex lg:w-[380px] lg:shrink-0 lg:border-r lg:border-line-soft`}
          >
            <label className="flex items-center gap-2 border-b border-line-soft px-4 py-3 text-muted">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Search comments</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search comments and people"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
              />
            </label>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {visibleRoots.length === 0 ? (
                <li className="px-4 py-10 text-center text-xs text-muted">
                  {status === 'needs' ? 'Nothing needs a reply. Nice.' : 'No threads match.'}
                </li>
              ) : null}
              {visibleRoots.map((root) => {
                const i = threadInfo.get(root.id);
                const on = activeRoot?.id === root.id;
                const post = root.external_post_id
                  ? posts[`${root.channel_id}:${root.external_post_id}`]
                  : undefined;
                const last = i?.last ?? root;
                return (
                  <li key={root.id}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => {
                        setSelId(root.id);
                        setMobileOpen(true);
                      }}
                      className={`flex w-full items-start gap-3 border-b border-line-soft px-4 py-3.5 text-left transition ${
                        on ? 'bg-accent/15' : 'hover:bg-surface'
                      }`}
                    >
                      <CommentFace name={root.author_name} avatar={root.author_avatar} size={40} provider={root.platform} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold">
                            {root.is_own ? 'You' : root.author_name || 'Unknown'}
                          </span>
                          <span className="shrink-0 text-[11.5px] text-muted">{when(last.created_at)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 break-words text-[13px] leading-snug text-soft">
                          {last.is_own ? 'You: ' : ''}
                          {last.body || '(empty comment)'}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                          <span className="truncate">
                            {post?.body?.trim() || `${providerMeta(root.platform).label} post`}
                          </span>
                          {i?.hasNew ? (
                            <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-[#0b1220]">
                              New
                            </span>
                          ) : i && !i.needs ? (
                            <span className="shrink-0 rounded-full bg-paper-dim px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-muted">
                              Replied
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Open thread */}
          <section
            aria-label="Thread"
            className={`${mobileOpen ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col lg:flex`}
          >
            {activeRoot ? (
              <>
                <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Back to threads"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-surface"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-sm font-bold">Thread</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
                  {(() => {
                    const post = activeRoot.external_post_id
                      ? posts[`${activeRoot.channel_id}:${activeRoot.external_post_id}`]
                      : undefined;
                    return post ? <PostStrip post={post} platform={activeRoot.platform} /> : null;
                  })()}
                  <ol className="space-y-2.5 pb-4 pt-1">{chain(activeRoot, 0)}</ol>
                </div>
                <div className="border-t border-line-soft px-5 pb-4 pt-3">{composer(activeRoot)}</div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center text-sm text-muted">
                Select a thread to read and reply.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
