'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
import { createScrollControllerPlugin } from '@schedule-x/scroll-controller';
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
  formatDateTime,
  formatTime,
  monthMatrix,
} from '@/lib/format';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  sxLabel?: string;
  sxName?: string;
  sxHandle?: string | null;
  sxStatusLabel?: string;
  sxStatusClass?: string;
  sxTime?: string;
  sxThread?: number | null;
  sxStatus?: string;
  sxThumbs?: { id: string; kind: 'video' | 'image'; src: string }[];
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

/** Scroll the time grid to just before now on first render (HH:00). */
function initialScrollForNow(): string {
  const h = (new Date().getHours() + 23) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

/** Event media at its natural ratio: image, or muted preview for video. */
function eventMedia(t: { id: string; kind: string; src: string }, cls: string) {
  const shared = `${cls} rounded-lg border border-black/5 bg-black/5 object-contain`;
  return t.kind === 'video' ? (
    <video key={t.id} src={t.src} muted playsInline preload="metadata" className={shared} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={t.id} src={t.src} alt="" loading="lazy" className={shared} />
  );
}
/** Click fallback: custom cards call this directly so opening never depends
 *  on the library's click pipeline (its 150ms drag threshold swallows taps). */
let sxCardOpen: ((id: string) => void) | null = null;

/** Tap/click detector that ignores real drags (movement threshold), for both
 *  mouse and touch. Fires alongside the library click handler — same id, so
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
  const time = sxClockLabel(c.start, c.sxTime);
  const pid = String(c.id ?? '');
  return (
    <OpenOnTap
      id={pid}
      className="sx-event-card overflow-hidden rounded-lg border p-1.5"
      style={
        {
          '--sx-evt-bg': c.sxTintBg ?? '#F1F5F9',
          '--sx-evt-border': c.sxTintBorder ?? '#E2E8F0',
        } as CSSProperties
      }
    >
      <div className="flex items-center gap-1.5">
        {c.sxProvider ? <ChannelAvatar provider={c.sxProvider} avatar={c.sxAvatar} size={22} /> : null}
        <span className="min-w-0 flex-1">
          <span className="sx-event-title block truncate text-[11px] font-extrabold">
            {c.sxName ?? c.sxLabel ?? c.title ?? 'Post'}
          </span>
          <span className="sx-event-sub block truncate text-[10px]">
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
        <div className="sx-event-text mt-1 line-clamp-2 text-[11px] leading-snug">{c.title}</div>
      ) : null}
      {Array.isArray(c.sxThumbs) && c.sxThumbs.length > 0 ? (
        c.sxThumbs.length === 1 ? (
          <div className="mt-1">{eventMedia(c.sxThumbs[0], 'h-auto max-h-[100px] w-full')}</div>
        ) : (
          <div className={`mt-1 grid gap-1 ${c.sxThumbs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {c.sxThumbs
              .slice(0, 3)
              .map((t) => eventMedia(t, 'h-auto max-h-[60px] w-full'))}
          </div>
        )
      ) : null}
    </OpenOnTap>
  );
}

/** Custom month-grid event: compact one-line chip. */
function SXMonthChip({ calendarEvent }: { calendarEvent: SXEvent }) {
  const c = calendarEvent ?? {};
  const pid = String(c.id ?? '');
  return (
    <OpenOnTap
      id={pid}
      className="sx-event-card flex items-center gap-1 truncate rounded-md border px-1 py-px"
      style={
        {
          '--sx-evt-bg': c.sxTintBg ?? '#F1F5F9',
          '--sx-evt-border': c.sxTintBorder ?? '#E2E8F0',
        } as CSSProperties
      }
      title={c.title}
    >
      <span className="sx-event-title shrink-0 text-[10px] font-bold">
        {sxClockLabel(c.start, c.sxTime)}
      </span>
      <span className="sx-event-text truncate text-[11px]">{c.title ?? ''}</span>
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
          {cancellable ? 'Cancel schedule' : 'Delete'}
        </Button>
      </div>
      {post.status !== 'sent' ? (
        <Link
          href={`/post?edit=${post.id}`}
          className="btn btn-sm mt-2 w-full border border-line bg-paper"
        >
          Edit post
        </Link>
      ) : null}
    </div>
  );
}

type BoardView = 'day' | 'week' | 'month' | 'year' | 'list';

/** Sent-post popup body: the dashboard Recent-posts social view (author, text, media). */
function SentPostView({
  post,
  mediaItems,
  avatarOf,
  channelById,
  cleanHandle,
  onDelete,
  busy,
}: {
  post: PostWithTargets;
  mediaItems: MediaAssetRow[];
  avatarOf: (channelId: string) => string | undefined;
  channelById: Map<string, ConnectedChannel>;
  cleanHandle: (raw: string | null | undefined) => string | null;
  onDelete: () => void;
  busy: boolean;
}) {
  const t0 = post.post_targets[0];
  const provider = t0?.provider ?? 'x';
  const ch = t0 ? channelById.get(t0.channel_id) : undefined;
  const name = ch?.display_name?.trim() || providerMeta(provider).label;
  const handle = cleanHandle(ch?.handle);
  const when = post.sent_at ?? post.scheduled_at;
  const st = POST_STATUS_META[post.status];
  const text = post.body || post.title || '';
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <ChannelAvatar
          provider={provider}
          avatar={t0 ? avatarOf(t0.channel_id) : undefined}
          size={36}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{name}</span>
          <span className="block truncate text-xs text-faint">
            {handle ? `${handle} · ` : ''}
            {when ? formatDateTime(when) : ''}
          </span>
        </span>
        <Badge className={st.className}>{st.label}</Badge>
      </div>
      {text ? (
        <p className="mt-3 max-h-[30vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-soft">
          {text}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-faint">No text — media only.</p>
      )}
      {mediaItems.length > 0 ? (
        <div
          className={`mt-3 flex flex-wrap justify-center gap-1.5 ${mediaItems.length > 1 ? 'mx-auto max-w-[320px]' : ''}`}
        >
          {mediaItems.map((m) =>
            m.kind === 'video' ? (
              <video
                key={m.id}
                src={m.signed_url}
                muted
                playsInline
                controls
                className="h-auto max-h-[220px] w-auto max-w-full rounded-xl border border-line bg-bone object-contain"
              />
            ) : m.signed_url || m.thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.signed_url ? imageThumb(m.signed_url, THUMB_WIDTHS.md) : m.thumb_url ?? undefined}
                alt=""
                loading="lazy"
                className={`h-auto w-auto rounded-xl border border-line bg-bone object-contain ${
                  mediaItems.length > 1 ? 'max-h-[120px] max-w-[calc(50%-0.25rem)]' : 'max-h-[220px] max-w-full'
                }`}
              />
            ) : null,
          )}
        </div>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full !text-[#9F2F2D]"
        onClick={onDelete}
        disabled={busy}
      >
        Delete
      </Button>
    </div>
  );
}

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

  // Flip the theme live through the calendar's reactive signal — remounting
  // here is what caused the full refresh + lost scroll on every toggle.
  useEffect(() => {
    if (!calendar) return;
    const state = (
      calendar as unknown as { calendarState?: { isDark?: { value: boolean } } }
    ).calendarState;
    if (state?.isDark) state.isDark.value = dark;
  }, [calendar, dark]);

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
  variant = 'page',
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  /** View from the route path (/calendar-month → month). The URL is the source of truth. */
  initialView?: BoardView;
  /** Day-key (YYYY-MM-DD) the calendar opens on — carried in ?d= across view switches. */
  initialAnchor?: string;
  /** Signed media per post id, for the thumbnail row on schedule cards. */
  media?: Record<string, MediaAssetRow[]>;
  /** 'page' = full calendar; 'mini' = bare week grid for embedding (dashboard). */
  variant?: 'page' | 'mini';
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
  /** Null = all. Set = only these channel ids / statuses. */
  const [chanFilter, setChanFilter] = useState<string[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[] | null>(null);
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
      const t0 = p.post_targets[0];
      const tint = tintOf(t0?.provider);
      const ch = t0 ? channelById.get(t0.channel_id) : undefined;
      const st = POST_STATUS_META[p.status];
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
      out.push({
        id: p.id,
        title: snippet(p),
        start,
        // Block height follows content: text-only stays compact, media gets room.
        end: start.add({ minutes: thumbs.length === 0 ? 75 : thumbs.length === 1 ? 150 : 135 }),
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
            : next === 'list'
              ? '/calendar-list'
              : '/calendar';
    router.push(`${path}?d=${d}`, { scroll: false });
  };

  const VIEW_TABS: { id: BoardView; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
    { id: 'list', label: 'List' },
  ];

  const todayKey = dayKey(new Date());

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
    if (k === todayKey) return `Today, ${date}`;
    if (k === dayKey(addDays(new Date(), 1))) return `Tomorrow, ${date}`;
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const authorLine = (p: PostWithTargets): { name: string; handle: string | null; provider: string } => {
    const t0 = p.post_targets[0];
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
    const t0 = p.post_targets[0];
    const a = authorLine(p);
    const st = POST_STATUS_META[p.status];
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => {
          setSelectedKey(k);
          setSelectedPostId(p.id);
        }}
        className={`flex w-full items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-left transition hover:border-ink/30 ${
          selectedPostId === p.id ? 'ring-2 ring-accent' : ''
        }`}
      >
        <span
          className={`w-16 shrink-0 text-xs font-bold tabular-nums ${timeFaint ? 'text-faint' : 'text-ink'}`}
        >
          {timeText}
        </span>
        {t0 ? (
          <ChannelAvatar provider={t0.provider} avatar={avatarOf(t0.channel_id)} size={22} />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{snippet(p)}</span>
          <span className="block truncate text-xs text-muted">
            {a.handle ? `${a.handle} · ` : ''}
            {a.name}
            {partCount(p) > 1 ? ` · Thread ${partCount(p)}` : ''}
          </span>
        </span>
        <Badge className={`${st.className} hidden shrink-0 sm:inline-flex`}>{st.label}</Badge>
      </button>
    );
  };

  return (
    <div className={variant === 'mini' ? 'sx-compact' : 'flex min-h-screen flex-col'}>
      {variant === 'mini' ? null : (
      <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="font-display text-xl font-extrabold tracking-tight leading-tight">{title}</h1>
            {rangeLabel ? (
              <span className="text-[11px] font-bold text-muted">{rangeLabel}</span>
            ) : null}
          </div>
          <div className="flex items-center rounded-full border border-line p-0.5">
            <button
              type="button"
              onClick={stepPrev}
              aria-label="Previous"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stepToday}
              className="rounded-full px-3 py-1 text-xs font-bold text-ink transition hover:bg-paper-dim"
            >
              Today
            </button>
            <button
              type="button"
              onClick={stepNext}
              aria-label="Next"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
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

      {/* Filters: channel/account + post status. Null = all. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-paper-dim"
            >
              Channels{chanFilter ? ` · ${chanFilter.length}` : ''}
              <ChevronDown className="h-3 w-3 text-faint" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="!w-64 !p-2">
            <button
              type="button"
              onClick={() => setChanFilter(null)}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-bold text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              All channels
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
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{label}</span>
                </label>
              );
            })}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-paper-dim"
            >
              Status{statusFilter ? ` · ${statusFilter.length}` : ''}
              <ChevronDown className="h-3 w-3 text-faint" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="!w-56 !p-2">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-bold text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              All statuses
            </button>
            {STATUS_OPTIONS.map((s) => {
              const meta = POST_STATUS_META[s];
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
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{meta.label}</span>
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
            className="text-xs font-bold text-muted transition hover:text-ink"
          >
            Clear
          </button>
        ) : null}
        <span className="flex-1" />
        <span className="text-xs text-faint">{sxEvents.length} shown</span>
      </div>
      </> )}

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

      {variant === 'mini' ? (
        mounted ? (
          <SXMount
            view="week"
            anchorKey={dayKey(anchor)}
            events={sxEvents}
            dark={dark}
            timeZone={timeZone}
            notify={setErr}
            resolveDrop={resolveDrop}
            onSelectPost={handleSelectPost}
            persistDrop={persistDrop}
          />
        ) : (
          <div className="min-h-[300px] animate-pulse rounded-2xl bg-paper-dim" />
        )
      ) : (
      <div className="min-w-0 flex-1 p-4">
        {view === 'year' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {MONTHS.map((name, m) => (
                <div
                  key={name}
                  className={`rounded-2xl border bg-card p-4 transition ${
                    m === anchor.getMonth() && anchor.getFullYear() === new Date().getFullYear()
                      ? 'border-accent shadow-sm'
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
                      className="text-sm font-extrabold transition hover:underline"
                    >
                      {name}
                    </button>
                    {yearCounts[m] ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-bolt-deep">
                        {yearCounts[m]}
                      </span>
                    ) : null}
                  </div>
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
                            }`}
                          >
                            <span
                              className={
                                isT
                                  ? 'flex h-4 w-4 items-center justify-center rounded-full bg-bolt font-extrabold text-on-accent'
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
              ))}
            </div>
              <p className="mt-3 text-xs text-faint">
                The whole year at a glance — dots mark days with posts. Pick a month to open it.
              </p>
            </>
          ) : view === 'list' ? (
            <>
              {listDays.length === 0 && undatedVisible.length === 0 ? (
                <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-sm text-muted">
                  Nothing scheduled in these 14 days.
                </p>
              ) : (
                <div className="mx-auto w-full max-w-3xl space-y-6">
                  {listDays.map((day) => (
                    <section key={day.key}>
                      <div className="mb-2 flex items-baseline gap-2 px-1">
                        <h2 className="font-display text-base font-extrabold tracking-tight">
                          {dayLabelFor(day.date, day.key)}
                        </h2>
                        <span className="text-xs text-faint">
                          {day.items.length} post{day.items.length === 1 ? '' : 's'}
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
                        <h2 className="font-display text-base font-extrabold tracking-tight">
                          No date yet
                        </h2>
                        <span className="text-xs text-faint">
                          {undatedVisible.length} draft{undatedVisible.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {undatedVisible
                          .slice(0, 10)
                          .map((p) => listRow(p, dayKey(new Date()), 'No date', true))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
              <p className="mt-3 text-xs text-faint">
                Click a post to open it. Dragging lives on the Day, Week and Month views.
              </p>
            </>
          ) : mounted ? (
          <div className={view === 'month' ? 'sx-height-auto' : undefined}>
            <SXMount
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
      )}

      {selectedPost && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Post details"
            >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSelectedPostId(null)}
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
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
            {selectedPost.status === 'sent' ? (
              <SentPostView
                post={selectedPost}
                mediaItems={(media[selectedPost.id] ?? []).slice(0, 4)}
                avatarOf={avatarOf}
                channelById={channelById}
                cleanHandle={cleanHandle}
                onDelete={() => void remove()}
                busy={pending}
              />
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
        : null}
    </div>
  );
}
