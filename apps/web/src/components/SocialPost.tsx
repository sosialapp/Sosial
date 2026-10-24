'use client';

/**
 * A post drawn the way it reads in a feed: the account's face and name on
 * the left rail, handle and time beside the name, the text with #tags,
 * @mentions and links picked out, media in the familiar 1 / 2 / 3 / 4-up
 * grid, and the reply / repost / like / views bar underneath.
 *
 * Pure presentation: callers decide what the post is (queued, sent, a
 * thread part) and pass a context line ("Scheduled for Tue 9:00"), the
 * status badge and any footer actions. Thread parts stack with `threaded`,
 * which draws the connecting line down the avatar rail.
 */

import { Fragment, useState, type ReactNode } from 'react';
import { BarChart3, Heart, MessageCircle, Play, Repeat2, Share } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import SafeImg from '@/components/SafeImg';

export interface SocialMedia {
  id: string;
  kind: 'image' | 'video';
  src: string;
  poster?: string | null;
  /** Pixel size when known, so a lone item keeps its shape before it loads. */
  width?: number | null;
  height?: number | null;
}

export interface SocialMetrics {
  comments: number;
  reposts: number;
  likes: number;
  views: number | null;
}

/** Social-style compact counts: 950, 1.2K, 3.4M. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** #tags, @mentions and links in the brand blue; everything else plain. */
function RichText({ text }: { text: string }) {
  // Links (with or without a scheme, as long as a path or www marks them),
  // #tags, and @handles that may contain dots but never end on one.
  const parts = text.split(
    /((?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*|#[\p{L}\p{N}_]+|@[\p{L}\p{N}_](?:[\p{L}\p{N}_.]*[\p{L}\p{N}_])?)/giu,
  );
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-sky">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Tile({ m, className, natural }: { m: SocialMedia; className: string; natural?: boolean }) {
  return m.kind === 'video' ? (
    <span className={`relative block overflow-hidden bg-black ${className}`}>
      <video
        src={m.src}
        poster={m.poster ?? undefined}
        muted
        playsInline
        controls
        preload="metadata"
        className={natural ? 'block max-h-[400px] w-auto max-w-full' : 'block h-full max-h-[inherit] w-full object-cover'}
      />
      <span className="pointer-events-none absolute top-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
        <Play className="h-3 w-3 fill-current" aria-hidden="true" />
      </span>
    </span>
  ) : (
    <SafeImg src={m.src} alt="" loading="lazy" className={`block bg-surface object-cover ${className}`} />
  );
}

/** Feed media grid: one tall, two side by side, three as 1 + 2, four as 2 × 2. */
export function MediaGrid({ media }: { media: SocialMedia[] }) {
  const shown = media.slice(0, 4);
  const extra = media.length - shown.length;
  if (!shown.length) return null;
  if (shown.length === 1) {
    // A lone item keeps its own shape (vertical, square, wide), as feeds show
    // it: at most 400px tall and 448px wide, never cropped to one frame.
    const m = shown[0];
    const ratio = m.width && m.height ? m.width / m.height : null;
    if (ratio) {
      return (
        <div
          className="mt-3 max-w-md overflow-hidden rounded-2xl border border-line"
          style={{ aspectRatio: ratio, width: `min(100%, ${Math.round(400 * ratio)}px)` }}
        >
          <Tile m={m} className="h-full w-full" />
        </div>
      );
    }
    // Unknown size: let the media lay itself out at its natural ratio.
    return (
      <div className="mt-3 w-fit max-w-full overflow-hidden rounded-2xl border border-line sm:max-w-md">
        <Tile m={m} className="max-h-[400px] w-auto max-w-full" natural />
      </div>
    );
  }
  return (
    <div
      className={`mt-3 grid aspect-[16/10] max-w-md gap-0.5 overflow-hidden rounded-2xl border border-line ${
        shown.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'
      }`}
    >
      {shown.map((m, i) => (
        <span key={m.id} className={`relative min-h-0 ${shown.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
          <Tile m={m} className="h-full w-full" />
          {extra > 0 && i === shown.length - 1 ? (
            <span className="absolute inset-0 grid place-items-center bg-black/50 font-display text-2xl font-extrabold text-white">
              +{extra}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function Action({ icon: Icon, value, label }: { icon: typeof Heart; value?: number | null; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums" title={label}>
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {value != null && value > 0 ? compact(value) : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default function SocialPost({
  author,
  time,
  timeTitle,
  title,
  body,
  media = [],
  context,
  badge,
  metrics,
  notes,
  footer,
  threaded = false,
  clamp = 6,
  onOpen,
  emptyLabel = 'No text',
}: {
  author: { name: string; handle?: string | null; provider: string; avatar?: string };
  /** Short relative time next to the handle ("2h", "Mar 4", "in 3d"). */
  time?: string;
  timeTitle?: string;
  /** Article headline, shown bold above the text when the channel has one. */
  title?: string | null;
  body: string;
  media?: SocialMedia[];
  /** Small line above the post, like a feed's "Pinned" or "Reposted" row. */
  context?: { icon: ReactNode; text: ReactNode; tone?: 'muted' | 'danger' | 'accent' };
  /** Top-right slot (status pill, thread count). */
  badge?: ReactNode;
  /** Live numbers once sent; omitted, the bar shows bare icons like an unposted draft. */
  metrics?: SocialMetrics | null;
  /** Errors, reviewer comments: shown under the text, above the media. */
  notes?: ReactNode;
  /** Management row under the action bar (edit, approve, delete…). */
  footer?: ReactNode;
  /** Draw the thread line down from the avatar to the next part. */
  threaded?: boolean;
  /** Lines before "Show more"; 0 never clamps. */
  clamp?: number;
  onOpen?: () => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = clamp > 0 && (body.length > clamp * 60 || body.split('\n').length > clamp);
  const toneCls =
    context?.tone === 'danger' ? 'text-[#9F2F2D] dark:text-[#f2a8a8]' : context?.tone === 'accent' ? 'text-ink' : 'text-muted';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {context ? <span className="h-5" aria-hidden="true" /> : null}
        <ChannelAvatar provider={author.provider} avatar={author.avatar} size={40} />
        {threaded ? <span className="mt-1 w-0.5 flex-1 rounded-full bg-line" aria-hidden="true" /> : null}
      </div>
      <div className={`min-w-0 flex-1 ${threaded ? 'pb-4' : ''}`}>
        {context ? (
          <p className={`flex h-5 items-center gap-1.5 text-xs font-bold ${toneCls}`}>
            <span className="inline-flex [&>svg]:h-3.5 [&>svg]:w-3.5">{context.icon}</span>
            {context.text}
          </p>
        ) : null}
        <div className="flex items-start gap-2">
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 leading-tight">
            <span className="truncate text-[15px] font-bold text-ink">{author.name}</span>
            {author.handle ? <span className="truncate text-sm text-muted">{author.handle}</span> : null}
            {time ? (
              <span className="shrink-0 text-sm text-muted" title={timeTitle}>
                · {time}
              </span>
            ) : null}
          </p>
          {badge ? <span className="flex shrink-0 items-center gap-1.5">{badge}</span> : null}
        </div>

        <div
          role={onOpen ? 'button' : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen}
          onKeyDown={
            onOpen
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen();
                  }
                }
              : undefined
          }
          className={onOpen ? 'cursor-pointer' : undefined}
        >
          {title ? <p className="mt-1 font-display text-base font-extrabold tracking-tight">{title}</p> : null}
          {body ? (
            <p
              className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.45] text-ink"
              style={long && !open ? { display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
            >
              <RichText text={body} />
            </p>
          ) : !title ? (
            <p className="mt-1 text-sm italic text-faint">{emptyLabel}</p>
          ) : null}
          {long ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="mt-0.5 text-sm font-bold text-sky hover:underline"
            >
              {open ? 'Show less' : 'Show more'}
            </button>
          ) : null}
          {notes ? <div className="mt-2 space-y-1">{notes}</div> : null}
          <MediaGrid media={media} />
        </div>

        {/* Real numbers only: without stats the icons said nothing, so the bar hides. */}
        {metrics ? (
          <div className="mt-2.5 flex max-w-md items-center justify-between pr-2 text-muted" aria-label="Engagement">
            <Action icon={MessageCircle} value={metrics.comments} label="Replies" />
            <Action icon={Repeat2} value={metrics.reposts} label="Reposts" />
            <Action icon={Heart} value={metrics.likes} label="Likes" />
            <Action icon={BarChart3} value={metrics.views} label="Views" />
            <Share className="h-[18px] w-[18px]" aria-label="Share" />
          </div>
        ) : null}

        {footer ? <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}
