'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  Hourglass,
  PencilLine,
  Heart,
  MessageCircle,
  Pencil,
  Repeat2,
  Eye,
  ExternalLink,
  Send,
  X,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConnectedChannel, MediaAssetRow, PostWithTargets, PostStatus, WorkspaceInfo } from '@/lib/types';
import { channelAvatar } from '@/lib/channelAvatar';
import SafeImg from '@/components/SafeImg';
import { createClient } from '@/lib/supabase/client';
import {
  approvePost,
  deletePost,
  requestChanges,
  submitForApproval,
} from '@/lib/posts';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { requiresTitle } from '@/lib/compat';
import { mediaThumbUrl, imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { formatDateTime } from '@/lib/format';
import ChannelAvatar from '@/components/ChannelAvatar';
import SocialPost from '@/components/SocialPost';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';
import SegmentedPills from '@/components/ui/segmented-pills';

export type Tab = 'all' | 'queue' | 'drafts' | 'approvals' | 'sent' | 'failed';

const TAB_KEY: Record<Tab, string> = {
  all: 'tabAll',
  sent: 'tabSent',
  failed: 'tabFailed',
  queue: 'tabQueue',
  drafts: 'tabDrafts',
  approvals: 'tabApprovals',
};

/** Translated status pill: keys map 1:1 from PostStatus. */
function statusMeta(status: PostStatus, t: (k: string) => string) {
  const meta = POST_STATUS_META[status];
  const key: Record<PostStatus, string> = {
    draft: 'stDraft',
    approval: 'stApproval',
    queued: 'stQueued',
    publishing: 'stPublishing',
    sent: 'stSent',
    partial: 'stPartial',
    failed: 'stFailed',
  };
  return { ...meta, label: t(key[status]) };
}

const MEDIA_KEY: Record<'all' | 'text' | 'image' | 'video', string> = {
  all: 'fAll',
  text: 'fText',
  image: 'fImage',
  video: 'fVideo',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
  { id: 'queue', label: 'Queue' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approvals', label: 'Approvals' },
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
function shortRel(iso: string | null, unscheduledLabel = 'unscheduled'): string {
  if (!iso) return unscheduledLabel;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '-';
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

/** Feed time: "2h", "3d", "Mar 4" for the past; "in 2h", "Tue 9:00 AM" ahead. */
function relTime(iso: string | null, unscheduledLabel = 'unscheduled'): string {
  if (!iso) return unscheduledLabel;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '-';
  if (at <= Date.now()) return shortRel(iso, unscheduledLabel);
  const m = Math.round((at - Date.now()) / 60000);
  if (m < 60) return `in ${Math.max(1, m)}m`;
  if (m < 24 * 60) return `in ${Math.round(m / 60)}h`;
  return new Date(at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** The small line above a post, like a feed's "Pinned": what state it is in. */
function statusContext(p: PostWithTargets, t: (k: string) => string) {
  const label = statusMeta(p.status, t).label;
  switch (p.status) {
    case 'sent':
      return { icon: <CircleCheck />, text: label, tone: 'muted' as const };
    case 'partial':
      return { icon: <CircleAlert />, text: label, tone: 'danger' as const };
    case 'failed':
      return { icon: <CircleAlert />, text: label, tone: 'danger' as const };
    case 'queued':
    case 'publishing':
      return {
        icon: <Clock3 />,
        text: p.scheduled_at ? `${label} · ${formatDateTime(p.scheduled_at)}` : label,
        tone: 'accent' as const,
      };
    case 'approval':
      return { icon: <Hourglass />, text: label, tone: 'accent' as const };
    default:
      return { icon: <PencilLine />, text: label, tone: 'muted' as const };
  }
}

/** Pill action for the card footer: icon + text label, so the action reads. */
function CardAction({
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
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold transition hover:bg-bone disabled:opacity-40 ${
        danger ? 'text-[#9F2F2D] hover:border-[#9F2F2D]/40 dark:text-[#f2a8a8]' : 'text-soft hover:text-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
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

function compactNum(v: number): string {
  return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

/** One total in the performance grid: big number, small label. */
function StatTile({ icon: Icon, value, label }: { icon: LucideIcon; value: number | null; label: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-2.5">
      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      <p className="mt-1.5 font-display text-lg leading-none font-extrabold tabular-nums">
        {value === null ? '—' : compactNum(value)}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted">{label}</p>
    </div>
  );
}

/** A per-channel figure, inline in a channel row. */
function StatInline({ icon: Icon, value, label }: { icon: LucideIcon; value: number | null; label: string }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-soft" title={label}>
      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      {compactNum(value)}
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
 * Full-post preview dialog. Read-only except an Edit shortcut for drafts -
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
  author,
}: {
  parts: PostWithTargets[];
  avatars: Record<string, string>;
  draftish: boolean;
  sent: boolean;
  workspaceId: string;
  onClose: () => void;
  onEdit: (() => void) | null;
  /** The lead account, as the card shows it. */
  author: { name: string; handle: string | null };
}) {
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const t = useT(appMessages);
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
        const ids = parts.flatMap((p) => p.post_targets.map((tg) => tg.id));
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
  const meta = statusMeta(head.status, t);
  const isChain = parts.length > 1;
  const targets = uniqueTargets(parts);
  /** Only article channels (title-bearing) keep an "Untitled" line; a
   *  photo/text post with no title simply shows its body. */
  const needsTitle = requiresTitle(targets.map((tg) => tg.provider));
  const hasBody = parts.some((p) => (p.body ?? '').trim().length > 0);
  /** Every sent channel's numbers summed, for the feed-style action bar. */
  const totals = Object.values(stats).reduce(
    (acc, r) => ({
      comments: acc.comments + (r.comments ?? 0),
      reposts: acc.reposts + (r.shares ?? 0),
      likes: acc.likes + (r.likes ?? 0),
      views: r.views == null ? acc.views : (acc.views ?? 0) + r.views,
    }),
    { comments: 0, reposts: 0, likes: 0, views: null as number | null },
  );
  const sentTargets = parts.flatMap((p) => p.post_targets.filter((tt) => tt.status === 'sent'));
  const fetched = Object.values(stats)
    .map((r) => r.fetched_at)
    .sort()
    .pop();
  /** One live link: the footer carries it. Several: each channel row has its own. */
  const soleUrl = sentTargets.length === 1 ? sentTargets[0].remote_url : null;
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Post preview">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-card shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]">
          <header className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
            <span className={`pill ${meta.className}`}>{meta.label}</span>
            {isChain ? (
              <span className="pill bg-paper-dim text-ink">{fill(t('chainParts'), { n: parts.length })}</span>
            ) : null}
            <span className="min-w-0 truncate text-xs text-faint">
              {head.sent_at ? formatDateTime(head.sent_at) : formatDateTime(head.scheduled_at)}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="-mr-1.5 ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          {/* The post as a feed shows it: one entry per thread part, joined by
              the thread line. Numbers live in the panel below, once. */}
          <div className="max-h-[56vh] overflow-y-auto px-5 py-4">
            {parts.map((p, i) => {
              const tg = targets[0];
              const pm = mediaOf(p);
              return (
                <SocialPost
                  key={p.id}
                  author={{
                    name: author.name,
                    handle: author.handle,
                    provider: tg?.provider ?? 'x',
                    avatar: tg ? avatars[tg.channel_id] : undefined,
                  }}
                  time={i === 0 ? relTime(head.sent_at ?? head.scheduled_at, t('unscheduled')) : undefined}
                  title={i === 0 && (needsTitle || (head.title && !hasBody)) ? head.title || t('untitled') : null}
                  body={p.body ?? ''}
                  clamp={0}
                  emptyLabel={t('noTextMedia')}
                  badge={isChain ? <span className="text-xs font-bold text-faint">{i + 1}/{parts.length}</span> : undefined}
                  media={pm
                    .map((m) => ({
                      id: m.id,
                      kind: m.kind,
                      src: m.kind === 'video' ? (m.signed_url ?? '') : (mediaThumbUrl(m) ?? ''),
                      poster: m.thumb_url,
                      width: m.width,
                      height: m.height,
                    }))
                    .filter((m) => m.src)}
                  metrics={null}
                  threaded={i < parts.length - 1}
                />
              );
            })}
          </div>

          {sent ? (
            <section className="border-t border-line-soft px-5 py-4" aria-label={t('performance')}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-faint">{t('performance')}</p>
                <span className="truncate text-[11px] text-faint" title={fetched ? formatDateTime(fetched) : undefined}>
                  {fetched ? fill(t('pvUpdated'), { x: agoShort(fetched) }) : t('firstSnapshot')}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                <StatTile icon={Heart} value={totals.likes} label={t('pvLikes')} />
                <StatTile icon={MessageCircle} value={totals.comments} label={t('pvComments')} />
                <StatTile icon={Repeat2} value={totals.reposts} label={t('pvReposts')} />
                <StatTile icon={Eye} value={totals.views} label={t('pvViews')} />
              </div>
              {sentTargets.length > 1 ? (
                <ul className="mt-3 divide-y divide-line-soft">
                  {sentTargets.map((tg) => {
                    const st = stats[tg.id];
                    return (
                      <li key={tg.id} className="flex items-center gap-2.5 py-2">
                        <ChannelAvatar provider={tg.provider} avatar={avatars[tg.channel_id]} size={24} />
                        <span className="min-w-0 flex-1 truncate text-xs font-bold">{providerMeta(tg.provider).label}</span>
                        <span className="flex items-center gap-3">
                          <StatInline icon={Heart} value={st?.likes ?? 0} label={t('pvLikes')} />
                          <StatInline icon={MessageCircle} value={st?.comments ?? 0} label={t('pvComments')} />
                          <StatInline icon={Eye} value={st?.views ?? null} label={t('pvViews')} />
                        </span>
                        {tg.remote_url ? (
                          <a
                            href={tg.remote_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${t('goToPost')} (${providerMeta(tg.provider).label})`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ) : null}

          <footer className="flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3">
            <button type="button" onClick={onClose} className="btn btn-sm btn-ghost">
              {t('close')}
            </button>
            {draftish && onEdit ? (
              <button type="button" onClick={onEdit} className="btn btn-sm btn-bolt">
                {t('edit')}
              </button>
            ) : null}
            {soleUrl ? (
              <a href={soleUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-bolt">
                {t('goToPost')}
              </a>
            ) : null}
          </footer>
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
  /** Channel avatar URLs by channel id, brand discs render without photos. */
  avatars?: Record<string, string>;
  /** Connected channels, for author name + @handle on the card head. */
  channels?: ConnectedChannel[];
  /** Preselect a status filter (the /post pills pass theirs). */
  initialTab?: Tab;
  /** Hide the header + pill row (the /post pills already cover filtering). */
  hideChrome?: boolean;
}) {
  const t = useT(appMessages);
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
  const [, startTransition] = useTransition();

  const channelById = useMemo(() => {
    const m = new Map<string, ConnectedChannel>();
    for (const c of channels) m.set(c.id, c);
    return m;
  }, [channels]);

  /** Author label for a channel id: display name, else brand label. */
  const authorOf = (channelId: string, provider: string) => {
    const c = channelById.get(channelId);
    const display = c?.display_name?.trim() || providerMeta(provider).label;
    // Real handles only: never fall back to external_id (Threads stores the
    // numeric user id there, Ghost stores the site URL, neither is a handle).
    const cleanHandle = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const t = raw.trim().replace(/^@+/, '');
      if (!t) return null;
      if (t.includes('://') || t.includes('/') || t.includes(' ') || t.includes('\\')) return null;
      if (/^\d+$/.test(t)) return null;
      if (t.length > 64) return null;
      return `@${t}`;
    };
    // Threads/Mastodon/X stash "@user" in display_name with handle null -
    // surface that as the handle instead of the numeric id.
    const handle = cleanHandle(c?.handle) ?? (display.startsWith('@') ? cleanHandle(display) : null);
    const name = display.replace(/^@+/, '') || display;
    return { name, handle };
  };

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
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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

  /** Chain parts render as ONE card, a thread draft is a single post. */
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
      setErr(e instanceof Error ? e.message : t('actionFailed'));
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
      setErr(e instanceof Error ? e.message : t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  }

  function askChanges(p: PostWithTargets) {
    const comment = window.prompt(t('askChanges'));
    if (comment === null) return;
    void run(p.id, (sb) => requestChanges(sb, { postId: p.id, userId, comment: comment || undefined }));
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!hideChrome && (
      <header className="border-b border-line px-6 py-4">
        <p className="eyebrow">{t('qEyebrow')}</p>
        <h1 className="font-display text-xl font-extrabold tracking-tight">{t('qPosts')}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((tb) => {
            const count = posts.filter((p) => TAB_MATCH[tb.id](p.status)).length;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  tab === tb.id ? 'bg-accent text-on-accent' : 'bg-surface text-soft hover:bg-line'
                }`}
              >
                {t(TAB_KEY[tb.id])}
                {count > 0 && <span className="opacity-60">{count}</span>}
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
            {t('filters')}{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
            <span aria-hidden="true" className="text-muted">{filtersOpen ? '▴' : '▾'}</span>
          </button>
          <aside
            aria-label="Post filters"
            className={`${filtersOpen ? 'mt-2 block' : 'hidden'} rounded-2xl border border-line bg-card p-4 lg:mt-0 lg:block lg:sticky lg:top-4`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{t('filters')}</p>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-bold text-accent-ink hover:underline"
                >
                  {t('clearAll')}
                </button>
              ) : null}
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] font-bold text-muted">{t('searchLbl')}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPh')}
                aria-label={t('searchPh')}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-3">
              <p className="text-[11px] font-bold text-muted">{t('fChannels')}</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {providersPresent.length === 0 ? (
                  <p className="text-[11px] text-faint">{t('fNoChannels')}</p>
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
                          on ? 'bg-accent text-on-accent' : 'text-soft hover:bg-paper'
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
              <span className="text-[11px] font-bold text-muted">{t('fMonth')}</span>
              <select
                value={monthSel}
                onChange={(e) => setMonthSel(e.target.value)}
                aria-label={t('fMonth')}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-2.5 py-2 text-xs font-bold text-ink focus:border-accent focus:outline-none"
              >
                <option value="">{t('fAllMonths')}</option>
                {monthsPresent.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3">
              <p className="text-[11px] font-bold text-muted">{t('fMedia')}</p>
              <SegmentedPills
                ariaLabel={t('fMedia')}
                className="mt-1.5"
                trackClassName="flex-wrap overflow-visible rounded-2xl"
                buttonClassName="min-w-[calc(50%-2px)] flex-1"
                value={mediaSel}
                onChange={setMediaSel}
                options={(['all', 'text', 'image', 'video'] as const).map((m) => ({ value: m, label: t(MEDIA_KEY[m]) }))}
              />
            </div>
          </aside>
        </div>
        <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {groups.length === 0
              ? t('noPosts')
              : fill(t('showingOf'), { a: (safePage - 1) * perPage + 1, b: Math.min(safePage * perPage, groups.length), n: groups.length })}
          </span>
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            {t('rowsLbl')}
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              aria-label={t('rowsLbl')}
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
            aria-label={sortNewest ? t('oldestFirst') : t('newestFirst')}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            {sortNewest ? t('newestFirst') : t('oldestFirst')}
          </button>
        </div>
        {groups.length === 0 && <p className="text-sm text-muted">{t('nothingHere')}</p>}
        {pageGroups.map((g) => {
          const head = g.parts[0];
          const isChain = g.parts.length > 1;
          const meta = statusMeta(head.status, t);
          const comment = lastComment(head);
          const mediaTotal = g.parts.reduce((n, p) => n + mediaOf(p).length, 0);
          const draftish = g.parts.every((p) => p.status === 'draft' || p.status === 'failed');
          const inApproval = g.parts.every((p) => p.status === 'approval');
          const busy = busyId === g.key;
          const ids = g.parts.map((p) => p.id);
          // Every failed channel gets its message, labelled per provider —
          // a partial failure that only showed one error hid the others.
          const targetErrs = Array.from(
            new Map(
              g.parts
                .flatMap((p) => p.post_targets)
                .filter((t) => t.last_error && t.status === 'failed')
                .map((t) => [
                  `${t.provider}:${t.last_error}`,
                  `${providerMeta(t.provider).label}: ${t.last_error}`,
                ]),
            ).values(),
          );
          const targets = uniqueTargets(g.parts);
          const openPreview = () => setPreviewKey(g.key);
          const cardMedia = g.parts.flatMap((p) => mediaOf(p));
          const expanded = expandedKey === g.key;
          const fullText = isChain ? g.parts.map((p) => p.body).filter(Boolean).join('\n\n') : (head.body || '');
          const lead = targets[0];
          const author = lead ? authorOf(lead.channel_id, lead.provider) : { name: t('stDraft'), handle: null };
          const when = head.sent_at ?? head.scheduled_at;
          return (
            <>
              <article key={g.key} className="rounded-3xl border border-line bg-card px-4 pt-3 pb-3.5 sm:px-5">
                <SocialPost
                  author={{
                    name: author.name,
                    handle: author.handle,
                    provider: lead?.provider ?? 'x',
                    avatar: lead?.channel_id ? avatars[lead.channel_id] : undefined,
                  }}
                  time={relTime(when, t('unscheduled'))}
                  timeTitle={when ? formatDateTime(when) : undefined}
                  context={statusContext(head, t)}
                  badge={
                    <>
                      {isChain ? (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted">
                          {fill(t('chainShort'), { n: g.parts.length })}
                        </span>
                      ) : null}
                      {targets.length > 1 ? (
                        <span className="flex items-center" title={targets.map((tg) => providerMeta(tg.provider).label).join(', ')}>
                          {targets.slice(1, 4).map((tg, i) => (
                            <span key={tg.channel_id ?? tg.provider} className="rounded-full ring-2 ring-card" style={{ marginLeft: i ? -6 : 0 }}>
                              <ChannelAvatar provider={tg.provider} avatar={avatars[tg.channel_id]} size={20} badge={false} />
                            </span>
                          ))}
                          {targets.length > 4 ? (
                            <span className="ml-1 text-[11px] font-bold text-muted">+{targets.length - 4}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </>
                  }
                  title={!fullText && head.title ? head.title : null}
                  body={fullText}
                  emptyLabel={t('noTextMedia')}
                  media={cardMedia.map((m) => ({
                    id: m.id,
                    kind: m.kind,
                    src:
                      m.kind === 'video'
                        ? m.signed_url ?? ''
                        : m.signed_url
                          ? imageThumb(m.signed_url, THUMB_WIDTHS.md) ?? ''
                          : (m.thumb_url ?? ''),
                    poster: m.thumb_url,
                    width: m.width,
                    height: m.height,
                  })).filter((m) => m.src)}
                  onOpen={openPreview}
                  notes={
                    comment || targetErrs.length > 0 ? (
                      <>
                        {comment ? (
                          <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-ink">
                            {fill(t('changesReq'), { c: comment })}
                          </p>
                        ) : null}
                        {targetErrs.map((msg) => (
                          <p key={msg} className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-xs text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                            {msg}
                          </p>
                        ))}
                      </>
                    ) : null
                  }
                  footer={
                    <>
                      <span className="flex-1" />
                      {canApprove && inApproval && (
                        <>
                          <CardAction
                            icon={Check}
                            label={isChain ? fill(t('approveN'), { n: ids.length }) : t('approve')}
                            disabled={busy}
                            onClick={() => runMany(g.key, ids, (sb, id) => approvePost(sb, { postId: id, userId }))}
                          />
                          <CardAction
                            icon={MessageCircle}
                            label={t('reqChanges')}
                            disabled={busy}
                            onClick={() => askChanges(head)}
                          />
                        </>
                      )}
                      {draftish && (
                        <CardAction
                          icon={Pencil}
                          label={t('edit')}
                          disabled={busy}
                          onClick={() => {
                            if (onEdit) onEdit(head.id);
                            else router.push(`/post?edit=${head.id}`);
                          }}
                        />
                      )}
                      {!canApprove && draftish && (
                        <CardAction
                          icon={Send}
                          label={t('submitApproval')}
                          disabled={busy}
                          onClick={() =>
                            runMany(g.key, ids, (sb, id) => submitForApproval(sb, { postId: id, workspaceId, userId }))
                          }
                        />
                      )}
                      <CardAction
                        icon={Trash2}
                        label={isChain ? fill(t('deleteN'), { n: ids.length }) : t('deleteLbl')}
                        danger
                        disabled={busy}
                        onClick={() => runMany(g.key, ids, (sb, id) => deletePost(sb, id))}
                      />
                    </>
                  }
                />
              </article>
            {previewKey === g.key ? (
              <PreviewDialog
                parts={g.parts}
                author={author}
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
              {t('prev')}
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
                      n === safePage ? 'bg-accent text-on-accent' : 'border border-line bg-card text-soft hover:bg-bone'
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
              {t('next')}
            </button>
          </nav>
        ) : null}
        </div>
      </div>
    </div>
  );
}
