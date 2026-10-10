'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
// Global Temporal (same identity Schedule-X validates against — never the
// named import, which can be a different class object than the global).
import 'temporal-polyfill/global';
import {
  viewDay,
  viewMonthGrid,
  viewWeek,
  type CalendarEvent,
} from '@schedule-x/calendar';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
import type { ConnectedChannel, MediaAssetRow, PostWithTargets } from '@/lib/types';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import { deletePost, publishPostNow, rescheduleChannels, reschedulePost } from '@/lib/posts';
import { chainPartsByChain, isChainHead, threadCount } from '@/lib/chains';
import { leadTimeMessage, queueTooSoon } from '@/lib/queue';
import {
  MONTHS,
  addDays,
  addMonths,
  dayKey,
  formatTime,
  monthMatrix,
} from '@/lib/format';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 68 ? `${text.slice(0, 68)}…` : text;
}

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

/** Post status → Schedule-X calendar id (drives the default chrome + colors). */
function statusCalendar(status: string): string {
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  if (status === 'draft') return 'draft';
  return 'queued';
}

const SX_CALENDARS = {
  draft: {
    colorName: 'draft',
    lightColors: { main: '#9A958B', container: '#F1EFE9', onContainer: '#57534E' },
    darkColors: { main: '#A8A29E', container: '#292524', onContainer: '#E7E5E4' },
  },
  queued: {
    colorName: 'queued',
    lightColors: { main: '#B45309', container: '#FDF3D7', onContainer: '#92400E' },
    darkColors: { main: '#F2A400', container: '#3A2E12', onContainer: '#FDE9C0' },
  },
  sent: {
    colorName: 'sent',
    lightColors: { main: '#12914A', container: '#DFF2E6', onContainer: '#0C6B36' },
    darkColors: { main: '#34C77B', container: '#0F2E1D', onContainer: '#B9EACD' },
  },
  failed: {
    colorName: 'failed',
    lightColors: { main: '#E5484D', container: '#FBE3E3', onContainer: '#9F2F2D' },
    darkColors: { main: '#F0666A', container: '#3A1A1A', onContainer: '#F5C1C1' },
  },
};

/** Schedule-X event with our card fields embedded (custom components read them). */
export type SXEvent = CalendarEvent & {
  sxProvider?: string;
  sxAvatar?: string;
  sxLabel?: string;
  sxName?: string;
  sxHandle?: string | null;
  sxStatusLabel?: string;
  sxStatusClass?: string;
  sxTime?: string;
  sxThread?: number | null;
  sxStatus?: string;
  sxThumbs?: { id: string; src: string }[];
  sxTintBg?: string;
  sxTintBorder?: string;
};

