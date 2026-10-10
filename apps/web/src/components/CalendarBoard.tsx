'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { ConnectedChannel, MediaAssetRow, PostWithTargets } from '@/lib/types';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { createClient } from '@/lib/supabase/client';
import { deletePost, publishPostNow, rescheduleChannels, reschedulePost } from '@/lib/posts';
import { chainPartsByChain, isChainHead, threadCount } from '@/lib/chains';
import { leadTimeMessage, queueTooSoon } from '@/lib/queue';
import { MONTHS, WEEKDAYS, addDays, addMonths, dayKey, formatTime, isSameDay, monthMatrix, moveToDay } from '@/lib/format';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type View = 'day' | 'week' | 'month' | 'year';

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 68 ? `${text.slice(0, 68)}…` : text;
}

/** Status → event dot colour. Hexes hold up on pastel cards in both themes. */
const STATUS_DOT: Record<string, string> = {
  draft: 'bg-[#9A958B]',
  approval: 'bg-[#B45309]',
  queued: 'bg-[#B45309]',
  publishing: 'bg-[#B45309]',
  partial: 'bg-[#B45309]',
  sent: 'bg-[#12914A]',
  failed: 'bg-[#E5484D]',
};
const dotOf = (status: string): string => STATUS_DOT[status] ?? 'bg-[#9A958B]';

/** Provider → pastel schedule-card tint (fixed hexes, dark text on top). */
const EVENT_TINT: Record<string, { bg: string; border: string }> = {
  facebook: { bg: '#DBEAFE', border: '#BFDBFE' },
  instagram: { bg: '#FCE7F3', border: '#F5C2DF' },
  threads: { bg: '#E9E7F2', border: '#D3CEE6' },
  tiktok: { bg: '#DFF5F2', border: '#B7E5DE' },
  x: { bg: '#FCF3D9', border: '#F0E2B0' },
  bluesky: { bg: '#DBEAFE', border: '#BFDBFE' },
  linkedin: { bg: '#DBEAFE', border: '#BFDBFE' },
  mastodon: { bg: '#E4DFF7', border: '#C9C0EE' },
  pinterest: { bg: '#FDE2E2', border: '#F6C1C1' },
  youtube: { bg: '#FDE2E2', border: '#F6C1C1' },
  telegram: { bg: '#D9EDFB', border: '#B7DBF3' },
  discord: { bg: '#E3E1FB', border: '#C8C3F3' },
  wordpress: { bg: '#DDE9F5', border: '#BDD5EC' },
  devto: { bg: '#E8E8EA', border: '#D4D4D8' },
  hashnode: { bg: '#E3E9FF', border: '#C2CFFA' },
  ghost: { bg: '#E8E8EA', border: '#D4D4D8' },
  vk: { bg: '#DCE9F8', border: '#B9D3EE' },
  gmb: { bg: '#E2E8F0', border: '#CBD5E1' },
};
const DEFAULT_TINT = { bg: '#F1F5F9', border: '#E2E8F0' };
const tintOf = (provider: string | undefined): { bg: string; border: string } =>
  (provider && EVENT_TINT[provider]) || DEFAULT_TINT;

/** Real account avatars with platform logo badges (brand disc fallback). */
function ChannelAvatars({
  post,
  avatarOf,
}: {
  post: PostWithTargets;
  avatarOf: (channelId: string) => string | undefined;
}) {
  const targets = post.post_targets.slice(0, 4);
  return (
    <span className="flex shrink-0 items-center" aria-hidden="true">
      {targets.map((t, i) => (
        <span key={t.channel_id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: targets.length - i }}>
          <ChannelAvatar provider={t.provider} avatar={avatarOf(t.channel_id)} size={18} />
        </span>
      ))}
    </span>
  );
}

/** Local wall-clock parts of an ISO instant. */
function partsOf(iso: string | null): { h: number; m: number } {
  const d = iso ? new Date(iso) : new Date();
  return { h: d.getHours(), m: d.getMinutes() };
}

/* ------------------------- week time-grid geometry ------------------------- */

const HOUR_PX = 48;
const DAY_H = HOUR_PX * 24;

