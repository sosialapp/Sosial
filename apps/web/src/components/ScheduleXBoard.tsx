'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeImg from '@/components/SafeImg';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
// Global Temporal (same identity Schedule-X validates against, never the
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
import { createScrollControllerPlugin } from '@schedule-x/scroll-controller';
import type { ConnectedChannel, MediaAssetRow, PostWithTargets } from '@/lib/types';
import ChannelAvatar from '@/components/ChannelAvatar';
import SocialPost from '@/components/SocialPost';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import { deletePost, publishPostNow, rescheduleChannels, reschedulePost } from '@/lib/posts';
import { chainPartsByChain, isChainHead, threadCount } from '@/lib/chains';
import { primaryTarget } from '@/lib/postTargets';
import { queueTooSoon } from '@/lib/queue';
import {
  MONTHS,
  addDays,
  addMonths,
  dayKey,
  formatDateTime,
  formatTime,
  monthMatrix,
} from '@/lib/format';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill, type Locale } from '@/lib/i18n/locales';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SegmentedPills from '@/components/ui/segmented-pills';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 68 ? `${text.slice(0, 68)}…` : text;
}

/** Provider → card edge colour. Cards themselves stay on the neutral surface;
 *  the brand hue is a 3px rail (time grid) or a 6px dot (month chips), which
 *  keeps a busy month readable instead of a wall of pastel blocks. Monochrome
 *  brands point at the ink token so they flip with the theme. */
const EVENT_ACCENT: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#D6249F',
  threads: 'var(--color-ink)',
  tiktok: 'var(--color-ink)',
  x: 'var(--color-ink)',
  bluesky: '#0A7AFF',
  linkedin: '#0A66C2',
  mastodon: '#6364FF',
  pinterest: '#E60023',
  youtube: '#FF0000',
  telegram: '#229ED9',
  discord: '#5865F2',
  wordpress: '#21759B',
  devto: 'var(--color-ink)',
  hashnode: '#2962FF',
  ghost: 'var(--color-ink)',
  vk: '#0077FF',
  gmb: '#4285F4',
};
const accentOf = (provider: string | undefined): string =>
  (provider && EVENT_ACCENT[provider]) || 'var(--color-ink)';

/** Status dot colours for the status filter list. */
const STATUS_DOT: Record<string, string> = {
  draft: 'bg-[#9A958B]',
  approval: 'bg-[#B45309]',
  queued: 'bg-[#B45309]',
  publishing: 'bg-[#B45309]',
  partial: 'bg-[#B45309]',
  sent: 'bg-[#12914A]',
  failed: 'bg-[#E5484D]',
};

const STATUS_OPTIONS = [
  'draft',
  'approval',
  'queued',
  'publishing',
  'sent',
  'partial',
  'failed',
] as const;

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
  sxTime?: string;
  sxThread?: number | null;
  sxStatus?: string;
  sxThumbs?: { id: string; kind: 'video' | 'image'; src: string }[];
  sxAccent?: string;
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

