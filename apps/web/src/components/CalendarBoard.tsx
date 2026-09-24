'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import type { PostWithTargets } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { deletePost, publishPostNow, rescheduleChannels, reschedulePost } from '@/lib/posts';
import { MONTHS, WEEKDAYS, addDays, addMonths, dayKey, formatTime, isSameDay, monthMatrix, moveToDay } from '@/lib/format';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 68 ? `${text.slice(0, 68)}…` : text;
}

function ChannelDots({ post }: { post: PostWithTargets }) {
  const providers = Array.from(new Set(post.post_targets.map((t) => t.provider)));
  return (
    <span className="flex items-center gap-1">
      {providers.slice(0, 4).map((p) => {
        const meta = providerMeta(p);
        return (
          <span
            key={p}
            title={meta.label}
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: meta.color }}
          />
        );
      })}
    </span>
  );
}

/** 24h lane height in px — the now-line and auto-scroll both derive from it. */
const LANE_H = 56;
/** Denser lanes for the 7-column week grid. */
const WEEK_LANE_H = 44;

const hourLabel = (h: number): string => `${String(h).padStart(2, '0')}:00`;

/** Local wall-clock parts of an ISO instant. */
function partsOf(iso: string | null): { h: number; m: number } {
  const d = iso ? new Date(iso) : new Date();
  return { h: d.getHours(), m: d.getMinutes() };
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
  onSave,
  onSaveChannels,
  onPublish,
  onDelete,
  busy,
}: {
  post: PostWithTargets;
  dayLabel: string;
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
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                    title={meta.label}
                  />
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

export default function CalendarBoard({ posts, channels }: { posts: PostWithTargets[]; channels: number }) {
  const router = useRouter();
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [overHour, setOverHour] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  /** Pointer Y during a week-grid drag, for slot-accurate drops on the card. */
  const colY = useRef(0);

  const byDay = useMemo(() => {
    const m = new Map<string, PostWithTargets[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = dayKey(new Date(p.scheduled_at));
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
    }
    return m;
  }, [posts]);

  const undated = useMemo(() => posts.filter((p) => !p.scheduled_at), [posts]);
  const weeks = useMemo(() => monthMatrix(anchor), [anchor]);
  const dayPosts = byDay.get(selectedKey) ?? [];
  const selectedPost = dayPosts.find((p) => p.id === selectedPostId) ?? null;
  const today = new Date();
  const isToday = selectedKey === dayKey(today);

  const hourBuckets = useMemo(() => {
    const buckets: PostWithTargets[][] = Array.from({ length: 24 }, () => []);
    for (const p of dayPosts) {
      if (!p.scheduled_at) continue;
      buckets[new Date(p.scheduled_at).getHours()].push(p);
    }
    return buckets;
  }, [dayPosts]);

  const nowTop = isToday ? ((today.getHours() * 60 + today.getMinutes()) / 60) * LANE_H : null;

  // Monday-first week containing the anchor.
  const weekDays = useMemo(() => {
    const offset = (anchor.getDay() + 6) % 7;
    const start = addDays(anchor, -offset);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  /** Greedy overlap lanes per day so concurrent posts sit side by side. */
  const weekLayout = useMemo(() => {
    const laid = new Map<string, { p: PostWithTargets; top: number; lane: number; lanes: number }[]>();
    for (const day of weekDays) {
      const list = [...(byDay.get(dayKey(day)) ?? [])].sort((a, b) =>
        (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''),
      );
      const laneEnds: number[] = [];
      const out: { p: PostWithTargets; top: number; lane: number; lanes: number }[] = [];
      for (const p of list) {
        if (!p.scheduled_at) continue;
        const t = new Date(p.scheduled_at);
        const mins = t.getHours() * 60 + t.getMinutes();
        let lane = laneEnds.findIndex((end) => end <= mins);
        if (lane < 0) {
          lane = laneEnds.length;
          laneEnds.push(0);
        }
        laneEnds[lane] = mins + 30;
        out.push({ p, top: (mins / 60) * WEEK_LANE_H, lane, lanes: 0 });
      }
      const lanes = Math.max(1, laneEnds.length);
      laid.set(
        dayKey(day),
        out.map((o) => ({ ...o, lanes })),
      );
    }
    return laid;
  }, [byDay, weekDays]);

  // Jump the day view to the action: now, else the first post, else morning.
  useEffect(() => {
    if (view !== 'day') return;
    const el = dayScrollRef.current;
    if (!el) return;
    const firstHour = dayPosts.length ? new Date(dayPosts[0].scheduled_at!).getHours() : 7;
    const target = isToday ? today.getHours() : Math.min(firstHour, 7);
    el.scrollTop = Math.max(0, target * LANE_H - 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedKey]);

  // Week view opens around morning.
  useEffect(() => {
    if (view !== 'week') return;
    const el = weekScrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, 7 * WEEK_LANE_H - 80);
  }, [view, anchor]);

  async function persist(id: string, iso: string) {
    setErr(null);
    try {
      const sb = createClient();
      await reschedulePost(sb, id, iso);
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
    setErr(null);
    try {
      const sb = createClient();
      await deletePost(sb, selectedPostId);
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
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    await persist(id, moveToDay(post.scheduled_at, target));
    setSelectedKey(dayKey(target));
  }

  /** Drop onto an hour lane: same day, snapped to the half hour. */
  async function dropOnHour(h: number, dayKeyStr = selectedKey, minutes = null as number | null) {
    const id = dragId;
    setDragId(null);
    setOverHour(null);
    if (!id) return;
    const post = posts.find((p) => p.id === id);
    if (!post?.scheduled_at) return;
    const m = minutes ?? (new Date(post.scheduled_at).getMinutes() < 30 ? 0 : 30);
    const [y, mo, d] = dayKeyStr.split('-').map(Number);
    await persist(id, new Date(y, mo - 1, d, h, m, 0, 0).toISOString());
  }

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const title =
    view === 'month'
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === 'week'
        ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : new Date(`${selectedKey}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });

  const stepPrev = () => {
    if (view === 'month') setAnchor(addMonths(anchor, -1));
    else if (view === 'week') setAnchor(addDays(anchor, -7));
    else setSelectedKey(dayKey(addDays(new Date(`${selectedKey}T00:00:00`), -1)));
  };
  const stepNext = () => {
    if (view === 'month') setAnchor(addMonths(anchor, 1));
    else if (view === 'week') setAnchor(addDays(anchor, 7));
    else setSelectedKey(dayKey(addDays(new Date(`${selectedKey}T00:00:00`), 1)));
  };
  const stepToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelectedKey(dayKey(now));
  };

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
              const next = v as 'month' | 'week' | 'day';
              // Keep the week glued to the selected day when switching to it.
              if (next === 'week') setAnchor(new Date(`${selectedKey}T00:00:00`));
              setView(next);
            }}
          >
            <TabsList aria-label="Calendar view">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={stepPrev} aria-label={view === 'month' ? 'Previous month' : 'Previous day'}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={stepToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={stepNext} aria-label={view === 'month' ? 'Next month' : 'Next day'}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
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
                            isDayToday ? 'bg-accent text-white' : 'text-muted'
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
                              <ChannelDots post={p} />
                            </div>
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
              <div
                ref={weekScrollRef}
                className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-card"
              >
                <div className="sticky top-0 z-10 flex border-b border-line bg-card">
                  <div className="w-14 shrink-0" />
                  {weekDays.map((d) => {
                    const k = dayKey(d);
                    const isT = isSameDay(d, today);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSelectedKey(k);
                          setSelectedPostId(null);
                        }}
                        className={`min-w-0 flex-1 px-1 py-2 text-center transition hover:bg-paper ${
                          selectedKey === k ? 'bg-paper' : ''
                        }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <span
                          className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isT ? 'bg-accent text-white' : 'text-ink'
                          }`}
                        >
                          {d.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative flex" style={{ height: 24 * WEEK_LANE_H }} data-week-grid>
                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    {Array.from({ length: 25 }, (_, h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-line-soft"
                        style={{ top: h * WEEK_LANE_H }}
                      />
                    ))}
                  </div>
                  <div className="w-14 shrink-0">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex justify-end px-2" style={{ height: WEEK_LANE_H }}>
                        <span className="-mt-2 text-[10px] font-bold tabular-nums text-faint">
                          {hourLabel(h)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {weekDays.map((d) => {
                    const k = dayKey(d);
                    const items = weekLayout.get(k) ?? [];
                    const isOver = overKey === k;
                    const showNow = k === dayKey(today);
                    const nowMinutes = today.getHours() * 60 + today.getMinutes();
                    /** Day-level dragover: highlight and remember pointer Y for slot math. */
                    const onColDragOver = (e: React.DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (overKey !== k) setOverKey(k);
                      colY.current = e.clientY;
                    };
                    return (
                      <div
                        key={k}
                        onDragOver={onColDragOver}
                        onDragLeave={() => setOverKey((v) => (v === k ? null : v))}
                        onDrop={(e) => {
                          e.preventDefault();
                          void dropOn(d);
                        }}
                        onClick={() => {
                          setSelectedKey(k);
                          setSelectedPostId(null);
                        }}
                        className={`relative min-w-0 flex-1 border-l border-line-soft transition ${
                          isOver ? 'bg-accent-soft' : ''
                        } ${selectedKey === k ? 'bg-paper/60' : ''}`}
                      >
                        {showNow && (
                          <div
                            className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-[#E60023]"
                            style={{ top: (nowMinutes / 60) * WEEK_LANE_H }}
                            aria-hidden="true"
                          />
                        )}
                        {items.map(({ p, top, lane, lanes }) => (
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
                            onDrop={(e) => {
                              // Card-level drop: retime to the pointer's half-hour slot.
                              e.preventDefault();
                              e.stopPropagation();
                              const grid = e.currentTarget.closest('[data-week-grid]') as HTMLElement | null;
                              const col = e.currentTarget.parentElement as HTMLElement;
                              if (grid && col) {
                                const gy = grid.getBoundingClientRect().top;
                                const minutes = Math.round(
                                  (((colY.current - gy) / WEEK_LANE_H) * 2) / 2,
                                ) * 30;
                                const h = Math.max(0, Math.min(23, Math.floor(minutes / 60)));
                                const m = minutes % 60;
                                void dropOnHour(h, k, m);
                                return;
                              }
                              void dropOn(d);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKey(k);
                              setSelectedPostId(p.id);
                            }}
                            title={`${formatTime(p.scheduled_at)} · ${snippet(p)}`}
                            className={`absolute cursor-grab overflow-hidden rounded-lg border border-line bg-paper px-1.5 py-1 text-[11px] leading-tight ${
                              dragId === p.id ? 'opacity-50' : ''
                            } ${selectedPostId === p.id ? 'ring-1 ring-accent' : ''}`}
                            style={{
                              top,
                              height: 38,
                              left: `calc(${(lane / lanes) * 100}% + 3px)`,
                              width: `calc(${100 / lanes}% - 6px)`,
                            }}
                          >
                            <p className="truncate font-bold tabular-nums text-ink">
                              {formatTime(p.scheduled_at)}
                            </p>
                            <p className="truncate text-soft">{snippet(p)}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-3 text-xs text-faint">
                Drag a post onto another day to move it. Click a post to retime it exactly.
              </p>
            </>
          ) : (
            <>
              <div
                ref={dayScrollRef}
                className="max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-card"
              >
                <div className="relative">
                  {Array.from({ length: 24 }, (_, h) => {
                    const items = hourBuckets[h];
                    const isOver = overHour === h;
                    return (
                      <div
                        key={h}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overHour !== h) setOverHour(h);
                        }}
                        onDragLeave={() => setOverHour((v) => (v === h ? null : v))}
                        onDrop={(e) => {
                          e.preventDefault();
                          void dropOnHour(h);
                        }}
                        onClick={() => setSelectedPostId(null)}
                        className={`flex border-b border-line-soft last:border-b-0 transition ${
                          isOver ? 'bg-accent-soft' : ''
                        }`}
                        style={{ minHeight: LANE_H }}
                      >
                        <div className="flex w-16 shrink-0 items-start justify-end px-2 py-1.5">
                          <span className="text-[11px] font-bold tabular-nums text-faint">{hourLabel(h)}</span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1 border-l border-line-soft px-2 py-1.5">
                          {items.map((p) => (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDragId(p.id);
                              }}
                              onDragEnd={() => {
                                setDragId(null);
                                setOverHour(null);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPostId(p.id);
                              }}
                              title={snippet(p)}
                              className={`flex cursor-grab items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs transition ${
                                dragId === p.id ? 'opacity-50' : ''
                              } ${selectedPostId === p.id ? 'ring-1 ring-accent' : ''}`}
                            >
                              <span className="shrink-0 font-bold tabular-nums text-ink">
                                {formatTime(p.scheduled_at)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-soft">{snippet(p)}</span>
                              <ChannelDots post={p} />
                            </div>
                          ))}
                          {items.length === 0 && (
                            <p className="py-1 text-[11px] text-faint/60">—</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {nowTop !== null && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                      style={{ top: nowTop }}
                      aria-hidden="true"
                    >
                      <span className="ml-14 h-[2px] flex-1 rounded bg-[#E60023]" />
                      <span className="-ml-1 h-2 w-2 rounded-full bg-[#E60023]" />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Drag a post onto another hour to retime it. Click a post to set an exact time.
              </p>
            </>
          )}
        </div>

        <aside className="w-full shrink-0 border-t border-line bg-card p-5 xl:w-80 xl:border-l xl:border-t-0">
          <Card className="!border-0 !bg-transparent">
            <p className="eyebrow mb-1">{view === 'day' ? 'Posting times' : 'Selected day'}</p>
            <h2 className="font-display text-base font-extrabold">
              {new Date(`${selectedKey}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h2>

            <div className="mt-4 space-y-2">
              {selectedPost ? (
                <TimeEditor
                  key={selectedPost.id}
                  post={selectedPost}
                  dayLabel={selectedKey}
                  onSave={(iso) => void persist(selectedPost.id, iso)}
                  onSaveChannels={(times) => void persistChannels(times)}
                  onPublish={() => void publishNow()}
                  onDelete={() => void remove()}
                  busy={pending}
                />
              ) : dayPosts.length === 0 ? (
                <p className="text-sm text-muted">Nothing scheduled.</p>
              ) : (
                dayPosts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPostId(p.id)}
                    className="block w-full rounded-xl border border-line bg-paper p-3 text-left transition hover:border-ink/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{formatTime(p.scheduled_at)}</span>
                      <ChannelDots post={p} />
                    </div>
                    <p className="mt-1 text-sm text-ink">{snippet(p)}</p>
                  </button>
                ))
              )}
            </div>
          </Card>

          {undated.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-2">Drafts · no date</p>
              <div className="space-y-1.5">
                {undated.slice(0, 6).map((p) => (
                  <div key={p.id} className="truncate rounded-lg bg-bone px-2.5 py-1.5 text-xs text-soft">
                    {snippet(p)}
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
            {channels === 0 && (
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