function minutesOf(iso: string | null): number {
  const { h, m } = partsOf(iso);
  return h * 60 + m;
}

function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

/** Interval-partition a day's posts into lanes so overlaps sit side by side
 *  (30-minute collision window — posts are instants, not durations). */
function layoutDay(items: PostWithTargets[]): {
  p: PostWithTargets;
  top: number;
  lane: number;
  lanes: number;
}[] {
  const sorted = [...items].sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
  const starts = sorted.map((p) => minutesOf(p.scheduled_at));
  const ends = starts.map((s) => s + 30);
  const laneEnd: number[] = [];
  const laneOf: number[] = sorted.map((_, i) => {
    let lane = laneEnd.findIndex((e) => e <= starts[i]);
    if (lane < 0) {
      lane = laneEnd.length;
      laneEnd.push(ends[i]);
    } else {
      laneEnd[lane] = ends[i];
    }
    return lane;
  });
  return sorted.map((p, i) => {
    let lanes = laneOf[i] + 1;
    sorted.forEach((_, j) => {
      if (j !== i && starts[j] < ends[i] && starts[i] < ends[j]) {
        lanes = Math.max(lanes, laneOf[j] + 1);
      }
    });
    return { p, top: (starts[i] / 60) * HOUR_PX, lane: laneOf[i], lanes };
  });
}

/** ISO instant for a day-key + wall time, in local time. */
function isoAt(key: string, h: number, m: number): string {
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}