/** Scroll the time grid to just before now on first render (HH:00). */
function initialScrollForNow(): string {
  const h = (new Date().getHours() + 23) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

/** True while today falls inside the viewed span, the hour band only
 *  means "now" then, so the wash stays off elsewhere. */
function todayInView(view: 'day' | 'week' | 'month', anchorKey: string): boolean {
  const today = dayKey(new Date());
  if (view === 'day') return anchorKey === today;
  if (view !== 'week') return false;
  // Monday-first week containing the anchor (matches firstDayOfWeek: 1).
  const [y, m, d] = anchorKey.split('-').map(Number);
  if (!y || !m || !d) return false;
  const a = new Date(y, m - 1, d);
  const mon = new Date(a);
  mon.setDate(a.getDate() - ((a.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return today >= dayKey(mon) && today <= dayKey(sun);
}

/** Event media at its natural ratio: image, or muted preview for video. */
function eventMedia(t: { id: string; kind: string; src: string }, cls: string) {
  const shared = `${cls} rounded-lg border border-black/5 bg-black/5 object-contain`;
  return t.kind === 'video' ? (
    <video key={t.id} src={t.src} muted playsInline preload="metadata" className={shared} />
  ) : (
    <SafeImg key={t.id} src={t.src} alt="" loading="lazy" className={shared} />
  );
}
/** Click fallback: custom cards call this directly so opening never depends
 *  on the library's click pipeline (its 150ms drag threshold swallows taps). */
let sxCardOpen: ((id: string) => void) | null = null;

/** Tap/click detector that ignores real drags (movement threshold), for both
 *  mouse and touch. Fires alongside the library click handler, same id, so
 *  opening twice is a harmless no-op. */
function OpenOnTap({
  id,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { id: string }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const maybeOpen = (x: number, y: number, limit: number) => {
    const s = start.current;
    start.current = null;
    if (!s || !id) return;
    if (Math.hypot(x - s.x, y - s.y) < limit) sxCardOpen?.(id);
  };
  return (
    <div
      {...rest}
      onMouseDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onMouseUp={(e) => maybeOpen(e.clientX, e.clientY, 8)}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        maybeOpen(t ? t.clientX : -999, t ? t.clientY : -999, 12);
      }}
      onClick={() => {
        if (id) sxCardOpen?.(id);
      }}
      onDoubleClick={() => {
        if (id) sxCardOpen?.(id);
      }}
    >
      {children}
    </div>
  );
}

function SXTimeCard({ calendarEvent }: { calendarEvent: SXEvent }) {
  const c = calendarEvent ?? {};
  const t = useT(appMessages);
  const time = sxClockLabel(c.start, c.sxTime);
  const pid = String(c.id ?? '');
  const dot = STATUS_DOT[c.sxStatus ?? ''] ?? 'bg-[#9A958B]';
  return (
    <OpenOnTap
      id={pid}
      className="sx-event-card flex h-full flex-col overflow-hidden rounded-lg border px-2 py-1.5"
      style={{ '--sx-evt-accent': c.sxAccent ?? 'var(--color-ink)' } as CSSProperties}
    >
      <div className="flex items-center gap-1.5">
        {c.sxProvider ? <ChannelAvatar provider={c.sxProvider} avatar={c.sxAvatar} size={16} /> : null}
        <span className="sx-event-sub truncate text-[10px] font-medium tabular-nums">
          {time}
          {c.sxThread ? ` · ${fill(t('sxThreadN'), { n: c.sxThread })}` : ''}
        </span>
        <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      </div>
      {c.title ? (
        <div className="sx-event-text mt-1 line-clamp-2 text-[11.5px] font-medium leading-[1.3]">{c.title}</div>
      ) : null}
      {Array.isArray(c.sxThumbs) && c.sxThumbs.length > 0 ? (
        c.sxThumbs.length === 1 ? (
          <div className="mt-1.5">{eventMedia(c.sxThumbs[0], 'h-auto max-h-[86px] w-full')}</div>
        ) : (
          <div className={`mt-1.5 grid gap-1 ${c.sxThumbs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {c.sxThumbs.slice(0, 3).map((t) => eventMedia(t, 'h-auto max-h-[56px] w-full'))}
          </div>
        )
      ) : null}
    </OpenOnTap>
  );
}

/** Custom month-grid event: dot + time + title, no fill — the grid itself is
 *  already the frame, so a tinted block per post just adds noise. */
function SXMonthChip({ calendarEvent }: { calendarEvent: SXEvent }) {
  const c = calendarEvent ?? {};
  const pid = String(c.id ?? '');
  return (
    <OpenOnTap
      id={pid}
      className="sx-event-card flex h-[22px] w-full min-w-0 items-center gap-1.5 truncate rounded-[6px] px-1.5"
      style={{ '--sx-evt-accent': c.sxAccent ?? 'var(--color-ink)' } as CSSProperties}
      title={c.title}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: 'var(--sx-evt-accent)' }}
        aria-hidden="true"
      />
      <span className="sx-event-title shrink-0 text-[10px] font-medium tabular-nums">
        {sxClockLabel(c.start, c.sxTime)}
      </span>
      <span className="sx-event-text truncate text-[11px] font-medium">{c.title ?? ''}</span>
    </OpenOnTap>
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

/** Translated status pill for a PostStatus, shared by the calendar surfaces. */
function statusMetaOf(status: PostWithTargets['status'], t: (k: string) => string) {
  const meta = POST_STATUS_META[status];
  const key: Record<string, string> = {
    draft: 'stDraft',
    approval: 'stApproval',
    queued: 'stQueued',
    publishing: 'stPublishing',
    sent: 'stSent',
    partial: 'stPartial',
    failed: 'stFailed',
  };
  return { ...meta, label: t(key[status] ?? 'stQueued') };
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
  const t = useT(appMessages);
  const init = partsOf(post.scheduled_at);
  const [hh, setHh] = useState(init.h);
  const [mm, setMm] = useState(init.m);
  const st = statusMetaOf(post.status, t);
  const targets = post.post_targets.filter((t) => t.status === 'queued' || t.status === 'pending');
  // Per-channel times, every channel can publish at its own instant.
  const [times, setTimes] = useState<Record<string, { h: number; m: number }>>(() =>
    Object.fromEntries(targets.map((t) => [t.channel_id, partsOf(t.scheduled_at)])),
  );
  const perChannel = targets.length > 1;
  // Cancelling a scheduled post removes it; drafts/failed posts say Delete.
  const cancellable =
    post.status === 'queued' ||
    post.status === 'publishing' ||
    post.status === 'approval' ||
    post.status === 'partial';

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
        <span className="font-mono text-xs font-medium tabular-nums text-ink">{formatTime(post.scheduled_at)}</span>
        <Badge className={st.className}>{st.label}</Badge>
      </div>

      {perChannel ? (
        <>
          <p className="mt-2 text-xs font-medium text-muted">{t('calTimePerChannel')}</p>
          <div className="mt-1 space-y-1.5">
            {targets.map((tg) => {
              const meta = providerMeta(tg.provider);
              const v = times[tg.channel_id] ?? partsOf(tg.scheduled_at);
              return (
                <div key={tg.channel_id} className="flex items-center gap-2">
                  <ChannelAvatar provider={tg.provider} avatar={avatarOf(tg.channel_id)} size={22} />
                  <span className="w-16 shrink-0 truncate text-[11px] font-medium">{meta.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={v.h}
                    onChange={(e) =>
                      setTimes((prev) => ({
                        ...prev,
                        [tg.channel_id]: { h: Math.max(0, Math.min(23, Number(e.target.value) || 0)), m: v.m },
                      }))
                    }
                    aria-label={fill(t('calHour'), { label: meta.label })}
                    className="field !w-14 !py-1 text-center !text-xs tabular-nums"
                  />
                  <span className="text-xs font-medium text-muted">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={v.m}
                    onChange={(e) =>
                      setTimes((prev) => ({
                        ...prev,
                        [tg.channel_id]: { h: v.h, m: Math.max(0, Math.min(59, Number(e.target.value) || 0)) },
                      }))
                    }
                    aria-label={fill(t('calMinute'), { label: meta.label })}
                    className="field !w-14 !py-1 text-center !text-xs tabular-nums"
                  />
                </div>
              );
            })}
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => savePerChannel()} disabled={busy}>
            {t('calSaveTimes')}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs font-medium text-muted">{t('calMoveTo')}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={23}
              value={hh}
              onChange={(e) => setHh(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
              aria-label={t('calHourAria')}
              className="field !w-16 !py-1.5 text-center !text-xs tabular-nums"
            />
            <span className="font-medium text-muted">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={mm}
              onChange={(e) => setMm(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              aria-label={t('calMinuteAria')}
              className="field !w-16 !py-1.5 text-center !text-xs tabular-nums"
            />
            <span className="flex-1" />
            <Button size="sm" onClick={() => applyAll(hh, mm)} disabled={busy}>
              {t('calSetTime')}
            </Button>
          </div>
        </>
      )}

      <div className="mt-2 flex gap-1.5">
        {post.status !== 'sent' && post.status !== 'partial' ? (
          <Button variant="ghost" size="sm" className="flex-1" onClick={onPublish} disabled={busy}>
            {t('cpPostNow')}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="flex-1 !text-[#9F2F2D]" onClick={onDelete} disabled={busy}>
          {cancellable ? t('calCancelSchedule') : t('deleteLbl')}
        </Button>
      </div>
      {post.status !== 'sent' ? (
        <Link
          href={`/post?edit=${post.id}`}
          className="btn btn-sm mt-2 w-full border border-line bg-paper"
        >
          {t('calEditPost')}
        </Link>
      ) : null}
    </div>
  );
}

type BoardView = 'day' | 'week' | 'month' | 'year' | 'list';

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
  const [scroller] = useState(() => createScrollControllerPlugin({ initialScroll: initialScrollForNow() }));
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
        // Always render full event cards, never the small-screen dot mode.
        isCalendarSmall: () => false,
        onEventClick: (ev) => {
          onSelectPost(String(ev.id), ev.start);
        },
        onBeforeEventUpdate: (_oldEv, newEv) => {
          const iso = resolveDrop(newEv);
          if (!iso) return false;
          // Too-soon drops snap back with no popup, the guard message on a
          // past/near drag was noisy; the 5-minute rule still applies.
          if (queueTooSoon(iso)) return false;
          return true;
        },
        onEventUpdate: (ev) => {
          const iso = resolveDrop(ev);
          if (iso) persistDrop(String(ev.id), iso);
        },
      },
    },
    [eventsService, controls, dnd, scroller],
  );

  // Push fresh server data into the calendar (retime/publish/delete → refresh).
  useEffect(() => {
    if (calendar) eventsService.set(events);
  }, [calendar, events, eventsService]);

  // Follow our header steppers.
  useEffect(() => {
    if (calendar) controls.setDate(Temporal.PlainDate.from(anchorKey));
  }, [calendar, anchorKey, controls]);

  // Flip the theme live through the calendar's reactive signal, remounting
  // here is what caused the full refresh + lost scroll on every toggle.
  useEffect(() => {
    if (!calendar) return;
    const state = (
      calendar as unknown as { calendarState?: { isDark?: { value: boolean } } }
    ).calendarState;
    if (state?.isDark) state.isDark.value = dark;
  }, [calendar, dark]);

  // Wash the current hour's row across the whole grid. The day columns
  // hold no hour rows (events are absolute; grid lines come from the time
  // axis), so expose the hour as CSS vars and paint one band on every
  // column + the axis. Repaints every minute; month view has no axis.
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!calendar) return;
    const paint = () => {
      const cal = hostRef.current?.querySelector('.sx-react-calendar-wrapper');
      if (!cal) return;
      const el = cal as HTMLElement;
      const show = todayInView(view, anchorKey);
      el.classList.toggle('sx-show-now-hour', show);
      if (!show) return;
      const rows = el.querySelectorAll('.sx__week-grid__time-axis .sx__week-grid__hour');
      el.style.setProperty('--sx-now-hour', String(new Date().getHours()));
      el.style.setProperty('--sx-day-hours', String(rows.length || 24));
    };
    paint();
    const t = window.setInterval(paint, 60_000);
    return () => window.clearInterval(t);
  }, [calendar, view, anchorKey]);

  if (!calendar) {
    return <div className="h-full min-h-[480px] animate-pulse rounded-2xl bg-paper-dim" />;
  }
  return (
    <div ref={hostRef} style={{ display: 'contents' }}>
      <ScheduleXCalendar calendarApp={calendar} customComponents={SX_CUSTOM_COMPONENTS} />
    </div>
  );
}

export default function ScheduleXBoard({
  posts,
  channels,
  initialView = 'week',
  initialAnchor,
  media = {},
  variant = 'page',
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  /** View from the route path (/calendar-month → month). The URL is the source of truth. */
  initialView?: BoardView;
  /** Day-key (YYYY-MM-DD) the calendar opens on, carried in ?d= across view switches. */
  initialAnchor?: string;
  /** Signed media per post id, for the thumbnail row on schedule cards. */
  media?: Record<string, MediaAssetRow[]>;
  /** 'page' = full calendar; 'mini' = bare week grid for embedding (dashboard). */
  variant?: 'page' | 'mini';
}) {
  const t = useT(appMessages);
  const router = useRouter();
  const [view, setView] = useState<BoardView>(initialView);
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
  /** Null = all. Set = only these channel ids / statuses. */
  const [chanFilter, setChanFilter] = useState<string[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  // Schedule-X renders client-side only (local timezone + Temporal).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Below md the time grid gives way to the phone agenda.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
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
  /** Real handle only, never numeric ids, URLs or site names. */
  const cleanHandle = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const t = raw.trim().replace(/^@+/, '');
    if (!t || t.includes('://') || /[:\s/\\]/.test(t)) return null;
    if (/^\d+$/.test(t)) return null;
    if (t.length > 64) return null;
    return `@${t}`;
  };

  /** Chain parts grouped by chain_id, only the head renders anywhere. */
  const chainParts = useMemo(() => chainPartsByChain(posts), [posts]);
  /** Chain size: sibling rows, or the worker thread length for collapsed chains. */
  const partCount = (p: PostWithTargets): number => threadCount(p, chainParts);
  const isHead = (p: PostWithTargets): boolean => isChainHead(p, chainParts);

  /** Display set: full posts drive chains/actions, this drives what renders. */
  const visiblePosts = useMemo(
    () =>
      posts.filter((p) => {
        if (
          chanFilter &&
          !p.post_targets.some((t) => chanFilter.includes(t.channel_id))
        )
          return false;
        if (statusFilter && !statusFilter.includes(p.status)) return false;
        return true;
      }),
    [posts, chanFilter, statusFilter],
  );

  const toggleChan = (id: string) => {
    setChanFilter((prev) => {
      const cur = prev ?? channels.map((c) => c.id);
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length === 0 || next.length === channels.length ? null : next;
    });
  };

  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => {
      const cur = prev ?? [...STATUS_OPTIONS];
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      return next.length === 0 || next.length === STATUS_OPTIONS.length ? null : next;
    });
  };

  const byDay = useMemo(() => {
    const m = new Map<string, PostWithTargets[]>();
    for (const p of visiblePosts) {
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
  }, [visiblePosts, chainParts]);

  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;

  /** Posts → Schedule-X events (chain heads with a time; block fits content). */
  const sxEvents = useMemo<SXEvent[]>(() => {
    const out: SXEvent[] = [];
    for (const p of visiblePosts) {
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
      const t0 = primaryTarget(p);
      const accent = accentOf(t0?.provider);
      const thumbs = (media[p.id] ?? [])
        .slice(0, 4)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          src:
            m.kind === 'image' && m.signed_url
              ? imageThumb(m.signed_url, THUMB_WIDTHS.xs)
              : (m.thumb_url ?? m.signed_url ?? ''),
        }))
        .filter((t): t is { id: string; kind: 'video' | 'image'; src: string } => Boolean(t.src));
      // The block is a visual size, not a duration. Schedule-X files any event
      // whose end lands on the next date in the all-day row — and that row sits
      // inside the sticky week header, so a late post appeared pinned over the
      // day names. Clamp to the last minute of the start day.
      const blockEnd = start.add({ minutes: thumbs.length === 0 ? 75 : thumbs.length === 1 ? 150 : 135 });
      const dayEnd = start.startOfDay().add({ days: 1 }).subtract({ seconds: 1 });
      const end = Temporal.ZonedDateTime.compare(blockEnd, dayEnd) > 0 ? dayEnd : blockEnd;
      out.push({
        id: p.id,
        title: snippet(p),
        start,
        end,
        calendarId: statusCalendar(p.status),
        sxProvider: t0?.provider,
        sxAvatar: t0 ? avatarOf(t0.channel_id) : undefined,
        sxTime: formatTime(p.scheduled_at),
        sxThread: partCount(p) > 1 ? partCount(p) : null,
        sxStatus: p.status,
        sxThumbs: thumbs,
        sxAccent: accent,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePosts, media, chainParts, avatarByChannel, channelById, timeZone]);

  // Fresh server data for the drop pipeline (calendar callbacks are created once).
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  });

  // Direct card-tap opener for OpenOnTap (module registry, refreshed render).
  useEffect(() => {
    sxCardOpen = (id: string) => {
      const p = posts.find((pp) => pp.id === id);
      if (!p) return;
      setSelectedPostId(id);
      if (p.scheduled_at) setSelectedKey(dayKey(new Date(p.scheduled_at)));
    };
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
        setErr(e instanceof Error ? e.message : t('calErrResched'));
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
      setErr(t('leadTime'));
      return;
    }
    setErr(null);
    try {
      const sb = createClient();
      await Promise.all(moves.map((m) => reschedulePost(sb, m.id, m.iso)));
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('calErrResched'));
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
      setErr(e instanceof Error ? e.message : t('calErrTimes'));
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
      setErr(e instanceof Error ? e.message : t('calErrQueue'));
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
      setErr(e instanceof Error ? e.message : t('calErrDelete'));
    }
  }

  const title =
    view === 'day'
      ? anchor.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
      : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Muted period line under the title: the exact span the current view covers.
  const rangeLabel = (() => {
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (view === 'week') {
      const start = addDays(anchor, -((anchor.getDay() + 6) % 7)); // Monday start
      const end = addDays(start, 6);
      return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
    }
    if (view === 'list') {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      return `${fmt(start)} – ${fmt(addDays(start, 13))}`;
    }
    if (view === 'day') return anchor.toLocaleDateString(undefined, { weekday: 'long' });
    return null;
  })();

  const stepPrev = () => {
    if (view === 'month') setAnchor(addMonths(anchor, -1));
    else if (view === 'week') setAnchor(addDays(anchor, -7));
    else if (view === 'day') setAnchor(addDays(anchor, -1));
    else if (view === 'list') setAnchor(addDays(anchor, -14));
    else setAnchor(addMonths(anchor, -12));
  };
  const stepNext = () => {
    if (view === 'month') setAnchor(addMonths(anchor, 1));
    else if (view === 'week') setAnchor(addDays(anchor, 7));
    else if (view === 'day') setAnchor(addDays(anchor, 1));
    else if (view === 'list') setAnchor(addDays(anchor, 14));
    else setAnchor(addMonths(anchor, 12));
  };
  const stepToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelectedKey(dayKey(now));
  };

  /** Switch views instantly in-page, the posts are already in memory, so
   *  just remount the calendar instead of a full page load. The URL is
   *  replaced (never pushed) so refresh and bookmarks still land on the
   *  right view; the per-view routes remain as entry points. */
  const goView = (next: BoardView) => {
    if (next === view) return;
    setView(next);
    const d = dayKey(anchor);
    const path =
      next === 'month'
        ? '/calendar-month'
        : next === 'day'
          ? '/calendar-day'
          : next === 'year'
            ? '/calendar-year'
            : next === 'list'
              ? '/calendar-list'
              : '/calendar';
    window.history.replaceState(null, '', `${path}?d=${d}`);
  };

  const VIEW_TABS: { id: BoardView; key: string }[] = [
    { id: 'day', key: 'calDay' },
    { id: 'week', key: 'calWeek' },
    { id: 'month', key: 'calMonth' },
    { id: 'year', key: 'calYear' },
    { id: 'list', key: 'calList' },
  ];

  const todayKey = dayKey(new Date());

  /** The middle stepper pill names the period it sits on, in the calendar's
   *  own unit ("Today" / "This week" / "October" / "2025"). Stepping the
   *  chevrons moves it; clicking it always jumps back to today's period. */
  const pill = (() => {
    const now = new Date();
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    if (view === 'day') {
      return todayInView('day', dayKey(anchor)) ? t('today') : fmt(anchor);
    }
    if (view === 'week') {
      if (todayInView('week', dayKey(anchor))) return t('thisWeek');
      const start = addDays(anchor, -((anchor.getDay() + 6) % 7));
      return `${fmt(start)} – ${fmt(addDays(start, 6))}`;
    }
    if (view === 'month') {
      const current =
        anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth();
      return current ? t('thisMonth') : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    if (view === 'year') {
      return anchor.getFullYear() === now.getFullYear()
        ? t('thisYear')
        : String(anchor.getFullYear());
    }
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const inWindow = todayKey >= dayKey(base) && todayKey <= dayKey(addDays(base, 13));
    return inWindow ? t('today') : `${fmt(base)} – ${fmt(addDays(base, 13))}`;
  })();

  /** Year view: posts per month for the anchor year (drives the count pills). */
  const yearCounts = useMemo(() => {
    const y = anchor.getFullYear();
    const counts = Array.from({ length: 12 }, () => 0);
    byDay.forEach((items, k) => {
      const [yy, mm] = k.split('-').map(Number);
      if (yy === y && mm >= 1 && mm <= 12) counts[mm - 1] += items.length;
    });
    return counts;
  }, [byDay, anchor]);

  /** List view: 14-day window from the anchor, days with posts only. */
  const listDays = useMemo(() => {
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const days: { key: string; date: Date; items: PostWithTargets[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(base, i);
      const items = byDay.get(dayKey(d)) ?? [];
      if (items.length) days.push({ key: dayKey(d), date: d, items });
    }
    return days;
  }, [anchor, byDay]);

  /** List view: visible drafts with no date yet. */
  const undatedVisible = useMemo(
    () => visiblePosts.filter((p) => !p.scheduled_at && isHead(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiblePosts, chainParts],
  );

  const dayLabelFor = (d: Date, k: string): string => {
    const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    if (k === todayKey) return fill(t('calTodayDate'), { date });
    if (k === dayKey(addDays(new Date(), 1))) return fill(t('calTomorrowDate'), { date });
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const authorLine = (p: PostWithTargets): { name: string; handle: string | null; provider: string } => {
    const t0 = primaryTarget(p);
    const provider = t0?.provider ?? 'x';
    const ch = t0 ? channelById.get(t0.channel_id) : undefined;
    return {
      name: ch?.display_name?.trim() || providerMeta(provider).label,
      handle: cleanHandle(ch?.handle),
      provider,
    };
  };

  /** One list row: time · account · text · status. Opens the same popup. */
  const listRow = (p: PostWithTargets, k: string, timeText: string, timeFaint?: boolean) => {
    const t0 = primaryTarget(p);
    const a = authorLine(p);
    const st = statusMetaOf(p.status, t);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => {
          setSelectedKey(k);
          setSelectedPostId(p.id);
        }}
        className={`flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition ${
          selectedPostId === p.id
            ? 'border-ink/25 ring-1 ring-accent'
            : 'border-line hover:border-ink/20 hover:bg-paper-dim/40'
        }`}
      >
        <span
          className={`w-14 shrink-0 text-xs font-medium tabular-nums ${timeFaint ? 'text-faint' : 'text-ink'}`}
        >
          {timeText}
        </span>
        <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />
        {t0 ? (
          <ChannelAvatar provider={t0.provider} avatar={avatarOf(t0.channel_id)} size={22} />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-snug">{snippet(p)}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {a.handle ? `${a.handle} · ` : ''}
            {a.name}
            {partCount(p) > 1 ? ` · ${fill(t('sxThreadN'), { n: partCount(p) })}` : ''}
          </span>
        </span>
        <Badge className={`${st.className} hidden shrink-0 sm:inline-flex`}>{st.label}</Badge>
      </button>
    );
  };

  /* ----------------------- shared bits for new surfaces ----------------------- */

  /** Next few posts still to go out, soonest first (sidebar + empty states). */
  const upcoming = useMemo(() => {
    const now = Date.now();
    const out: PostWithTargets[] = [];
    for (const items of byDay.values()) {
      for (const p of items) {
        if (p.status === 'sent' || !p.scheduled_at) continue;
        if (new Date(p.scheduled_at).getTime() < now) continue;
        out.push(p);
      }
    }
    return out.sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')).slice(0, 6);
  }, [byDay]);

  /** Monday of the anchor's week and its seven days. */
  const weekDays = useMemo(() => {
    const mon = addDays(anchor, -((anchor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [anchor]);

  /** Status mix for the viewed week, sidebar summary. */
  const weekMix = useMemo(() => {
    const mix = { draft: 0, queued: 0, sent: 0, failed: 0 };
    for (const d of weekDays) {
      for (const p of byDay.get(dayKey(d)) ?? []) mix[statusCalendar(p.status) as keyof typeof mix] += 1;
    }
    return mix;
  }, [weekDays, byDay]);

  const openPost = (p: PostWithTargets) => {
    if (p.scheduled_at) setSelectedKey(dayKey(new Date(p.scheduled_at)));
    setSelectedPostId(p.id);
  };

  /** Drop on another day: same wall-clock time, new date (whole chain moves). */
  const moveToDay = (id: string, key: string) => {
    const p = posts.find((x) => x.id === id);
    if (!p?.scheduled_at || dayKey(new Date(p.scheduled_at)) === key) return;
    const { h, m } = partsOf(p.scheduled_at);
    void retime(id, isoAt(key, h, m));
  };

  /** Small month grid: dots for busy days, click to jump there. */
  const miniMonth = (base: Date, onPick: (d: Date) => void, activeKey: string) => (
    <div className="grid grid-cols-7 gap-y-0.5 text-center">
      {Array.from({ length: 7 }, (_, wi) => (
        <span key={wi} className="pb-1 text-[10px] font-medium text-faint">
          {new Date(2023, 0, 2 + wi).toLocaleDateString(undefined, { weekday: 'narrow' })}
        </span>
      ))}
      {monthMatrix(base)
        .flat()
        .map((d) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === base.getMonth();
          const n = (byDay.get(k) ?? []).length;
          const isT = k === todayKey;
          const on = k === activeKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(d)}
              aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-pressed={on}
              className={`mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-xs tabular-nums transition ${
                on
                  ? 'bg-ink font-bold text-bone'
                  : isT
                    ? 'bg-accent font-bold text-on-accent'
                    : inMonth
                      ? 'text-soft hover:bg-surface'
                      : 'text-faint/50 hover:bg-surface'
              }`}
            >
              {d.getDate()}
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${n ? (on ? 'bg-accent' : isT ? 'bg-on-accent' : 'bg-bolt-deep') : 'bg-transparent'}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
    </div>
  );

  /** Compact post card used by the phone agenda, sidebar and dashboard week. */
  const postChip = (p: PostWithTargets, opts: { compact?: boolean; draggable?: boolean } = {}) => {
    const t0 = primaryTarget(p);
    const thumb = (media[p.id] ?? [])[0];
    const thumbSrc = thumb
      ? thumb.kind === 'image' && thumb.signed_url
        ? imageThumb(thumb.signed_url, THUMB_WIDTHS.xs)
        : (thumb.thumb_url ?? '')
      : '';
    const canDrag = !!opts.draggable && p.status !== 'sent' && p.status !== 'partial';
    return (
      <button
        key={p.id}
        type="button"
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/sosial-post', p.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => openPost(p)}
        className={`group relative flex w-full items-start gap-2 overflow-hidden rounded-xl border border-line bg-card text-left transition hover:border-ink/20 hover:shadow-[0_2px_10px_rgba(28,26,20,0.08)] ${
          opts.compact ? 'p-2' : 'p-2.5'
        } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ boxShadow: `inset 3px 0 0 ${accentOf(t0?.provider)}` }}
      >
        {t0 ? <ChannelAvatar provider={t0.provider} avatar={avatarOf(t0.channel_id)} size={opts.compact ? 18 : 22} /> : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold tabular-nums text-ink">{formatTime(p.scheduled_at)}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? 'bg-[#9A958B]'}`} aria-hidden="true" />
            {partCount(p) > 1 ? (
              <span className="text-[10px] text-faint">{fill(t('sxThreadN'), { n: partCount(p) })}</span>
            ) : null}
          </span>
          <span className={`mt-0.5 block text-xs leading-snug text-soft ${opts.compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
            {snippet(p)}
          </span>
        </span>
        {thumbSrc ? (
          <SafeImg
            src={thumbSrc}
            alt=""
            loading="lazy"
            className={`shrink-0 rounded-lg object-cover ${opts.compact ? 'h-8 w-8' : 'h-10 w-10'}`}
          />
        ) : null}
      </button>
    );
  };

  /** Post details: centered dialog on desktop, bottom sheet on a phone. */
  const detailsPortal =
    selectedPost && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t('calDetails')}
          >
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => setSelectedPostId(null)}
              className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
            />
            <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:pt-5">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
              <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow">
                {fill(t('calPostEyebrow'), { key: selectedKey })}
                {partCount(selectedPost) > 1 ? fill(t('calThreadOf'), { n: partCount(selectedPost) }) : ''}
              </p>
              <button
                type="button"
                onClick={() => setSelectedPostId(null)}
                aria-label={t('calCloseDetails')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium text-muted transition hover:bg-paper-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            {partCount(selectedPost) > 1 ? (
              <p className="mb-2 text-xs text-muted">
                {t('calThreadNote')}
              </p>
            ) : null}
            {/* The post as it reads (or will read) in the feed. */}
            {(() => {
              const p = selectedPost;
              const t0 = primaryTarget(p);
              const provider = t0?.provider ?? 'x';
              const ch = t0 ? channelById.get(t0.channel_id) : undefined;
              const at = p.sent_at ?? p.scheduled_at;
              return (
                <div className="mb-3">
                  <SocialPost
                    author={{
                      name: ch?.display_name?.trim() || providerMeta(provider).label,
                      handle: cleanHandle(ch?.handle),
                      provider,
                      avatar: t0 ? avatarOf(t0.channel_id) : undefined,
                    }}
                    time={at ? formatDateTime(at) : undefined}
                    body={p.body || p.title || ''}
                    emptyLabel={t('noTextMedia')}
                    badge={
                      <Badge className={statusMetaOf(p.status, t).className}>{statusMetaOf(p.status, t).label}</Badge>
                    }
                    media={(media[p.id] ?? [])
                      .map((m) => ({
                        id: m.id,
                        kind: m.kind,
                        src:
                          m.kind === 'video'
                            ? (m.signed_url ?? '')
                            : m.signed_url
                              ? (imageThumb(m.signed_url, THUMB_WIDTHS.md) ?? '')
                              : (m.thumb_url ?? ''),
                        poster: m.thumb_url,
                      }))
                      .filter((m) => m.src)}
                    clamp={8}
                  />
                </div>
              );
            })()}
            {selectedPost.status === 'sent' ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full !text-[#9F2F2D]"
                onClick={() => void remove()}
                disabled={pending}
              >
                {t('deleteLbl')}
              </Button>
            ) : (
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
            )}
          </div>
          </div>,
          // Inside the theme scope so `.theme-dark` variables apply;
          // document.body would strand the panel outside dark mode.
          document.querySelector('[data-theme-root]') ?? document.body,
        )
      : null;

  /* ------------------------- dashboard: week overview ------------------------ */

  if (variant === 'mini') {
    const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-card p-0.5">
            <button
              type="button"
              onClick={() => setAnchor(addDays(anchor, -7))}
              aria-label={t('calPrev')}
              className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stepToday}
              title={t('calJumpToday')}
              className="rounded-full px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-surface"
            >
              {todayInView('week', dayKey(anchor)) ? t('thisWeek') : weekLabel}
            </button>
            <button
              type="button"
              onClick={() => setAnchor(addDays(anchor, 7))}
              aria-label={t('calNext')}
              className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <span className="cal-count hidden sm:inline">{weekLabel}</span>
        </div>
        {/* Seven columns on a wide card; a swipeable row of days on a phone. */}
        <div className="no-scrollbar -mx-5 grid snap-x snap-mandatory auto-cols-[minmax(168px,72%)] grid-flow-col gap-2 overflow-x-auto px-5 pb-1 sm:auto-cols-[minmax(168px,1fr)] lg:mx-0 lg:grid-flow-row lg:grid-cols-7 lg:overflow-visible lg:px-0">
          {weekDays.map((d) => {
            const k = dayKey(d);
            const items = byDay.get(k) ?? [];
            const isT = k === todayKey;
            const past = k < todayKey;
            return (
              <div
                key={k}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/sosial-post')) {
                    e.preventDefault();
                    e.currentTarget.dataset.over = '1';
                  }
                }}
                onDragLeave={(e) => {
                  delete e.currentTarget.dataset.over;
                }}
                onDrop={(e) => {
                  delete e.currentTarget.dataset.over;
                  const id = e.dataTransfer.getData('text/sosial-post');
                  if (id) moveToDay(id, k);
                }}
                className={`flex min-h-[220px] snap-start flex-col rounded-2xl border p-2 transition data-[over]:border-accent data-[over]:bg-accent-soft ${
                  isT ? 'border-accent/70 bg-accent-soft/50' : 'border-line bg-surface/50'
                }`}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${past ? 'text-faint' : 'text-muted'}`}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span
                    className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-bold tabular-nums ${
                      isT ? 'bg-accent text-on-accent' : past ? 'text-faint' : 'text-ink'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  {items.slice(0, 4).map((p) => postChip(p, { compact: true, draggable: true }))}
                  {items.length > 4 ? (
                    <Link
                      href={`/calendar-day?d=${k}`}
                      className="rounded-lg px-1 py-0.5 text-[11px] font-bold text-muted transition hover:text-ink"
                    >
                      +{items.length - 4}
                    </Link>
                  ) : null}
                  {!past ? (
                    <Link
                      href="/post"
                      aria-label={t('calAddPost')}
                      className={`mt-auto grid place-items-center rounded-xl border border-dashed border-line text-faint transition hover:border-ink/30 hover:text-ink ${
                        items.length ? 'h-7' : 'h-full min-h-[96px]'
                      }`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <p className="cal-hint mt-2.5">{t('calWeekDropHint')}</p>
        {err ? <p className="mt-2 rounded-xl bg-[#FDEBEC] px-3 py-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
        {detailsPortal}
      </div>
    );
  }

  /* ------------------------------ phone agenda ------------------------------ */

  // Below md the time grid has no room; Day/Week/Month become a date strip
  // (or compact month) with the chosen day's posts listed underneath.
  const agendaKey = (() => {
    if (view === 'month') {
      const [y, m] = selectedKey.split('-').map(Number);
      return y === anchor.getFullYear() && m === anchor.getMonth() + 1 ? selectedKey : dayKey(anchor);
    }
    if (view === 'day') return dayKey(anchor);
    return weekDays.some((d) => dayKey(d) === selectedKey) ? selectedKey : dayKey(weekDays[0]) <= todayKey && todayKey <= dayKey(weekDays[6]) ? todayKey : dayKey(weekDays[0]);
  })();
  const agendaItems = byDay.get(agendaKey) ?? [];
  const agendaDate = (() => {
    const [y, m, d] = agendaKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  /**
   * Month as a real wall calendar: equal cells on a ruled grid, the date in
   * each corner, posts inside the day. Desktop cells hold up to three post
   * chips (drag one to another day to move it); the phone version is the
   * same grid with brand dots, and tapping a day lists it underneath.
   */
  const monthGrid = (compact: boolean) => {
    const cells = monthMatrix(anchor).flat();
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid grid-cols-7 border-b border-line bg-surface/70">
          {Array.from({ length: 7 }, (_, wi) => {
            const d = new Date(2023, 0, 2 + wi); // 2023-01-02 is a Monday
            return (
              <span
                key={wi}
                className={`py-2 text-center text-[11px] font-bold uppercase tracking-wide ${wi >= 5 ? 'text-faint' : 'text-muted'}`}
              >
                {d.toLocaleDateString(undefined, { weekday: compact ? 'narrow' : 'short' })}
              </span>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const items = byDay.get(k) ?? [];
            const isT = k === todayKey;
            const weekend = i % 7 >= 5;
            const edges = `${i % 7 === 6 ? '' : 'border-r'} ${i >= cells.length - 7 ? '' : 'border-b'} border-line`;
            const dateNum = (
              <span
                className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-bold tabular-nums ${
                  isT ? 'bg-accent text-on-accent' : inMonth ? 'text-ink' : 'text-faint'
                }`}
              >
                {d.getDate()}
              </span>
            );

            if (compact) {
              const on = k === agendaKey;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedKey(k)}
                  aria-pressed={on}
                  aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${items.length ? `, ${fill(t('calNPosts'), { n: items.length })}` : ''}`}
                  className={`relative flex h-14 flex-col items-center gap-1 pt-1 transition ${edges} ${
                    on ? 'bg-accent-soft' : weekend || !inMonth ? 'bg-surface/40' : ''
                  } ${inMonth ? '' : 'opacity-50'}`}
                >
                  {on ? <span className="absolute inset-0 ring-2 ring-inset ring-ink" aria-hidden="true" /> : null}
                  {dateNum}
                  {items.length ? (
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {items.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: accentOf(primaryTarget(p)?.provider) }}
                        />
                      ))}
                      {items.length > 3 ? <span className="text-[9px] font-bold leading-none text-muted">+</span> : null}
                    </span>
                  ) : null}
                </button>
              );
            }

            return (
              <div
                key={k}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/sosial-post')) {
                    e.preventDefault();
                    e.currentTarget.dataset.over = '1';
                  }
                }}
                onDragLeave={(e) => {
                  delete e.currentTarget.dataset.over;
                }}
                onDrop={(e) => {
                  delete e.currentTarget.dataset.over;
                  const id = e.dataTransfer.getData('text/sosial-post');
                  if (id) moveToDay(id, k);
                }}
                className={`group/day flex min-h-[124px] min-w-0 flex-col gap-1 p-1.5 transition data-[over]:bg-accent-soft ${edges} ${
                  isT ? 'bg-accent-soft/60' : weekend || !inMonth ? 'bg-surface/40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={inMonth ? '' : 'opacity-60'}>{dateNum}</span>
                  {k >= todayKey ? (
                    <Link
                      href="/post"
                      aria-label={t('calAddPost')}
                      className="grid h-6 w-6 place-items-center rounded-full text-faint opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover/day:opacity-100"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                {items.slice(0, 3).map((p) => {
                  const canDrag = p.status !== 'sent' && p.status !== 'partial';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      draggable={canDrag}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/sosial-post', p.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => openPost(p)}
                      title={snippet(p)}
                      className={`flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded-md bg-card px-1.5 text-left ring-1 ring-line transition hover:ring-ink/25 ${
                        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${inMonth ? '' : 'opacity-60'}`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: accentOf(primaryTarget(p)?.provider) }}
                        aria-hidden="true"
                      />
                      <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted">
                        {formatTime(p.scheduled_at)}
                      </span>
                      <span className="min-w-0 truncate text-[11px] font-medium text-ink">{snippet(p)}</span>
                    </button>
                  );
                })}
                {items.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Open that day; the URL follows like any view switch.
                      setAnchor(d);
                      setSelectedKey(k);
                      setView('day');
                      window.history.replaceState(null, '', `/calendar-day?d=${k}`);
                    }}
                    className="rounded-md px-1.5 text-left text-[11px] font-bold text-muted transition hover:text-ink"
                  >
                    +{items.length - 3}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const phoneAgenda = (
    <div className="space-y-4">
      {view === 'month' ? (
        monthGrid(true)
      ) : view === 'week' ? (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const k = dayKey(d);
            const on = k === agendaKey;
            const n = (byDay.get(k) ?? []).length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKey(k)}
                aria-pressed={on}
                className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 transition ${
                  on ? 'bg-ink text-bone' : k === todayKey ? 'bg-accent-soft text-ink' : 'text-soft hover:bg-surface'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase ${on ? 'text-bone/70' : 'text-faint'}`}>
                  {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
                <span className="text-base font-bold tabular-nums">{d.getDate()}</span>
                <span className={`h-1 w-1 rounded-full ${n ? (on ? 'bg-accent' : 'bg-bolt-deep') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      ) : null}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
          <h2 className="font-display text-[15px] font-bold tracking-tight">{dayLabelFor(agendaDate, agendaKey)}</h2>
          {agendaItems.length ? <span className="cal-count">{fill(t('calNPosts'), { n: agendaItems.length })}</span> : null}
        </div>
        {agendaItems.length ? (
          <div className="space-y-2">{agendaItems.map((p) => postChip(p))}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm text-muted">{t('calNothingDay')}</p>
            {agendaKey >= todayKey ? (
              <Link href="/post" className="btn btn-bolt btn-sm mt-3 inline-flex">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t('calAddPost')}
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );

  /* -------------------------------- sidebar --------------------------------- */

  const sidebar = (
    <aside className="hidden w-[300px] shrink-0 space-y-4 xl:block">
      <div className="rounded-2xl border border-line bg-card p-3.5">
        <p className="mb-2 px-1 font-display text-sm font-bold tracking-tight">
          {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        {miniMonth(
          anchor,
          (d) => {
            setAnchor(d);
            setSelectedKey(dayKey(d));
          },
          dayKey(anchor),
        )}
      </div>
      <div className="rounded-2xl border border-line bg-card p-3.5">
        <p className="mb-2.5 px-1 font-display text-sm font-bold tracking-tight">{t('calThisWeekLoad')}</p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {(
            [
              ['queued', 'stQueued', 'bg-[#B45309]'],
              ['sent', 'stSent', 'bg-[#12914A]'],
              ['draft', 'stDraft', 'bg-[#9A958B]'],
              ['failed', 'stFailed', 'bg-[#E5484D]'],
            ] as const
          ).map(([k, label, dot]) => (
            <div key={k} className="rounded-xl bg-surface px-1 py-2">
              <p className="font-display text-lg font-bold tabular-nums leading-none">{weekMix[k]}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
                <span className="truncate">{t(label)}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-card p-3.5">
        <p className="mb-2.5 px-1 font-display text-sm font-bold tracking-tight">{t('calUpNext')}</p>
        {upcoming.length ? (
          <div className="space-y-1.5">
            {upcoming.map((p) => (
              <div key={p.id}>
                <p className="mb-0.5 px-1 text-[10px] font-bold uppercase tracking-wide text-faint">
                  {p.scheduled_at
                    ? dayLabelFor(new Date(p.scheduled_at), dayKey(new Date(p.scheduled_at)))
                    : ''}
                </p>
                {postChip(p, { compact: true })}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-xs leading-relaxed text-muted">{t('calNothingUpcoming')}</p>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 pb-3 sm:px-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-[28px]">
            {title}
          </h1>
          <p className="cal-count mt-0.5">
            {t(VIEW_TABS.find((v) => v.id === view)?.key ?? 'calMonth')}
            {rangeLabel ? ` · ${rangeLabel}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-card p-0.5">
            <button
              type="button"
              onClick={stepPrev}
              aria-label={t('calPrev')}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stepToday}
              title={t('calJumpToday')}
              className="min-w-[4.75rem] rounded-full px-2.5 py-1.5 text-center text-xs font-bold text-ink transition hover:bg-surface"
            >
              {pill}
            </button>
            <button
              type="button"
              onClick={stepNext}
              aria-label={t('calNext')}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Link href="/post" className="btn btn-bolt btn-sm !h-9" aria-label={t('cNewPost')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('cNewPost')}</span>
          </Link>
        </div>
      </header>

      {/* View tabs swipe sideways on a phone; filters and count follow. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-1 pb-3 sm:px-2">
        <div className="no-scrollbar -mx-1 w-full overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:px-0">
          <SegmentedPills
            ariaLabel={t('calMonth')}
            role="tablist"
            variant="paper"
            value={view}
            onChange={goView}
            trackClassName="w-max"
            buttonClassName="font-medium"
            options={VIEW_TABS.map((tb) => ({ value: tb.id, label: t(tb.key) }))}
          />
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                chanFilter
                  ? 'border-transparent bg-accent-soft text-ink'
                  : 'border-line text-soft hover:bg-paper-dim'
              }`}
            >
              {t('cChannels')}{chanFilter ? ` · ${chanFilter.length}` : ''}
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="!w-64 !p-2">
            <button
              type="button"
              onClick={() => setChanFilter(null)}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              {t('calAllChannels')}
            </button>
            {channels.map((c) => {
              const label = c.display_name?.trim() || providerMeta(c.provider).label;
              const checked = !chanFilter || chanFilter.includes(c.id);
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-paper-dim"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChan(c.id)}
                    className="h-3.5 w-3.5 shrink-0 accent-[#FFC62E]"
                  />
                  <ChannelAvatar
                    provider={c.provider}
                    avatar={channelAvatar(c.metadata)}
                    size={20}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
                </label>
              );
            })}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                statusFilter
                  ? 'border-transparent bg-accent-soft text-ink'
                  : 'border-line text-soft hover:bg-paper-dim'
              }`}
            >
              {t('calStatus')}{statusFilter ? ` · ${statusFilter.length}` : ''}
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="!w-56 !p-2">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              {t('calAllStatuses')}
            </button>
            {STATUS_OPTIONS.map((s) => {
              const meta = statusMetaOf(s as PostWithTargets['status'], t);
              const checked = !statusFilter || statusFilter.includes(s);
              return (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-paper-dim"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStatus(s)}
                    className="h-3.5 w-3.5 shrink-0 accent-[#FFC62E]"
                  />
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s] ?? 'bg-[#9A958B]'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{meta.label}</span>
                </label>
              );
            })}
          </PopoverContent>
        </Popover>

        {chanFilter || statusFilter ? (
          <button
            type="button"
            onClick={() => {
              setChanFilter(null);
              setStatusFilter(null);
            }}
            className="text-xs font-medium text-muted underline-offset-2 transition hover:text-ink hover:underline"
          >
            {t('cpClear')}
          </button>
        ) : null}
        <span className="flex-1" />
        <span className="cal-count">{fill(t('calShown'), { n: sxEvents.length })}</span>
      </div>

      {err && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-ink py-2.5 pr-2.5 pl-4 text-sm text-paper shadow-xl">
            <span className="truncate">{err}</span>
            <button
              type="button"
              onClick={() => setErr(null)}
              aria-label={t('calDismiss')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs opacity-70 transition hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 gap-5 px-1 pt-4 pb-6 sm:px-2">
      <div className="min-w-0 flex-1">
        {view === 'year' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }, (_, m) => {
                const name = new Date(anchor.getFullYear(), m, 1).toLocaleDateString(undefined, { month: 'long' });
                return (
                <div
                  key={name}
                  className={`rounded-2xl border bg-card p-4 transition hover:border-ink/20 ${
                    m === anchor.getMonth() && anchor.getFullYear() === new Date().getFullYear()
                      ? 'border-ink/25 ring-1 ring-accent/50'
                      : 'border-line'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/calendar-month?d=${anchor.getFullYear()}-${String(m + 1).padStart(2, '0')}-01`,
                        )
                      }
                      className="font-display text-[13px] font-medium tracking-tight transition hover:underline"
                    >
                      {name}
                    </button>
                    {yearCounts[m] ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium tabular-nums text-bolt-deep">
                        {yearCounts[m]}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2.5 grid grid-cols-7 gap-y-1 text-center">
                    {Array.from({ length: 7 }, (_, wi) => (
                      // Monday-first: 2023-01-02 is a Monday.
                      <span key={wi} className="text-[9px] font-medium text-faint">
                        {new Date(2023, 0, 2 + wi).toLocaleDateString(undefined, { weekday: 'narrow' })}
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
                            className={`flex flex-col items-center py-0.5 text-[11px] font-medium tabular-nums ${
                              inMonth ? 'text-soft' : 'text-faint opacity-40'
                            }`}
                          >
                            <span
                              className={
                                isT
                                  ? 'flex h-4 w-4 items-center justify-center rounded-full bg-bolt font-medium text-on-accent'
                                  : ''
                              }
                            >
                              {d.getDate()}
                            </span>
                            <span
                              className={`mt-0.5 h-1 w-1 rounded-full ${has ? 'bg-accent' : 'bg-transparent'}`}
                            />
                          </span>
                        );
                      })}
                  </div>
                </div>
                );
              })}
            </div>
              <p className="cal-hint mt-3">
                {t('calYearHint')}
              </p>
            </>
          ) : view === 'list' ? (
            <>
              {listDays.length === 0 && undatedVisible.length === 0 ? (
                <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-sm text-muted">
                  {t('calNothing14')}
                </p>
              ) : (
                <div className="mx-auto w-full max-w-3xl space-y-6">
                  {listDays.map((day) => (
                    <section key={day.key}>
                      <div className="mb-2 flex items-baseline gap-2 px-1">
                        <h2 className="font-display text-[15px] font-medium tracking-tight">
                          {dayLabelFor(day.date, day.key)}
                        </h2>
                        <span className="cal-count">
                          {fill(t('calNPosts'), { n: day.items.length })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {day.items.map((p) => listRow(p, day.key, formatTime(p.scheduled_at)))}
                      </div>
                    </section>
                  ))}
                  {undatedVisible.length > 0 ? (
                    <section>
                      <div className="mb-2 flex items-baseline gap-2 px-1">
                        <h2 className="font-display text-[15px] font-medium tracking-tight">
                          {t('calNoDateYet')}
                        </h2>
                        <span className="cal-count">
                          {fill(t('calNDrafts'), { n: undatedVisible.length })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {undatedVisible
                          .slice(0, 10)
                          .map((p) => listRow(p, dayKey(new Date()), t('calNoDate'), true))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
              <p className="cal-hint mt-3">
                {t('calListHint')}
              </p>
            </>
          ) : mounted && narrow ? (
            phoneAgenda
          ) : mounted && view === 'month' ? (
            monthGrid(false)
          ) : mounted ? (
          <div className={view === 'month' ? 'sx-height-auto' : undefined}>
            <SXMount
              key={view}
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
        {view !== 'year' && view !== 'list' && !narrow ? (
          <p className="cal-hint mt-3">
            {t('calDragHint')}
          </p>
        ) : null}
      </div>
      {mounted ? sidebar : null}
      </div>

      {detailsPortal}
    </div>
  );
}
