'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
  const [view, setView] = useState<'month' | 'week' | 'line'>('line');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
  /** Monday-first 7-day window containing the anchor (Week view). */
  const weekDays = useMemo(() => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const dayPosts = byDay.get(selectedKey) ?? [];
  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;
  const today = new Date();

  /** Agenda window: 14 days from the anchor, upcoming scheduled posts grouped by day. */
  const agenda = useMemo(() => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const days: { key: string; date: Date; items: PostWithTargets[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(start, i);
      const items = byDay.get(dayKey(d)) ?? [];
      if (items.length) days.push({ key: dayKey(d), date: d, items });
    }
    return days;
  }, [anchor, byDay]);

  const agendaEnd = addDays(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()), 13);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

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

  const title =
    view === 'month'
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === 'week'
        ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : `${anchor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${agendaEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const stepPrev = () => {
    if (view === 'month') setAnchor(addMonths(anchor, -1));
    else if (view === 'week') setAnchor(addDays(anchor, -7));
    else setAnchor(addDays(anchor, -14));
  };
  const stepNext = () => {
    if (view === 'month') setAnchor(addMonths(anchor, 1));
    else if (view === 'week') setAnchor(addDays(anchor, 7));
    else setAnchor(addDays(anchor, 14));
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
              const next = v as 'month' | 'week' | 'line';
              // Keep the agenda glued to the selected day when switching to it.
              if (next === 'line') setAnchor(new Date(`${selectedKey}T00:00:00`));
              setView(next);
            }}
          >
            <TabsList aria-label="Calendar view">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="line">Line</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={stepPrev} aria-label={view === 'month' ? 'Previous month' : view === 'week' ? 'Previous week' : 'Previous 14 days'}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={stepToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={stepNext} aria-label={view === 'month' ? 'Next month' : view === 'week' ? 'Next week' : 'Next 14 days'}>
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
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="bg-card px-2 py-2 text-center text-xs font-bold text-muted">
                    {d}
                  </div>
                ))}
                {weekDays.map((day) => {
                  const k = dayKey(day);
                  const items = byDay.get(k) ?? [];
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
                      className={`flex min-h-[320px] cursor-pointer flex-col bg-card p-2 transition xl:min-h-[420px] ${
                        selectedKey === k ? 'bg-paper' : ''
                      } ${isOver ? 'ring-2 ring-inset ring-accent' : ''}`}
                    >
                      <div className="mb-2 flex items-center justify-between px-0.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            isDayToday ? 'bg-accent text-white' : 'text-muted'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        <span className="text-[10px] font-bold text-faint">
                          {day.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {items.map((p) => (
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
                            className={`cursor-grab rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] leading-tight transition hover:border-ink/30 ${
                              dragId === p.id ? 'opacity-50' : ''
                            } ${selectedPostId === p.id ? 'ring-1 ring-accent' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-ink">{formatTime(p.scheduled_at)}</span>
                              <ChannelDots post={p} />
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-soft">{snippet(p)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-faint">
                The week at a glance — drag a post onto another day to reschedule it, click one to retime it.
              </p>
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {agenda.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    Nothing scheduled in these 14 days.
                  </p>
                ) : (
                  agenda.map((day) => {
                    const isT = day.key === dayKey(today);
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
                          isOver ? 'bg-accent-soft' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 px-4 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedKey(day.key);
                              setSelectedPostId(null);
                            }}
                            aria-label={`Select ${day.key}`}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition hover:ring-2 hover:ring-accent ${
                              isT ? 'bg-accent text-white' : 'bg-paper-dim text-ink'
                            }`}
                          >
                            {day.date.getDate()}
                          </button>
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
                        <div className="space-y-1 px-4 py-2.5">
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
                                onClick={() => {
                                  setSelectedKey(day.key);
                                  setSelectedPostId(p.id);
                                }}
                                title={snippet(p)}
                                className={`flex cursor-grab items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2 transition ${
                                  dragId === p.id ? 'opacity-50' : ''
                                } ${selectedPostId === p.id ? 'ring-1 ring-accent' : ''}`}
                              >
                                <span className="w-14 shrink-0 text-xs font-bold tabular-nums text-ink">
                                  {formatTime(p.scheduled_at)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-soft">
                                  {snippet(p)}
                                </span>
                                <ChannelDots post={p} />
                                <Badge className={`${st.className} hidden shrink-0 sm:inline-flex`}>
                                  {st.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="mt-3 text-xs text-faint">
                Drag a post onto another day to move it. Click a post to retime it exactly.
              </p>
            </>
          )}
        </div>

        <aside className="w-full shrink-0 border-t border-line bg-card p-5 xl:w-80 xl:border-l xl:border-t-0">
          <Card className="!border-0 !bg-transparent">
            <p className="eyebrow mb-1">Selected day</p>
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