/** Ret time editor for the selected post (keyed by post so it resets). */
function TimeEditor({
  post,
  dayLabel,
  avatarOf,
  onSave,
  onSaveChannels,
  onPublish,
  onDelete,
  busy,
}: {
  post: PostWithTargets;
  dayLabel: string;
  avatarOf: (channelId: string) => string | undefined;
  onSave: (iso: string) => void;
  onSaveChannels: (times: { channelId: string; iso: string }[]) => void;
  onPublish: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const init = partsOf(post.scheduled_at);
  const [hh, setHh] = useState(init.h);
  const [mm, setMm] = useState(init.m);
  const st = POST_STATUS_META[post.status];
  const targets = post.post_targets.filter((t) => t.status === 'queued' || t.status === 'pending');
  // Per-channel times — every channel can publish at its own instant.
  const [times, setTimes] = useState<Record<string, { h: number; m: number }>>(() =>
    Object.fromEntries(targets.map((t) => [t.channel_id, partsOf(t.scheduled_at)])),
  );
  const perChannel = targets.length > 1;

  const applyAll = (h: number, m: number) => onSave(isoAt(dayLabel, h, m));

  const savePerChannel = () => {
    onSaveChannels(
      targets.map((t) => {
        const v = times[t.channel_id] ?? partsOf(t.scheduled_at);
        return { channelId: t.channel_id, iso: isoAt(dayLabel, v.h, v.m) };
      }),
    );
  };

  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink">{formatTime(post.scheduled_at)}</span>
        <Badge className={st.className}>{st.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink">{snippet(post)}</p>

      {perChannel ? (
        <>
          <p className="mt-2 text-xs font-bold text-muted">Time per channel</p>
          <div className="mt-1 space-y-1.5">
            {targets.map((t) => {
              const meta = providerMeta(t.provider);
              const v = times[t.channel_id] ?? partsOf(t.scheduled_at);
              return (
                <div key={t.channel_id} className="flex items-center gap-2">
                  <ChannelAvatar provider={t.provider} avatar={avatarOf(t.channel_id)} size={22} />
                  <span className="w-16 shrink-0 truncate text-[11px] font-bold">{meta.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={v.h}
                    onChange={(e) =>
                      setTimes((prev) => ({
                        ...prev,
                        [t.channel_id]: { h: Math.max(0, Math.min(23, Number(e.target.value) || 0)), m: v.m },
                      }))
                    }
                    aria-label={`${meta.label} hour`}
                    className="field !w-14 !py-1 text-center !text-xs tabular-nums"
                  />
                  <span className="text-xs font-bold text-muted">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={v.m}
                    onChange={(e) =>
                      setTimes((prev) => ({
                        ...prev,
                        [t.channel_id]: { h: v.h, m: Math.max(0, Math.min(59, Number(e.target.value) || 0)) },
                      }))
                    }
                    aria-label={`${meta.label} minute`}
                    className="field !w-14 !py-1 text-center !text-xs tabular-nums"
                  />
                </div>
              );
            })}
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => savePerChannel()} disabled={busy}>
            Save per-channel times
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs font-bold text-muted">Move to</p>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={23}
              value={hh}
              onChange={(e) => setHh(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
              aria-label="Hour (0-23)"
              className="field !w-16 !py-1.5 text-center !text-xs tabular-nums"
            />
            <span className="font-bold text-muted">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={mm}
              onChange={(e) => setMm(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              aria-label="Minute"
              className="field !w-16 !py-1.5 text-center !text-xs tabular-nums"
            />
            <span className="flex-1" />
            <Button size="sm" onClick={() => applyAll(hh, mm)} disabled={busy}>
              Set time
            </Button>
          </div>
        </>
      )}

      <div className="mt-2 flex gap-1.5">
        {post.status !== 'sent' && post.status !== 'partial' ? (
          <Button variant="ghost" size="sm" className="flex-1" onClick={onPublish} disabled={busy}>
            Post now
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="flex-1 !text-[#9F2F2D]" onClick={onDelete} disabled={busy}>
          Delete
        </Button>
      </div>
    </div>
  );
}

export default function CalendarBoard({
  posts,
  channels,
  initialView = 'week',
  initialAnchor,
  media = {},
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  /** View from the route path (/calendar-month → month). The URL is the source of truth. */
  initialView?: View;
  /** Day-key (YYYY-MM-DD) the calendar opens on — carried in ?d= across view switches. */
  initialAnchor?: string;
  /** Signed media per post id, for the thumbnail row on schedule cards. */
  media?: Record<string, MediaAssetRow[]>;
}) {
  const router = useRouter();
  const [view] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(() => {
    if (initialAnchor) {
      const [y, m, d] = initialAnchor.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Avatar per channel for the identity tiles (brand disc fallback). */
  const avatarByChannel = useMemo(
    () => new Map(channels.map((c) => [c.id, channelAvatar(c.metadata)])),
    [channels],
  );
  const avatarOf = (channelId: string): string | undefined => avatarByChannel.get(channelId);

  /** Chain parts grouped by chain_id — only the head renders anywhere. */
  const chainParts = useMemo(() => chainPartsByChain(posts), [posts]);
  /** Chain size: sibling rows, or the worker thread length for collapsed chains. */
  const partCount = (p: PostWithTargets): number => threadCount(p, chainParts);
  const isHead = (p: PostWithTargets): boolean => isChainHead(p, chainParts);

  const byDay = useMemo(() => {
    const m = new Map<string, PostWithTargets[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      if (!isHead(p)) continue;
      const k = dayKey(new Date(p.scheduled_at));
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, chainParts]);

  const undated = useMemo(
    () => posts.filter((p) => !p.scheduled_at && isHead(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, chainParts],
  );
  const weeks = useMemo(() => monthMatrix(anchor), [anchor]);
  /** Monday-first 7-day window containing the anchor (Week view). */
  const weekDays = useMemo(() => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;
  const today = new Date();
  const todayKey = dayKey(today);
  /** Per-day time layouts for the week grid (posts at their exact time). */
  const weekLayouts = useMemo(
    () => weekDays.map((d) => layoutDay(byDay.get(dayKey(d)) ?? [])),
    [weekDays, byDay],
  );
  const nowTop = ((today.getHours() * 60 + today.getMinutes()) / 60) * HOUR_PX;

  /** Single-day time layout for the Day view (anchor's date). */
  const dayLayout = useMemo(
    () => layoutDay(byDay.get(dayKey(anchor)) ?? []),
    [anchor, byDay],
  );

  /** All parts that move as one: the post alone, or its whole chain. */
  function chainOf(id: string): PostWithTargets[] {
    const post = posts.find((p) => p.id === id);
    if (!post) return [];
    return post.chain_id ? (chainParts.get(post.chain_id) ?? [post]) : [post];
  }

  /** Retime the head to `iso`, shifting every part by the same delta so chain gaps survive. */
  async function retime(id: string, iso: string) {
    const parts = chainOf(id);
    const head = parts.find((p) => p.id === id) ?? parts[0];
    if (!head) return;
    const delta = new Date(iso).getTime() - new Date(head.scheduled_at ?? iso).getTime();
    const moves = parts.map((part) => ({
      id: part.id,
      iso: new Date(new Date(part.scheduled_at ?? iso).getTime() + delta).toISOString(),
    }));
    // Pre-validate everything: a chain never half-moves.
    if (moves.some((m) => queueTooSoon(m.iso))) {
      setErr(leadTimeMessage());
      return;
    }
    setErr(null);
    try {
      const sb = createClient();
      await Promise.all(moves.map((m) => reschedulePost(sb, m.id, m.iso)));
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reschedule that post.');
    }
  }

  async function persistChannels(times: { channelId: string; iso: string }[]) {
    if (!selectedPostId) return;
    setErr(null);
    try {
      const sb = createClient();
      await rescheduleChannels(sb, selectedPostId, times);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save those times.');
    }
  }

  async function publishNow() {
    if (!selectedPostId) return;
    setErr(null);
    try {
      const sb = createClient();
      await publishPostNow(sb, selectedPostId);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not queue that post.');
    }
  }

  async function remove() {
    if (!selectedPostId) return;
    const ids = chainOf(selectedPostId).map((p) => p.id);
    if (!ids.length) return;
    setErr(null);
    try {
      const sb = createClient();
      await Promise.all(ids.map((id) => deletePost(sb, id)));
      setSelectedPostId(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete that post.');
    }
  }

  async function dropOn(target: Date) {
    const id = dragId;
    setDragId(null);
    setOverKey(null);
    if (!id) return;
    // Dragging a chain head moves every part to the new day, times kept.
    const moves = chainOf(id).map((part) => ({ id: part.id, iso: moveToDay(part.scheduled_at, target) }));
    if (!moves.length) return;
    if (moves.some((m) => queueTooSoon(m.iso))) {
      setErr(leadTimeMessage());
      setSelectedKey(dayKey(target));
      return;
    }
    setErr(null);
    try {
      const sb = createClient();
      await Promise.all(moves.map((m) => reschedulePost(sb, m.id, m.iso)));
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reschedule that post.');
    }
    setSelectedKey(dayKey(target));
  }

  const title =
    view === 'day'
      ? anchor.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
      : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const stepPrev = () => {
    if (view === 'month') setAnchor(addMonths(anchor, -1));
    else if (view === 'week') setAnchor(addDays(anchor, -7));
    else if (view === 'day') setAnchor(addDays(anchor, -1));
    else setAnchor(addMonths(anchor, -12));
  };
  const stepNext = () => {
    if (view === 'month') setAnchor(addMonths(anchor, 1));
    else if (view === 'week') setAnchor(addDays(anchor, 7));
    else if (view === 'day') setAnchor(addDays(anchor, 1));
    else setAnchor(addMonths(anchor, 12));
  };
  const stepToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelectedKey(dayKey(now));
  };

  /** Switch views at their own URLs, carrying the anchor day in ?d= so the
   *  window doesn't jump back to today. */
  const goView = (next: View) => {
    if (next === view) return;
    const d = dayKey(anchor);
    const path =
      next === 'month'
        ? '/calendar-month'
        : next === 'day'
          ? '/calendar-day'
          : next === 'year'
            ? '/calendar-year'
            : '/calendar';
    router.push(`${path}?d=${d}`, { scroll: false });
  };

  const VIEW_TABS: { id: View; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];

  /** Pastel schedule card: provider avatar + "{Provider} Post", time, thumbnails. */
  const scheduleCard = (
    p: PostWithTargets,
    k: string,
    pos?: { top: number; left: string; width: string },
  ) => {
    const t0 = p.post_targets[0];
    const tint = tintOf(t0?.provider);
    const label = t0 ? providerMeta(t0.provider).label : 'Post';
    const thumbs = (media[p.id] ?? []).slice(0, 4);
    return (
      <div
        key={p.id}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setDragId(p.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverKey(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedKey(k);
          setSelectedPostId(p.id);
        }}
        title={snippet(p)}
        className={`cursor-grab overflow-hidden rounded-[10px] border px-2.5 py-2 transition hover:shadow-md ${
          dragId === p.id ? 'opacity-50' : ''
        } ${selectedPostId === p.id ? 'ring-2 ring-ink/40' : ''} ${pos ? 'absolute' : ''}`}
        style={{
          background: tint.bg,
          borderColor: tint.border,
          ...(pos ?? {}),
          minHeight: 100,
          maxHeight: 150,
        }}
      >
        <div className="flex items-center gap-1.5">
          {t0 ? (
            <ChannelAvatar provider={t0.provider} avatar={avatarOf(t0.channel_id)} size={18} />
          ) : null}
          <span className="truncate text-xs font-extrabold" style={{ color: '#1F2937' }}>
            {label} Post
          </span>
          <span className="flex-1" />
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotOf(p.status)}`} aria-hidden="true" />
        </div>
        <div
          className="mt-0.5 truncate text-[10px] font-medium"
          style={{ color: '#6B7280', paddingLeft: t0 ? 24 : 0 }}
        >
          {formatTime(p.scheduled_at)}
          {partCount(p) > 1 ? ` · Thread ${partCount(p)}` : ''}
        </div>
        {thumbs.length > 0 ? (
          <div className="mt-1.5 flex gap-1" style={{ paddingLeft: t0 ? 24 : 0 }}>
            {thumbs.map((m) => {
              const src =
                m.kind === 'image' && m.signed_url
                  ? imageThumb(m.signed_url, THUMB_WIDTHS.xs)
                  : (m.thumb_url ?? m.signed_url ?? undefined);
              return src ? (
                <img
                  key={m.id}
                  src={src}
                  alt=""
                  className="h-7 w-7 rounded-md border border-black/5 object-cover"
                />
              ) : null;
            })}
          </div>
        ) : null}
      </div>
    );
  };

  /** Hour gutter for the time grids (12 AM … 11 PM). */
  const gutter = (
    <div className="relative" style={{ height: DAY_H }}>
      {Array.from({ length: 24 }, (_, h) => (
        <span
          key={h}
          className="absolute right-1.5 text-[10px] font-medium tabular-nums text-faint"
          style={{ top: h * HOUR_PX - 7 }}
        >
          {hourLabel(h)}
        </span>
      ))}
    </div>
  );

  /** One day column of a time grid: dashed hour lines, now-line, schedule cards. */
  const dayColumn = (
    date: Date,
    items: { p: PostWithTargets; top: number; lane: number; lanes: number }[],
  ) => {
    const k = dayKey(date);
    const isOver = overKey === k;
    return (
      <div
        key={k}
        onClick={() => {
          setSelectedKey(k);
          setSelectedPostId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (overKey !== k) setOverKey(k);
        }}
        onDragLeave={() => setOverKey((v) => (v === k ? null : v))}
        onDrop={(e) => {
          e.preventDefault();
          void dropOn(date);
        }}
        className={`relative cursor-pointer border-l border-dashed border-line-soft transition ${
          selectedKey === k ? 'bg-paper-dim/40' : ''
        } ${isOver ? 'bg-accent-soft' : ''}`}
        style={{ height: DAY_H }}
      >
        {Array.from({ length: 25 }, (_, h) => (
          <div
            key={h}
            aria-hidden="true"
            className="absolute right-0 left-0 border-t border-dashed border-line-soft"
            style={{ top: h * HOUR_PX }}
          />
        ))}
        {k === todayKey ? (
          <div className="absolute right-0 left-0 z-10 border-t-2 border-[#E5484D]" style={{ top: nowTop }}>
            <span className="absolute -top-[5px] left-0 h-2 w-2 rounded-full bg-[#E5484D]" />
          </div>
        ) : null}
        {items.map(({ p, top, lane, lanes }) =>
          scheduleCard(p, k, {
            top,
            left: `calc(${(lane / lanes) * 100}% + 3px)`,
            width: `calc(${100 / lanes}% - 6px)`,
          }),
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
          <div className="flex items-center rounded-full border border-line">
            <button
              type="button"
              onClick={stepPrev}
              aria-label="Previous"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stepToday}
              className="px-1.5 text-xs font-bold text-ink transition hover:opacity-70"
            >
              Today
            </button>
            <button
              type="button"
              onClick={stepNext}
              aria-label="Next"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:text-ink"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav
          aria-label="Calendar view"
          className="flex items-center gap-0.5 rounded-full bg-paper-dim p-1"
        >
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goView(t.id)}
              aria-current={view === t.id ? 'page' : undefined}
              className={`rounded-full px-4 py-1.5 text-xs transition ${
                view === t.id
                  ? 'bg-paper font-extrabold text-ink shadow-sm'
                  : 'font-bold text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {err && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-ink py-2.5 pr-2.5 pl-4 text-sm text-paper shadow-xl">
            <span className="truncate">{err}</span>
            <button
              type="button"
              onClick={() => setErr(null)}
              aria-label="Dismiss"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs opacity-70 transition hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col xl:flex-row">
        <div className="min-w-0 flex-1 p-4">
          {view === 'month' ? (
            <>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="bg-card px-2 py-2 text-center text-xs font-bold text-muted">
                    {d}
                  </div>
                ))}
                {weeks.flat().map((day) => {
                  const k = dayKey(day);
                  const items = byDay.get(k) ?? [];
                  const inMonth = day.getMonth() === anchor.getMonth();
                  const isDayToday = isSameDay(day, today);
                  const isOver = overKey === k;
                  return (
                    <div
                      key={k}
                      onClick={() => {
                        setSelectedKey(k);
                        setSelectedPostId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (overKey !== k) setOverKey(k);
                      }}
                      onDragLeave={() => setOverKey((v) => (v === k ? null : v))}
                      onDrop={(e) => {
                        e.preventDefault();
                        void dropOn(day);
                      }}
                      className={`min-h-[104px] cursor-pointer bg-card p-1.5 transition ${
                        inMonth ? '' : 'opacity-45'
                      } ${selectedKey === k ? 'bg-paper' : ''} ${
                        isOver ? 'ring-2 ring-inset ring-accent' : ''
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isDayToday ? 'bg-accent text-on-accent' : 'text-muted'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {items.length > 2 && <span className="text-[10px] text-faint">+{items.length - 2}</span>}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 2).map((p) => (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={() => setDragId(p.id)}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverKey(null);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKey(k);
                              setSelectedPostId(p.id);
                            }}
                            title={snippet(p)}
                            className={`cursor-grab rounded-lg border border-line bg-paper px-1.5 py-1 text-[11px] leading-tight ${
                              dragId === p.id ? 'opacity-50' : ''
                            } ${selectedPostId === p.id ? 'ring-1 ring-accent' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-ink">{formatTime(p.scheduled_at)}</span>
                              <ChannelAvatars post={p} avatarOf={avatarOf} />
                            </div>
                            {partCount(p) > 1 ? (
                              <div className="text-[10px] font-bold text-faint">
                                Thread · {partCount(p)}
                              </div>
                            ) : null}
                            <div className="truncate text-soft">{snippet(p)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-faint">
                Drag a post onto another day to reschedule it. Times stay the same. Click a post to retime it.
              </p>
            </>
          ) : view === 'week' ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    {/* day headers */}
                    <div
                      className="grid border-b border-line"
                      style={{ gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))' }}
                    >
                      <div />
                      {weekDays.map((day) => {
                        const hk = dayKey(day);
                        const isDayToday = hk === todayKey;
                        return (
                          <button
                            key={hk}
                            type="button"
                            onClick={() => {
                              setSelectedKey(hk);
                              setSelectedPostId(null);
                            }}
                            className="px-1 py-2.5 text-center text-xs transition hover:bg-paper-dim"
                          >
                            <span className={isDayToday ? 'font-extrabold text-ink' : 'font-medium text-muted'}>
                              {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* time grid */}
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))' }}
                    >
                      {gutter}
                      {weekDays.map((day, di) => dayColumn(day, weekLayouts[di]))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-faint">
                Posts sit at their exact time. Drag a post onto another day to reschedule it (time
                stays the same). Click a post to retime it.
              </p>
            </>
          ) : view === 'day' ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="border-b border-line px-4 py-2.5 text-center text-xs">
                  <span
                    className={
                      dayKey(anchor) === todayKey ? 'font-extrabold text-ink' : 'font-medium text-muted'
                    }
                  >
                    {anchor.toLocaleDateString(undefined, { weekday: 'long' })} {anchor.getDate()}
                  </span>
                </div>
                <div className="grid" style={{ gridTemplateColumns: '3.5rem minmax(0, 1fr)' }}>
                  {gutter}
                  {dayColumn(anchor, dayLayout)}
                </div>
              </div>
              <p className="mt-3 text-xs text-faint">
                One day on a clock. Drag a post onto the day to move it here (time stays the same).
                Click a post to retime it.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {MONTHS.map((name, m) => (
                  <div key={name} className="rounded-2xl border border-line bg-card p-4">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/calendar-month?d=${anchor.getFullYear()}-${String(m + 1).padStart(2, '0')}-01`,
                        )
                      }
                      className="text-sm font-extrabold transition hover:underline"
                    >
                      {name}
                    </button>
                    <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <span key={`${d}${i}`} className="text-[9px] font-bold text-faint">
                          {d}
                        </span>
                      ))}
                      {monthMatrix(new Date(anchor.getFullYear(), m, 1))
                        .flat()
                        .map((d) => {
                          const k = dayKey(d);
                          const inMonth = d.getMonth() === m;
                          const has = (byDay.get(k) ?? []).length > 0;
                          const isT = k === todayKey;
                          return (
                            <span
                              key={k}
                              className={`flex flex-col items-center py-0.5 text-[11px] ${
                                inMonth ? 'text-soft' : 'text-faint opacity-40'
                              } ${isT ? 'font-extrabold text-ink' : ''}`}
                            >
                              {d.getDate()}
                              <span
                                className={`mt-0.5 h-1 w-1 rounded-full ${has ? 'bg-accent' : 'bg-transparent'}`}
                              />
                            </span>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-faint">
                The whole year at a glance — dots mark days with posts. Pick a month to open it.
              </p>
            </>
          )}
        </div>

        <aside className="w-full shrink-0 border-t border-line bg-card p-5 xl:w-80 xl:border-l xl:border-t-0">
          {selectedPost ? (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="eyebrow">
                  Selected post
                  {partCount(selectedPost) > 1 ? ` · thread of ${partCount(selectedPost)}` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedPostId(null)}
                  aria-label="Close editor"
                  className="text-xs font-bold text-muted transition hover:text-ink"
                >
                  ✕
                </button>
              </div>
              {partCount(selectedPost) > 1 ? (
                <p className="mb-2 text-xs text-muted">
                  Retiming or deleting applies to the whole thread.
                </p>
              ) : null}
              <TimeEditor
                key={selectedPost.id}
                post={selectedPost}
                dayLabel={selectedKey}
                avatarOf={avatarOf}
                onSave={(iso) => void retime(selectedPost.id, iso)}
                onSaveChannels={(times) => void persistChannels(times)}
                onPublish={() => void publishNow()}
                onDelete={() => void remove()}
                busy={pending}
              />
            </div>
          ) : null}

          {undated.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-2">Drafts · no date</p>
              <div className="space-y-1.5">
              {undated.slice(0, 6).map((p) => (
                <div key={p.id} className="truncate rounded-lg bg-bone px-2.5 py-1.5 text-xs text-soft">
                  {snippet(p)}
                  {partCount(p) > 1 ? ` · thread of ${partCount(p)}` : ''}
                </div>
              ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Link href="/post" className="btn btn-bolt w-full">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New post
            </Link>
            {pending && <p className="text-center text-xs text-muted">Saving…</p>}
            {channels.length === 0 && (
              <p className="text-center text-xs text-muted">
                No channels connected yet. Connect one in the app.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
