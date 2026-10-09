'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Heart, MessageCircle, Pencil, Repeat2, Eye, Send, Share2, Trash2, type LucideIcon } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConnectedChannel, MediaAssetRow, PostWithTargets, PostStatus, WorkspaceInfo } from '@/lib/types';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import {
  approvePost,
  deletePost,
  publishPostNow,
  requestChanges,
  submitForApproval,
} from '@/lib/posts';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { mediaThumbUrl, imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { formatDateTime } from '@/lib/format';
import ChannelAvatar from '@/components/ChannelAvatar';

export type Tab = 'all' | 'queue' | 'drafts' | 'approvals' | 'sent' | 'failed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'Queue' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
];

export const TAB_MATCH: Record<Tab, (s: PostStatus) => boolean> = {
  all: () => true,
  queue: (s) => s === 'queued' || s === 'publishing',
  drafts: (s) => s === 'draft',
  approvals: (s) => s === 'approval',
  sent: (s) => s === 'sent' || s === 'partial',
  failed: (s) => s === 'failed',
};

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** Compact age label for a stats snapshot ("2h ago"). */
function agoShort(iso: string): string {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Short relative time for a post's head, e.g. "2h", "3d", "Mar 4". */
function shortRel(iso: string | null): string {
  if (!iso) return 'unscheduled';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${Math.max(1, s)}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Compact count for the card stats bar (1.2k, 3.4M). */
function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Icon button with a tooltip label, used for the card footer actions. */
function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card transition hover:bg-bone disabled:opacity-40 ${
        danger ? 'text-[#9F2F2D] hover:border-[#9F2F2D]/40 dark:text-[#f2a8a8]' : 'text-soft hover:text-ink'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function mediaOf(p: PostWithTargets): MediaAssetRow[] {
  return [...(p.post_media ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((m) => m.media_assets)
    .filter((m): m is MediaAssetRow => Boolean(m));
}

function lastComment(p: PostWithTargets): string | null {
  const decided = (p.approvals ?? [])
    .filter((a) => a.status === 'changes_requested' && a.comment)
    .sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));
  return decided[0]?.comment ?? null;
}

/** One channel's numbers inside the sent-post performance panel. */
interface StatRow {
  post_target_id: string;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  fetched_at: string;
}

function StatCell({ icon: Icon, value }: { icon: LucideIcon; value: number | null }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-bold text-soft">
      <Icon className="h-3 w-3 text-muted" aria-hidden="true" />
      {value >= 10000 ? `${(value / 1000).toFixed(1)}k` : value}
    </span>
  );
}

/** Unique target channels across a card's parts (chain parts share targets). */
function uniqueTargets(parts: PostWithTargets[]): { provider: string; channel_id: string }[] {
  const seen = new Map<string, { provider: string; channel_id: string }>();
  for (const p of parts) {
    for (const t of p.post_targets) {
      const key = t.channel_id ?? t.provider;
      if (!seen.has(key)) seen.set(key, { provider: t.provider, channel_id: t.channel_id });
    }
  }
  return [...seen.values()];
}

/**
 * Full-post preview dialog. Read-only except an Edit shortcut for drafts —
 * actions (approve, publish, delete) stay on the card behind it.
 *
 * Sent posts additionally render a per-target performance panel: publish
 * status, "Go to post" links (post_targets.remote_url) and live stats from
 * post_stats (likes / comments / shares / views, refreshed daily per channel
 * by the worker's snapshot job).
 */
function PreviewDialog({
  parts,
  avatars,
  draftish,
  sent,
  workspaceId,
  onClose,
  onEdit,
}: {
  parts: PostWithTargets[];
  avatars: Record<string, string>;
  draftish: boolean;
  sent: boolean;
  workspaceId: string;
  onClose: () => void;
  onEdit: (() => void) | null;
}) {
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!sent) return;
    let live = true;
    void (async () => {
      try {
        const sb = createClient();
        const ids = parts.flatMap((p) => p.post_targets.map((t) => t.id));
        if (!ids.length) return;
        const { data } = await sb
          .from('post_stats')
          .select('post_target_id,likes,comments,shares,views,fetched_at')
          .eq('workspace_id', workspaceId)
          .in('post_target_id', ids);
        if (!live) return;
        const map: Record<string, StatRow> = {};
        for (const row of (data ?? []) as StatRow[]) map[row.post_target_id] = row;
        setStats(map);
      } catch {
        // stats are best-effort; the panel shows zeros without them
      }
    })();
    return () => {
      live = false;
    };
  }, [sent, parts, workspaceId]);

  const head = parts[0];
  const meta = POST_STATUS_META[head.status];
  const isChain = parts.length > 1;
  const targets = uniqueTargets(parts);
  const media = parts.flatMap((p) => mediaOf(p));
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Post preview">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="relative my-auto w-full max-w-lg rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-bone hover:text-ink"
          >
            ✕
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`pill ${meta.className}`}>{meta.label}</span>
            {isChain ? (
              <span className="pill bg-paper-dim text-ink">Chain · {parts.length} parts</span>
            ) : null}
            <span className="text-xs text-faint">
              {head.sent_at ? `Sent ${formatDateTime(head.sent_at)}` : formatDateTime(head.scheduled_at)}
            </span>
          </div>
          {targets.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
              {targets.map((t) => (
                <span key={t.channel_id ?? t.provider} className="flex items-center gap-1.5">
                  <ChannelAvatar provider={t.provider} avatar={avatars[t.channel_id]} size={24} />
                  <span className="text-xs font-bold">{providerMeta(t.provider).label}</span>
                </span>
              ))}
            </div>
          ) : null}
          {sent ? (
            <div className="mt-4 space-y-2 rounded-2xl border border-line-soft bg-bone/60 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-faint">Performance</p>
              {parts.flatMap((p) =>
                p.post_targets
                  .filter((t) => t.status === 'sent')
                  .map((t) => {
                    const s = stats[t.id];
                    return (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-card px-3 py-2"
                      >
                        <ChannelAvatar provider={t.provider} avatar={avatars[t.channel_id]} size={22} />
                        <span className="text-xs font-bold">{providerMeta(t.provider).label}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatCell icon={Heart} value={s?.likes ?? 0} />
                          <StatCell icon={MessageCircle} value={s?.comments ?? 0} />
                          <StatCell icon={Repeat2} value={s?.shares ?? 0} />
                          {s?.views != null ? <StatCell icon={Eye} value={s.views} /> : null}
                        </span>
                        {s ? (
                          <span className="text-[10px] text-faint" title={`Fetched ${formatDateTime(s.fetched_at)}`}>
                            {agoShort(s.fetched_at)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-faint">First snapshot lands within a day</span>
                        )}
                        {t.remote_url ? (
                          <a
                            href={t.remote_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-accent transition hover:bg-bone"
                          >
                            Go to post ↗
                          </a>
                        ) : null}
                      </div>
                    );
                  }),
              )}
            </div>
          ) : null}
          <p className="mt-3 font-display text-base font-extrabold tracking-tight">
            {head.title || 'Untitled post'}
          </p>
          <div className="mt-2 max-h-64 space-y-3 overflow-y-auto">
            {parts.map((p, i) => (
              <div key={p.id}>
                {isChain ? (
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-faint">
                    Part {i + 1} of {parts.length}
                  </p>
                ) : null}
                {p.body ? (
                  <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-soft">
                    {p.body}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {media.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {media.map((m) =>
                m.kind === 'video' ? (
                  <video
                    key={m.id}
                    src={m.signed_url}
                    muted
                    playsInline
                    controls
                    className="h-20 w-20 rounded-lg border border-line bg-bone object-cover"
                  />
                ) : mediaThumbUrl(m) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={mediaThumbUrl(m)}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 rounded-lg border border-line object-cover"
                  />
                ) : null,
              )}
            </div>
          ) : null}
          <div className="mt-5 flex gap-2">
            {draftish && onEdit ? (
              <button type="button" onClick={onEdit} className="btn btn-sm btn-bolt">
                Edit
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="btn btn-sm btn-ghost">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PostList({
  posts,
  role,
  userId,
  workspaceId,
  onEdit,
  avatars = {},
  channels = [],
  initialTab,
  hideChrome,
}: {
  posts: PostWithTargets[];
  role: WorkspaceInfo['role'];
  userId: string;
  workspaceId: string;
  /** Optional: open the draft in the composer. Defaults to /post?edit=<id>. */
  onEdit?: (postId: string) => void;
  /** Channel avatar URLs by channel id — brand discs render without photos. */
  avatars?: Record<string, string>;
  /** Connected channels, for author name + @handle on the card head. */
  channels?: ConnectedChannel[];
  /** Preselect a status filter (the /post pills pass theirs). */
  initialTab?: Tab;
  /** Hide the header + pill row (the /post pills already cover filtering). */
  hideChrome?: boolean;
}) {
  const router = useRouter();
  const canApprove = role === 'owner' || role === 'admin';
  const [tab, setTab] = useState<Tab>(initialTab ?? 'all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [sortNewest, setSortNewest] = useState(true);
  const [perPage, setPerPage] = useState(15);
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chanSel, setChanSel] = useState<string[]>([]);
  const [monthSel, setMonthSel] = useState('');
  const [mediaSel, setMediaSel] = useState<'all' | 'text' | 'image' | 'video'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [, startTransition] = useTransition();

  const channelById = useMemo(() => {
    const m = new Map<string, ConnectedChannel>();
    for (const c of channels) m.set(c.id, c);
    return m;
  }, [channels]);

  /** Author label for a channel id: display name, else brand label. */
  const authorOf = (channelId: string, provider: string) => {
    const c = channelById.get(channelId);
    const name = c?.display_name || providerMeta(provider).label;
    const raw = c?.handle ?? c?.external_id ?? '';
    const handle = raw ? (raw.startsWith('@') ? raw : `@${raw}`) : null;
    return { name, handle };
  };

  // Card-level stats: one batch fetch for the visible sent targets (same
  // query the preview panel uses; best-effort, cards render zeros without it).
  useEffect(() => {
    const ids = posts
      .filter((p) => p.status === 'sent' || p.status === 'partial')
      .flatMap((p) => p.post_targets.filter((t) => t.status === 'sent').map((t) => t.id));
    if (!ids.length) return;
    let live = true;
    void (async () => {
      try {
        const sb = createClient();
        const { data } = await sb
          .from('post_stats')
          .select('post_target_id,likes,comments,shares,views,fetched_at')
          .eq('workspace_id', workspaceId)
          .in('post_target_id', ids);
        if (!live) return;
        const map: Record<string, StatRow> = {};
        for (const row of (data ?? []) as StatRow[]) map[row.post_target_id] = row;
        setStats(map);
      } catch {
        // stats are best-effort
      }
    })();
    return () => {
      live = false;
    };
  }, [posts, workspaceId]);

  const dateOf = (p: PostWithTargets) => p.sent_at ?? p.scheduled_at ?? p.created_at ?? '';

  /** Providers actually present across the loaded posts (for the channel filter). */
  const providersPresent = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) for (const t of p.post_targets) set.add(t.provider);
    return [...set].sort((a, b) => providerMeta(a).label.localeCompare(providerMeta(b).label));
  }, [posts]);

  /** YYYY-MM buckets actually present (for the month filter, newest first). */
  const monthsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) {
      const d = dateOf(p);
      if (d.length >= 7) set.add(d.slice(0, 7));
    }
    return [...set].sort().reverse();
  }, [posts]);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const groupMediaKind = (parts: PostWithTargets[]): 'text' | 'image' | 'video' => {
    const kinds = new Set(parts.flatMap((p) => mediaOf(p).map((m) => m.kind)));
    if (kinds.has('video')) return 'video';
    if (kinds.has('image')) return 'image';
    return 'text';
  };

  const activeFilterCount =
    (query.trim() ? 1 : 0) + chanSel.length + (monthSel ? 1 : 0) + (mediaSel !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setQuery('');
    setChanSel([]);
    setMonthSel('');
    setMediaSel('all');
  };

  /** Chain parts render as ONE card — a thread draft is a single post. */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = posts
      .filter((p) => TAB_MATCH[tab](p.status))
      .filter((p) => {
        if (!q) return true;
        return `${p.title ?? ''} ${p.body ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const c = dateOf(a).localeCompare(dateOf(b));
        return sortNewest ? -c : c;
      });
    const out: { key: string; parts: PostWithTargets[] }[] = [];
    const seen = new Set<string>();
    for (const p of filtered) {
      if (p.chain_id) {
        if (seen.has(p.chain_id)) continue;
        seen.add(p.chain_id);
        const parts = filtered
          .filter((q) => q.chain_id === p.chain_id)
          .sort((a, b) => a.chain_position - b.chain_position);
        if (chanSel.length && !parts.some((x) => x.post_targets.some((t) => chanSel.includes(t.provider)))) continue;
        if (monthSel && !dateOf(parts[0]).startsWith(monthSel)) continue;
        if (mediaSel !== 'all' && groupMediaKind(parts) !== mediaSel) continue;
        out.push({ key: `chain:${p.chain_id}`, parts });
      } else {
        if (chanSel.length && !p.post_targets.some((t) => chanSel.includes(t.provider))) continue;
        if (monthSel && !dateOf(p).startsWith(monthSel)) continue;
        if (mediaSel !== 'all' && groupMediaKind([p]) !== mediaSel) continue;
        out.push({ key: `post:${p.id}`, parts: [p] });
      }
    }
    return out;
  }, [posts, tab, sortNewest, query, chanSel, monthSel, mediaSel]);

  // Pagination: 15 rows per page by default, page resets on filter/sort/data.
  useEffect(() => {
    setPage(1);
  }, [tab, sortNewest, perPage, posts.length, query, chanSel, monthSel, mediaSel]);
  const totalPages = Math.max(1, Math.ceil(groups.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageGroups = groups.slice((safePage - 1) * perPage, safePage * perPage);

  async function run(id: string, fn: (sb: SupabaseClient) => Promise<void>) {
    setBusyId(id);
    setErr(null);
    try {
      await fn(createClient());
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  /** Group actions (a chain's parts share one card): run per part, fail loud. */
  async function runMany(key: string, ids: string[], fn: (sb: SupabaseClient, id: string) => Promise<void>) {
    setBusyId(key);
    setErr(null);
    try {
      const sb = createClient();
      for (const id of ids) {
        await fn(sb, id);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  function askChanges(p: PostWithTargets) {
    const comment = window.prompt('What needs changing? (optional)');
    if (comment === null) return;
    void run(p.id, (sb) => requestChanges(sb, { postId: p.id, userId, comment: comment || undefined }));
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!hideChrome && (
      <header className="border-b border-line px-6 py-4">
        <p className="eyebrow">Queue</p>
        <h1 className="font-display text-xl font-extrabold tracking-tight">Posts</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const count = posts.filter((p) => TAB_MATCH[t.id](p.status)).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  tab === t.id ? 'bg-accent text-white' : 'bg-surface text-soft hover:bg-line'
                }`}
              >
                {t.label}
                {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      </header>
      )}

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex-1 p-6 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Filter panel: inline toggle on mobile, sticky sidebar on desktop. */}
        <div className="mb-4 lg:mb-0">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-2.5 text-xs font-bold text-soft transition hover:bg-paper lg:hidden"
          >
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
            <span aria-hidden="true" className="text-muted">{filtersOpen ? '▴' : '▾'}</span>
          </button>
          <aside
            aria-label="Post filters"
            className={`${filtersOpen ? 'mt-2 block' : 'hidden'} rounded-2xl border border-line bg-card p-4 lg:mt-0 lg:block lg:sticky lg:top-4`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Filters</p>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-bold text-accent-ink hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] font-bold text-muted">Search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts…"
                aria-label="Search posts"
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-3">
              <p className="text-[11px] font-bold text-muted">Channels</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {providersPresent.length === 0 ? (
                  <p className="text-[11px] text-faint">No channels on these posts.</p>
                ) : (
                  providersPresent.map((p) => {
                    const on = chanSel.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setChanSel((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))
                        }
                        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold transition ${
                          on ? 'bg-accent text-ink' : 'text-soft hover:bg-paper'
                        }`}
                      >
                        <ChannelAvatar provider={p} size={20} />
                        <span className="min-w-0 flex-1 truncate text-left">{providerMeta(p).label}</span>
                        {on ? <span aria-hidden="true">✓</span> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] font-bold text-muted">Month</span>
              <select
                value={monthSel}
                onChange={(e) => setMonthSel(e.target.value)}
                aria-label="Filter by month"
                className="mt-1 w-full rounded-xl border border-line bg-paper px-2.5 py-2 text-xs font-bold text-ink focus:border-accent focus:outline-none"
              >
                <option value="">All months</option>
                {monthsPresent.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3">
              <p className="text-[11px] font-bold text-muted">Media</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(['all', 'text', 'image', 'video'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mediaSel === m}
                    onClick={() => setMediaSel(m)}
                    className={`rounded-xl px-2 py-1.5 text-xs font-bold capitalize transition ${
                      mediaSel === m ? 'bg-accent text-ink' : 'text-soft hover:bg-paper'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
        <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {groups.length === 0
              ? 'No posts'
              : `Showing ${(safePage - 1) * perPage + 1}–${Math.min(safePage * perPage, groups.length)} of ${groups.length}`}
          </span>
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Rows
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              aria-label="Rows per page"
              className="rounded-full border border-line bg-card px-2 py-1 text-xs font-bold text-ink"
            >
              {[15, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortNewest((v) => !v)}
            aria-label={sortNewest ? 'Sort oldest first' : 'Sort newest first'}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            {sortNewest ? '↓ Newest first' : '↑ Oldest first'}
          </button>
        </div>
        {groups.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
        {pageGroups.map((g) => {
          const head = g.parts[0];
          const isChain = g.parts.length > 1;
          const meta = POST_STATUS_META[head.status];
          const comment = lastComment(head);
          const mediaTotal = g.parts.reduce((n, p) => n + mediaOf(p).length, 0);
          const draftish = g.parts.every((p) => p.status === 'draft' || p.status === 'failed');
          const inApproval = g.parts.every((p) => p.status === 'approval');
          const busy = busyId === g.key;
          const ids = g.parts.map((p) => p.id);
          const targetErr = g.parts.flatMap((p) => p.post_targets).find((t) => t.last_error)?.last_error;
          const targets = uniqueTargets(g.parts);
          const openPreview = () => setPreviewKey(g.key);
          const cardMedia = g.parts.flatMap((p) => mediaOf(p));
          const expanded = expandedKey === g.key;
          const fullText = isChain ? g.parts.map((p) => p.body).filter(Boolean).join('\n\n') : (head.body || '');
          const lead = targets[0];
          const author = lead ? authorOf(lead.channel_id, lead.provider) : { name: 'Draft', handle: null };
          const when = head.sent_at ?? head.scheduled_at;
          const cardStats = g.parts
            .flatMap((p) => p.post_targets)
            .filter((t) => t.status === 'sent')
            .map((t) => stats[t.id])
            .filter((s): s is StatRow => Boolean(s));
          const totalStat = (k: 'likes' | 'comments' | 'shares') =>
            cardStats.reduce((a, s) => a + (s[k] ?? 0), 0);
          const viewSum = cardStats.reduce((a, s) => a + (s.views == null ? 0 : Number(s.views)), 0);
          const hasViews = cardStats.some((s) => s.views != null);
          const showStats = cardStats.length > 0;
          return (
            <>
              <article
                key={g.key}
                className="overflow-hidden rounded-3xl border border-line bg-card"
              >
                {/* Header: author pfp + name/handle + time, like a social post */}
                <div className="flex items-center gap-3 px-4 pt-3.5">
                  <ChannelAvatar
                    provider={lead?.provider ?? 'x'}
                    avatar={lead ? avatars[lead.channel_id] : undefined}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold">{author.name}</span>
                      {isChain ? (
                        <span className="shrink-0 rounded-full bg-paper-dim px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
                          Chain · {g.parts.length}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-faint">
                      {author.handle ? <span className="truncate">{author.handle}</span> : null}
                      {author.handle ? <span aria-hidden="true">·</span> : null}
                      <span
                        className="shrink-0"
                        title={head.sent_at ? formatDateTime(head.sent_at) : formatDateTime(head.scheduled_at)}
                      >
                        {shortRel(when)}
                      </span>
                    </span>
                  </span>
                  <span className={`pill ${meta.className}`}>{meta.label}</span>
                </div>

                {/* Body: full text, expandable */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openPreview}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openPreview();
                    }
                  }}
                  aria-label={`Preview ${head.title || 'post'}`}
                  title="Preview"
                  className="cursor-pointer px-4 pt-2 text-left"
                >
                  {fullText || head.title ? (
                    <>
                      <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-soft ${expanded ? '' : 'line-clamp-4'}`}>
                        {fullText || head.title}
                      </p>
                      {(fullText || head.title || '').length > 220 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedKey(expanded ? null : g.key);
                          }}
                          className="mt-1 text-xs font-bold text-muted hover:text-ink"
                        >
                          {expanded ? 'Show less' : 'Show more'}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-0.5 text-sm italic text-faint">No text — media only.</p>
                  )}
                  {comment && (
                    <p className="mt-1.5 text-xs text-ink">Changes requested: “{comment}”</p>
                  )}
                  {targetErr && (
                    <p className="mt-1.5 text-xs text-[#9F2F2D] dark:text-[#f2a8a8]">
                      {targetErr}
                    </p>
                  )}
                </div>

                {/* Media: social sizing — full-width single, square grid for many */}
                {cardMedia.length > 0 && (
                  <div
                    className={`mt-2.5 flex flex-wrap gap-1.5 px-4 ${cardMedia.length > 1 ? 'max-w-[420px]' : ''} justify-center`}
                  >
                    {cardMedia.slice(0, 4).map((m) =>
                      m.kind === 'video' ? (
                        <video
                          key={m.id}
                          src={m.signed_url}
                          muted
                          playsInline
                          controls
                          className="h-auto max-h-[360px] w-auto max-w-full rounded-xl border border-line bg-bone object-contain"
                        />
                      ) : m.signed_url || m.thumb_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={m.id}
                          src={m.signed_url ? imageThumb(m.signed_url, THUMB_WIDTHS.md) : m.thumb_url ?? undefined}
                          alt=""
                          loading="lazy"
                          className={`h-auto w-auto rounded-xl border border-line bg-bone object-contain ${
                            cardMedia.length > 1 ? 'max-h-[190px] max-w-[calc(50%-0.375rem)]' : 'max-h-[360px] max-w-full'
                          }`}
                        />
                      ) : (
                        <span
                          key={m.id}
                          className="flex h-24 w-24 items-center justify-center rounded-xl border border-line bg-bone text-[10px] text-faint"
                        >
                          {m.kind}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {mediaTotal > 4 && (
                  <p className="px-4 pt-1 text-xs font-bold text-faint">+{mediaTotal - 4} more attachments</p>
                )}

                {/* Footer: target logos (left) · post stats (center) · actions (right) */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="flex items-center gap-1" title={targets.map((t) => providerMeta(t.provider).label).join(', ')}>
                    {targets.map((t) => (
                      <ChannelAvatar
                        key={t.channel_id ?? t.provider}
                        provider={t.provider}
                        avatar={avatars[t.channel_id]}
                        size={22}
                      />
                    ))}
                  </span>
                  {showStats ? (
                    <>
                      <span className="flex-1" />
                      <span className="flex items-center gap-3.5 text-xs font-bold text-muted">
                        {hasViews ? (
                          <span className="inline-flex items-center gap-1" title="Views">
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            {fmtCount(viewSum)}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1" title="Likes">
                          <Heart className="h-4 w-4" aria-hidden="true" />
                          {fmtCount(totalStat('likes'))}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Comments">
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                          {fmtCount(totalStat('comments'))}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Shares">
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                          {fmtCount(totalStat('shares'))}
                        </span>
                      </span>
                    </>
                  ) : null}
                  <span className="flex-1" />
                  {canApprove && inApproval && (
                    <>
                      <IconAction
                        icon={Check}
                        label={`Approve${isChain ? ` (${ids.length})` : ''}`}
                        disabled={busy}
                        onClick={() => runMany(g.key, ids, (sb, id) => approvePost(sb, { postId: id, userId }))}
                      />
                      <IconAction
                        icon={MessageCircle}
                        label="Request changes"
                        disabled={busy}
                        onClick={() => askChanges(head)}
                      />
                    </>
                  )}
                  {draftish && (
                    <IconAction
                      icon={Pencil}
                      label="Edit post"
                      disabled={busy}
                      onClick={() => {
                        if (onEdit) onEdit(head.id);
                        else router.push(`/post?edit=${head.id}`);
                      }}
                    />
                  )}
                  {canApprove && draftish && (
                    <IconAction
                      icon={Send}
                      label="Post now"
                      disabled={busy}
                      onClick={() => runMany(g.key, ids, (sb, id) => publishPostNow(sb, id))}
                    />
                  )}
                  {!canApprove && draftish && (
                    <IconAction
                      icon={Send}
                      label="Submit for approval"
                      disabled={busy}
                      onClick={() =>
                        runMany(g.key, ids, (sb, id) => submitForApproval(sb, { postId: id, workspaceId, userId }))
                      }
                    />
                  )}
                  <IconAction
                    icon={Trash2}
                    label={`Delete${isChain ? ` (${ids.length})` : ''}`}
                    danger
                    disabled={busy}
                    onClick={() => runMany(g.key, ids, (sb, id) => deletePost(sb, id))}
                  />
                </div>
              </article>
            {previewKey === g.key ? (
              <PreviewDialog
                parts={g.parts}
                avatars={avatars}
                draftish={draftish}
                sent={g.parts.some((p) => p.status === 'sent' || p.status === 'partial')}
                workspaceId={workspaceId}
                onClose={() => setPreviewKey(null)}
                onEdit={
                  draftish
                    ? () => {
                        setPreviewKey(null);
                        if (onEdit) onEdit(head.id);
                        else router.push(`/post?edit=${head.id}`);
                      }
                    : null
                }
              />
            ) : null}
          </>
          );
        })}
        {totalPages > 1 ? (
          <nav aria-label="Post pages" className="flex items-center justify-center gap-1.5 pt-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-soft transition hover:bg-bone disabled:opacity-40"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<number[]>((acc, n, _, arr) => {
                const prev = acc[acc.length - 1];
                if (prev !== undefined && n - prev > 1) acc.push(-1);
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === -1 ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-faint">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                    className={`h-8 w-8 rounded-full text-xs font-bold transition ${
                      n === safePage ? 'bg-accent text-white' : 'border border-line bg-card text-soft hover:bg-bone'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-soft transition hover:bg-bone disabled:opacity-40"
            >
              Next →
            </button>
          </nav>
        ) : null}
        </div>
      </div>
    </div>
  );
}
