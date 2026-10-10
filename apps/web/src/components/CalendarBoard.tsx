'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { ConnectedChannel, PostWithTargets } from '@/lib/types';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import { deletePost, publishPostNow, rescheduleChannels, reschedulePost } from '@/lib/posts';
import { chainPartsByChain, isChainHead, threadCount } from '@/lib/chains';
import { leadTimeMessage, queueTooSoon } from '@/lib/queue';
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  addMonths,
  dayKey,
  endOfMonth,
  formatTime,
  isSameDay,
  monthMatrix,
  moveToDay,
  startOfMonth,
} from '@/lib/format';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 68 ? `${text.slice(0, 68)}…` : text;
}

/** Status → event dot colour (Notion-style). Hexes hold up in both themes. */
const STATUS_DOT: Record<string, string> = {
  draft: 'bg-[#9A958B]',
  approval: 'bg-[#F2A400]',
  queued: 'bg-[#F2A400]',
  publishing: 'bg-[#F2A400]',
  partial: 'bg-[#F2A400]',
  sent: 'bg-[#12914A]',
  failed: 'bg-[#E5484D]',
};
const dotOf = (status: string): string => STATUS_DOT[status] ?? 'bg-[#9A958B]';

/** Real account avatars with platform logo badges (brand disc fallback). */
function ChannelAvatars({
  post,
  avatarOf,
  size = 18,
}: {
  post: PostWithTargets;
  avatarOf: (channelId: string) => string | undefined;
  size?: number;
}) {
  const targets = post.post_targets.slice(0, 4);
  return (
    <span className="flex shrink-0 items-center" aria-hidden="true">
      {targets.map((t, i) => (
        <span key={t.channel_id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: targets.length - i }}>
          <ChannelAvatar provider={t.provider} avatar={avatarOf(t.channel_id)} size={size} />
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

/** Time editor for the selected post (keyed by post so it resets). */
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
        <span className="font-mono text-xs font-bold tabular-nums text-ink">{formatTime(post.scheduled_at)}</span>
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

type View = 'month' | 'week' | 'line';

export default function CalendarBoard({
  posts,
  channels,
  initialView = 'week',
  variant = 'page',
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  /** View from the route path (/calendar-month → month). The URL is the source of truth. */
  initialView?: View;
  /** 'page' = full /calendar layout with sidebar; 'card' = compact Notion card for the dashboard. */
  variant?: 'page' | 'card';
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(variant === 'card' && initialView === 'week' ? 'month' : initialView);
  const [anchor, setAnchor] = useState(() => new Date());
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

  /** Schedule (list) window: every day of the anchor month that has posts,
   *  newest window matching the Month view. Days without posts are skipped. */
  const scheduleDays = useMemo(() => {
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const days: { key: string; date: Date; items: PostWithTargets[] }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const k = dayKey(d);
      const items = byDay.get(k) ?? [];
      if (items.length) days.push({ key: k, date: new Date(d), items });
    }
    return days;
  }, [anchor, byDay]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

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
    view === 'week'
      ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const stepPrev = () => {
    if (view === 'week') setAnchor(addDays(anchor, -7));
    else setAnchor(addMonths(anchor, -1));
  };
  const stepNext = () => {
    if (view === 'week') setAnchor(addDays(anchor, 7));
    else setAnchor(addMonths(anchor, 1));
  };
  const stepToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelectedKey(dayKey(now));
  };

  /** Open a post for retiming (click on any event). */
  const openPost = (key: string, id: string) => {
    setSelectedKey(key);
    setSelectedPostId(id);
  };

  /* ------------------------------ event chips ------------------------------ */

  /** One-line Notion event chip (month cells). */
  const MonthChip = ({ p, k }: { p: PostWithTargets; k: string }) => (
    <div
      draggable
      onDragStart={() => setDragId(p.id)}
      onDragEnd={() => {
        setDragId(null);
        setOverKey(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        openPost(k, p.id);
      }}
      title={snippet(p)}
      className={`flex cursor-grab items-center gap-1.5 rounded-md bg-paper-dim px-1.5 py-[3px] ring-1 transition ${
        dragId === p.id ? 'opacity-40' : 'hover:ring-line'
      } ${selectedPostId === p.id ? 'ring-accent' : 'ring-transparent'}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotOf(p.status)}`} aria-hidden="true" />
      <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-ink">
        {formatTime(p.scheduled_at)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-soft">{snippet(p)}</span>
      <span className="shrink-0">
        <ChannelAvatars post={p} avatarOf={avatarOf} size={16} />
      </span>
    </div>
  );

  /** Day section + rows for the Schedule (list) view. */
  const scheduleList = (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      {scheduleDays.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">
          Nothing scheduled in {MONTHS[anchor.getMonth()]}.
        </p>
      ) : (
        scheduleDays.map((day) => {
          const isT = day.key === todayKey;
          const isOver = overKey === day.key;
          return (
            <div
              key={day.key}
              onDragOver={(e) => {
                e.preventDefault();
                if (overKey !== day.key) setOverKey(day.key);
              }}
              onDragLeave={() => setOverKey((v) => (v === day.key ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                void dropOn(day.date);
              }}
              className={`border-b border-line-soft transition last:border-b-0 ${
                isOver ? 'bg-accent-soft ring-1 ring-inset ring-accent' : ''
              }`}
            >
              {/* Day header */}
              <div className="flex items-center gap-2 bg-paper-dim px-4 py-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isT ? 'bg-accent text-on-accent' : 'bg-card text-ink'
                  }`}
                >
                  {day.date.getDate()}
                </span>
                <span className="text-sm font-extrabold">
                  {day.date.toLocaleDateString(undefined, { weekday: 'long' })}
                </span>
                <span className="text-xs text-muted">
                  {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="flex-1" />
                <span className="text-[11px] font-bold text-faint">
                  {day.items.length} post{day.items.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Rows: time · event */}
              <div>
                {day.items.map((p) => {
                  const st = POST_STATUS_META[p.status];
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
                      onClick={() => openPost(day.key, p.id)}
                      title={snippet(p)}
                      className={`flex cursor-grab items-center gap-3 border-t border-line-soft px-4 py-2.5 transition hover:bg-paper-dim ${
                        dragId === p.id ? 'opacity-40' : ''
                      } ${selectedPostId === p.id ? 'bg-paper-dim ring-1 ring-inset ring-accent' : ''}`}
                    >
                      <span className="w-16 shrink-0 font-mono text-xs font-bold tabular-nums text-ink">
                        {formatTime(p.scheduled_at)}
                      </span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotOf(p.status)}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm text-soft">{snippet(p)}</span>
                      {partCount(p) > 1 ? (
                        <span className="shrink-0 text-[11px] font-bold text-faint">
                          Thread · {partCount(p)}
                        </span>
                      ) : null}
                      <span className="hidden shrink-0 sm:block">
                        <ChannelAvatars post={p} avatarOf={avatarOf} />
                      </span>
                      <Badge className={`${st.className} hidden shrink-0 sm:inline-flex`}>{st.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  /** Month grid — Notion-style: hairline cells, day number, event chips. */
  const monthGrid = (
    <div className="rounded-xl border border-line">
      <div className="grid grid-cols-7 gap-px bg-line-soft">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px border-t border-line-soft bg-line-soft">
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
              className={`flex min-h-[110px] cursor-pointer flex-col bg-card p-1.5 transition ${
                inMonth ? '' : 'opacity-45'
              } ${selectedKey === k ? 'bg-paper-dim/60' : ''} ${
                isOver ? 'bg-accent-soft ring-1 ring-inset ring-accent' : ''
              }`}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    isDayToday ? 'bg-accent text-on-accent' : 'text-muted'
                  }`}
                >
                  {day.getDate()}
                </span>
                {items.length > 3 && <span className="text-[10px] font-bold text-faint">+{items.length - 3}</span>}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                {items.slice(0, 3).map((p) => (
                  <MonthChip key={p.id} p={p} k={k} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /** Week grid — clock layout, same Notion chips. */
  const weekGrid = (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
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
                  className="flex flex-col items-center gap-0.5 px-1 py-2 transition hover:bg-paper-dim"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-faint">
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isDayToday ? 'bg-accent text-on-accent' : 'text-ink'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          {/* time grid */}
          <div className="grid" style={{ gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))' }}>
            <div className="relative" style={{ height: DAY_H }}>
              {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                <span
                  key={h}
                  className="absolute right-1.5 font-mono text-[10px] font-bold tabular-nums text-faint"
                  style={{ top: h * HOUR_PX - 7 }}
                >
                  {hourLabel(h)}
                </span>
              ))}
            </div>
            {weekDays.map((day, di) => {
              const k = dayKey(day);
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
                  className={`relative cursor-pointer border-l border-line transition ${
                    selectedKey === k ? 'bg-paper-dim/40' : ''
                  } ${isOver ? 'bg-accent-soft' : ''}`}
                  style={{
                    height: DAY_H,
                    backgroundImage:
                      'repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(128,128,128,0.18) 47px, rgba(128,128,128,0.18) 48px)',
                  }}
                >
                  {k === todayKey ? (
                    <div
                      className="absolute left-0 right-0 z-10 border-t-2 border-[#E5484D]"
                      style={{ top: nowTop }}
                    >
                      <span className="absolute -top-[5px] left-0 h-2 w-2 rounded-full bg-[#E5484D]" />
                    </div>
                  ) : null}
                  {weekLayouts[di].map(({ p, top, lane, lanes }) => (
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
                        openPost(k, p.id);
                      }}
                      title={snippet(p)}
                      className={`absolute max-h-[104px] cursor-grab overflow-hidden rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] leading-tight transition hover:border-ink/30 ${
                        dragId === p.id ? 'opacity-40' : ''
                      } ${selectedPostId === p.id ? 'z-20 ring-1 ring-accent' : ''}`}
                      style={{
                        top,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotOf(p.status)}`} aria-hidden="true" />
                          <span className="font-mono text-[10px] font-bold tabular-nums text-ink">
                            {formatTime(p.scheduled_at)}
                          </span>
                        </span>
                        <ChannelAvatars post={p} avatarOf={avatarOf} size={16} />
                      </div>
                      {partCount(p) > 1 ? (
                        <div className="mt-0.5 text-[10px] font-bold text-faint">Thread · {partCount(p)} parts</div>
                      ) : null}
                      <div className="mt-0.5 line-clamp-2 text-soft">{snippet(p)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const body =
    view === 'month' ? monthGrid : view === 'week' ? weekGrid : scheduleList;

  const errToast = err ? (
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
  ) : null;

  const editorPanel = selectedPost ? (
    <div className="border-b border-line bg-card px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow">
          Selected post{partCount(selectedPost) > 1 ? ` · thread of ${partCount(selectedPost)}` : ''}
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
        <p className="mb-2 text-xs text-muted">Retiming or deleting applies to the whole thread.</p>
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
  ) : null;

  /* ------------------------------- card variant ------------------------------- */

  if (variant === 'card') {
    const cardView: View = view === 'week' ? 'month' : view;
    return (
      <>
        {errToast}
        <Card className="overflow-hidden" aria-label="Content calendar">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
            <p className="font-display text-base font-extrabold tracking-tight">Content calendar</p>
            <p className="text-xs text-muted">{title}</p>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={stepPrev}
              aria-label="Previous month"
              className="h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={stepToday} className="h-7 px-2.5 text-xs">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={stepNext} aria-label="Next month" className="h-7 w-7">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Link href="/calendar" className="text-xs font-bold text-ink hover:underline">
              View all
            </Link>
          </div>

          {/* View switch + selected-post editor */}
          <div className="flex items-center gap-3 border-b border-line px-5 py-2.5">
            <Tabs
              value={cardView}
              onValueChange={(v) => setView(v as View)}
            >
              <TabsList aria-label="Calendar view">
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="line">Schedule</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="flex-1" />
            {pending ? <span className="text-xs text-muted">Saving…</span> : null}
          </div>

          {editorPanel}

          {/* Scrollable body */}
          <div className="max-h-[440px] overflow-y-auto p-4">{body}</div>
        </Card>
      </>
    );
  }

  /* ------------------------------- page variant ------------------------------- */

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => {
              const next = v as View;
              if (next === view) return;
              setView(next);
              // Views live at their own URLs — navigate so every view is linkable.
              router.push(
                next === 'month' ? '/calendar-month' : next === 'line' ? '/calendar-line' : '/calendar',
                { scroll: false },
              );
            }}
          >
            <TabsList aria-label="Calendar view">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="line">Schedule</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon"
            onClick={stepPrev}
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={stepToday}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={stepNext}
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {errToast}

      <div className="flex flex-1 flex-col xl:flex-row">
        <div className="min-w-0 flex-1 p-4">
          {body}
          <p className="mt-3 text-xs text-faint">
            {view === 'week'
              ? 'The week on a clock — posts sit at their exact time. Drag a post onto another day to reschedule it (time stays the same). Click a post to retime it.'
              : 'Drag a post onto another day to reschedule it — times stay the same. Click a post to retime it exactly.'}
          </p>
        </div>

        <aside className="w-full shrink-0 border-t border-line bg-card p-5 xl:w-80 xl:border-l xl:border-t-0">
          {editorPanel}

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
