'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PostWithTargets } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { reschedulePost } from '@/lib/posts';
import { MONTHS, WEEKDAYS, addMonths, dayKey, formatTime, isSameDay, monthMatrix, moveToDay } from '@/lib/format';
import { providerMeta } from '@/lib/providers';

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

export default function CalendarBoard({ posts, channels }: { posts: PostWithTargets[]; channels: number }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
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
  const selectedPosts = byDay.get(selectedKey) ?? [];
  const today = new Date();

  async function dropOn(target: Date) {
    const id = dragId;
    setDragId(null);
    setOverKey(null);
    if (!id) return;
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const iso = moveToDay(post.scheduled_at, target);
    setErr(null);
    try {
      const sb = createClient();
      await reschedulePost(sb, post.id, iso);
      startTransition(() => router.refresh());
      setSelectedKey(dayKey(target));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reschedule that post.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            {MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setAnchor(addMonths(anchor, -1))} type="button">
            ←
          </button>
          <button className="btn btn-ghost" onClick={() => setAnchor(new Date())} type="button">
            Today
          </button>
          <button className="btn btn-ghost" onClick={() => setAnchor(addMonths(anchor, 1))} type="button">
            →
          </button>
        </div>
      </header>

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex flex-1 flex-col xl:flex-row">
        <div className="min-w-0 flex-1 p-4">
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
              const isToday = isSameDay(day, today);
              const isOver = overKey === k;
              return (
                <div
                  key={k}
                  onClick={() => setSelectedKey(k)}
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
                        isToday ? 'bg-accent text-white' : 'text-muted'
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
                        title={snippet(p)}
                        className={`cursor-grab rounded-lg border border-line bg-paper px-1.5 py-1 text-[11px] leading-tight ${
                          dragId === p.id ? 'opacity-50' : ''
                        }`}
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
            Drag a post onto another day to reschedule it. Times stay the same.
          </p>
        </div>

        <aside className="w-full shrink-0 border-t border-line bg-card p-5 xl:w-80 xl:border-l xl:border-t-0">
          <p className="eyebrow mb-1">Selected day</p>
          <h2 className="font-display text-base font-extrabold">
            {new Date(`${selectedKey}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h2>

          <div className="mt-4 space-y-2">
            {selectedPosts.length === 0 && <p className="text-sm text-muted">Nothing scheduled.</p>}
            {selectedPosts.map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-paper p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">{formatTime(p.scheduled_at)}</span>
                  <ChannelDots post={p} />
                </div>
                <p className="mt-1 text-sm text-ink">{snippet(p)}</p>
              </div>
            ))}
          </div>

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
              + New post
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