/** Dropped event start → UTC ISO for our reschedule pipeline. */
function sxStartToISO(
  start: Temporal.ZonedDateTime | Temporal.PlainDate,
  timeZone: string,
): string | null {
  try {
    if (start instanceof Temporal.ZonedDateTime) {
      return new Date(start.epochMilliseconds).toISOString();
    }
    const pdt = start as unknown as Temporal.PlainDateTime;
    if (typeof pdt.hour === 'number') {
      return new Date(pdt.toZonedDateTime(timeZone).epochMilliseconds).toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

/** Live clock label from a Schedule-X event start (updates mid-drag,
 *  unlike the snapshot time stored at mapping). */
function sxClockLabel(start: unknown, fallback?: string): string {
  try {
    const z = start as unknown as { hour?: unknown; minute?: unknown };
    if (typeof z?.hour === 'number') {
      const h24 = z.hour;
      const m = typeof z.minute === 'number' ? z.minute : 0;
      const ap = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
    }
  } catch {
    /* fall through */
  }
  return fallback ?? '';
}

/** Custom time-grid event: mini post card (author · handle · time, text, media). */
function SXTimeCard({ calendarEvent }: { calendarEvent: SXEvent }) {
  const c = calendarEvent ?? {};
  const time = sxClockLabel(c.start, c.sxTime);
  return (
    <div
      className="h-full overflow-hidden rounded-lg border p-1.5"
      style={{ background: c.sxTintBg ?? '#F1F5F9', borderColor: c.sxTintBorder ?? '#E2E8F0' }}
    >
      <div className="flex items-center gap-1.5">
        {c.sxProvider ? <ChannelAvatar provider={c.sxProvider} avatar={c.sxAvatar} size={22} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-extrabold" style={{ color: '#1F2937' }}>
            {c.sxName ?? c.sxLabel ?? c.title ?? 'Post'}
          </span>
          <span className="block truncate text-[10px]" style={{ color: '#6B7280' }}>
            {c.sxHandle ? `${c.sxHandle} · ` : ''}
            {time}
            {c.sxThread ? ` · Thread ${c.sxThread}` : ''}
          </span>
        </span>
        {c.sxStatusLabel ? (
          <span className={`pill shrink-0 ${c.sxStatusClass ?? ''}`} style={{ fontSize: 9 }}>
            {c.sxStatusLabel}
          </span>
        ) : null}
      </div>
      {c.title ? (
        <div className="mt-1 line-clamp-2 text-[11px] leading-snug" style={{ color: '#33302A' }}>
          {c.title}
        </div>
      ) : null}
      {Array.isArray(c.sxThumbs) && c.sxThumbs.length > 0 ? (
        <div className="mt-1 flex gap-1">
          {c.sxThumbs.slice(0, 3).map((t) => (
            <img
              key={t.id}
              src={t.src}
              alt=""
              className="h-12 w-12 rounded-lg border border-black/5 object-cover"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Custom month-grid event: compact one-line chip. */
function SXMonthChip({ calendarEvent }: { calendarEvent: SXEvent }) {
  const c = calendarEvent ?? {};
  return (
    <div
      className="flex items-center gap-1 truncate rounded-md px-1 py-px"
      style={{ background: c.sxTintBg ?? '#F1F5F9', border: `1px solid ${c.sxTintBorder ?? '#E2E8F0'}` }}
      title={c.title}
    >
      <span className="shrink-0 text-[10px] font-bold" style={{ color: '#1F2937' }}>
        {sxClockLabel(c.start, c.sxTime)}
      </span>
      <span className="truncate text-[11px]" style={{ color: '#4B5563' }}>
        {c.title ?? ''}
      </span>
    </div>
  );
}

const SX_CUSTOM_COMPONENTS = {
  timeGridEvent: SXTimeCard,
  monthGridEvent: SXMonthChip,
};

const SX_VIEWS = {
  day: viewDay,
  week: viewWeek,
  month: viewMonthGrid,
} as const;

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

type BoardView = 'day' | 'week' | 'month' | 'year';

/** Schedule-X mount: creates the calendar once, then syncs events + date via plugins. */
function SXMount({
  view,
  anchorKey,
  events,
  dark,
  timeZone,
  notify,
  resolveDrop,
  onSelectPost,
  persistDrop,
}: {
  view: 'day' | 'week' | 'month';
  anchorKey: string;
  events: SXEvent[];
  dark: boolean;
  timeZone: string;
  notify: (msg: string) => void;
  resolveDrop: (ev: CalendarEvent) => string | null;
  onSelectPost: (postId: string, start: Temporal.ZonedDateTime | Temporal.PlainDateTime | Temporal.PlainDate) => void;
  persistDrop: (postId: string, iso: string) => void;
}) {
  const [eventsService] = useState(() => createEventsServicePlugin());
  const [controls] = useState(() => createCalendarControlsPlugin());
  const [dnd] = useState(() => createDragAndDropPlugin(15));
  const viewObj = SX_VIEWS[view];

  const calendar = useNextCalendarApp(
    {
      views: [viewObj],
      defaultView: viewObj.name,
      selectedDate: Temporal.PlainDate.from(anchorKey),
      locale: 'en-US',
      // Monday-first week (matches the rest of the app).
      firstDayOfWeek: 1 as never,
      timezone: timeZone,
      calendars: SX_CALENDARS,
      events,
      monthGridOptions: { nEventsPerDay: 3 },
      isDark: dark,
      callbacks: {
        // Always render full event cards — never the small-screen dot mode.
        isCalendarSmall: () => false,
        onEventClick: (ev) => {
          onSelectPost(String(ev.id), ev.start);
        },
        onBeforeEventUpdate: (_oldEv, newEv) => {
          const iso = resolveDrop(newEv);
          if (!iso) return false;
          if (queueTooSoon(iso)) {
            notify(leadTimeMessage());
            return false;
          }
          return true;
        },
        onEventUpdate: (ev) => {
          const iso = resolveDrop(ev);
          if (iso) persistDrop(String(ev.id), iso);
        },
      },
    },
    [eventsService, controls, dnd],
  );

  // Push fresh server data into the calendar (retime/publish/delete → refresh).
  useEffect(() => {
    if (calendar) eventsService.set(events);
  }, [calendar, events, eventsService]);

  // Follow our header steppers.
  useEffect(() => {
    if (calendar) controls.setDate(Temporal.PlainDate.from(anchorKey));
  }, [calendar, anchorKey, controls]);

  if (!calendar) {
    return <div className="h-full min-h-[480px] animate-pulse rounded-2xl bg-paper-dim" />;
  }
  return <ScheduleXCalendar calendarApp={calendar} customComponents={SX_CUSTOM_COMPONENTS} />;
}

export default function ScheduleXBoard({
  posts,
  channels,
  initialView = 'week',
  initialAnchor,
  media = {},
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  /** View from the route path (/calendar-month → month). The URL is the source of truth. */
  initialView?: BoardView;
  /** Day-key (YYYY-MM-DD) the calendar opens on — carried in ?d= across view switches. */
  initialAnchor?: string;
  /** Signed media per post id, for the thumbnail row on schedule cards. */
  media?: Record<string, MediaAssetRow[]>;
}) {
  const router = useRouter();
  const [view] = useState<BoardView>(initialView);
  const [anchor, setAnchor] = useState(() => {
    if (initialAnchor) {
      const [y, m, d] = initialAnchor.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Schedule-X renders client-side only (local timezone + Temporal).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Dark mode follows the ThemeScope root: class mutations plus the
  // 'sosial-theme' broadcast the toggle emits. The calendar remounts on change.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.querySelector('[data-theme-root]');
    const sync = () => setDark(!!root?.classList.contains('theme-dark'));
    sync();
    const mo = new MutationObserver(sync);
    if (root) mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('sosial-theme', sync);
    return () => {
      mo.disconnect();
      window.removeEventListener('sosial-theme', sync);
    };
  }, []);

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  /** Avatar per channel for the identity tiles (brand disc fallback). */
  const avatarByChannel = useMemo(
    () => new Map(channels.map((c) => [c.id, channelAvatar(c.metadata)])),
    [channels],
  );
  const avatarOf = (channelId: string): string | undefined => avatarByChannel.get(channelId);
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  /** Real handle only — never numeric ids, URLs or site names. */
  const cleanHandle = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const t = raw.trim().replace(/^@+/, '');
    if (!t || t.includes('://') || /[:\s/\\]/.test(t)) return null;
    if (/^\d+$/.test(t)) return null;
    if (t.length > 64) return null;
    return `@${t}`;
  };

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

  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;

  /** Posts → Schedule-X events (chain heads with a time; 60-min display block). */
  const sxEvents = useMemo<SXEvent[]>(() => {
    const out: SXEvent[] = [];
    for (const p of posts) {
      if (!p.scheduled_at || !isHead(p)) continue;
      const d = new Date(p.scheduled_at);
      // Timed events must be ZonedDateTime (PlainDate is all-day-only).
      const start = Temporal.PlainDateTime.from({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
      }).toZonedDateTime(timeZone);
      const t0 = p.post_targets[0];
      const tint = tintOf(t0?.provider);
      const ch = t0 ? channelById.get(t0.channel_id) : undefined;
      const st = POST_STATUS_META[p.status];
      const thumbs = (media[p.id] ?? [])
        .slice(0, 4)
        .map((m) => ({
          id: m.id,
          src:
            m.kind === 'image' && m.signed_url
              ? imageThumb(m.signed_url, THUMB_WIDTHS.xs)
              : (m.thumb_url ?? m.signed_url ?? ''),
        }))
        .filter((t): t is { id: string; src: string } => Boolean(t.src));
      out.push({
        id: p.id,
        title: snippet(p),
        start,
        end: start.add({ minutes: 120 }),
        calendarId: statusCalendar(p.status),
        sxProvider: t0?.provider,
        sxAvatar: t0 ? avatarOf(t0.channel_id) : undefined,
        sxLabel: t0 ? `${providerMeta(t0.provider).label} Post` : 'Post',
        sxName: ch?.display_name?.trim() || (t0 ? providerMeta(t0.provider).label : 'Post'),
        sxHandle: cleanHandle(ch?.handle),
        sxStatusLabel: st.label,
        sxStatusClass: st.className,
        sxTime: formatTime(p.scheduled_at),
        sxThread: partCount(p) > 1 ? partCount(p) : null,
        sxStatus: p.status,
        sxThumbs: thumbs,
        sxTintBg: tint.bg,
        sxTintBorder: tint.border,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, media, chainParts, avatarByChannel, channelById, timeZone]);

  // Fresh server data for the drop pipeline (calendar callbacks are created once).
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  });

  /** Persist a drag-and-drop move: shift the whole chain by the same delta. */
  const persistDrop = useCallback(
    async (pid: string, iso: string) => {
      const list = postsRef.current;
      const post = list.find((p) => p.id === pid);
      if (!post) return;
      const parts = post.chain_id ? list.filter((p) => p.chain_id === post.chain_id) : [post];
      const head = parts.find((p) => p.id === pid) ?? parts[0];
      if (!head) return;
      const delta = new Date(iso).getTime() - new Date(head.scheduled_at ?? iso).getTime();
      if (delta === 0) return;
      const moves = parts.map((part) => ({
        id: part.id,
        iso: new Date(new Date(part.scheduled_at ?? iso).getTime() + delta).toISOString(),
      }));
      setErr(null);
      try {
        const sb = createClient();
        await Promise.all(moves.map((m) => reschedulePost(sb, m.id, m.iso)));
        startTransition(() => router.refresh());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not reschedule that post.');
      }
    },
    [router],
  );

  /** Dropped event → UTC ISO. Timed starts convert directly; all-day
   *  (PlainDate) drops, e.g. month-grid drags, keep the post's wall-clock time.
   *  Stable for the once-created calendar callbacks (reads live data via ref). */
  const resolveDrop = useCallback(
    (ev: CalendarEvent): string | null => {
      const direct = sxStartToISO(ev.start, timeZone);
      if (direct) return direct;
      try {
        const day = (ev.start as unknown as { toString?: () => string })?.toString?.();
        if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
          const post = postsRef.current.find((p) => p.id === String(ev.id));
          if (post?.scheduled_at) {
            const { h, m } = partsOf(post.scheduled_at);
            return isoAt(day, h, m);
          }
        }
      } catch {
        /* fall through */
      }
      return null;
    },
    [timeZone],
  );

  /** Event click → open the popup (uses only stable setters: never stale). */
  const handleSelectPost = useCallback(
    (pid: string, start: Temporal.ZonedDateTime | Temporal.PlainDateTime | Temporal.PlainDate) => {
      setSelectedPostId(pid);
      if (start instanceof Temporal.PlainDateTime) {
        setSelectedKey(start.toPlainDate().toString());
      } else if (start instanceof Temporal.PlainDate) {
        setSelectedKey(start.toString());
      } else {
        setSelectedKey(start.toPlainDate().toString());
      }
    },
    [],
  );

  // Popup open ⇔ an event is selected. Escape closes it.
  useEffect(() => {
    if (!selectedPostId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPostId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPostId]);

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
  const goView = (next: BoardView) => {
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

  const VIEW_TABS: { id: BoardView; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];

  const todayKey = dayKey(new Date());

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
        <div className="flex items-center gap-2">
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
          <Link href="/post" className="btn btn-bolt btn-sm">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New post
          </Link>
        </div>
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

      <div className="min-w-0 flex-1 p-4">
        {view === 'year' ? (
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
        ) : mounted ? (
          <div className={view === 'month' ? 'sx-height-auto' : undefined}>
            <SXMount
              key={dark ? 'dark' : 'light'}
              view={view}
              anchorKey={dayKey(anchor)}
              events={sxEvents}
              dark={dark}
            timeZone={timeZone}
            notify={setErr}
            resolveDrop={resolveDrop}
              onSelectPost={handleSelectPost}
              persistDrop={persistDrop}
            />
          </div>
        ) : (
          <div className="h-full min-h-[480px] animate-pulse rounded-2xl bg-paper-dim" />
        )}
        {view !== 'year' ? (
          <p className="mt-3 text-xs text-faint">
            Drag a post to another slot to reschedule it. Click a post to retime it exactly.
          </p>
        ) : null}
      </div>

      {selectedPost ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Post details"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSelectedPostId(null)}
            className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
          />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow">
                Post · {selectedKey}
                {partCount(selectedPost) > 1 ? ` · thread of ${partCount(selectedPost)}` : ''}
              </p>
              <button
                type="button"
                onClick={() => setSelectedPostId(null)}
                aria-label="Close details"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-muted transition hover:bg-paper-dim hover:text-ink"
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
        </div>
      ) : null}
    </div>
  );
}
