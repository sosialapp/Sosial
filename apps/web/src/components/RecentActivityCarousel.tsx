'use client';

import { useEffect, useRef, useState } from 'react';
import ChannelAvatar from '@/components/ChannelAvatar';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { POST_STATUS_META } from '@/lib/providers';
import type { MediaAssetRow, PostStatus } from '@/lib/types';

/** One dashboard carousel slide — plain JSON from the server. */
export interface RecentActivityItem {
  id: string;
  text: string;
  status: string;
  timeLabel: string;
  timeTitle: string;
  provider: string;
  authorName: string;
  authorHandle: string | null;
  avatar?: string;
  media: MediaAssetRow[];
}

const isPostStatus = (s: string): s is PostStatus => s in POST_STATUS_META;

/**
 * Recent activity as a social-style single-post carousel: avatar + handle +
 * time on top, text + media below, with a vertical dot rail on the right.
 * Scrolling over the card, swiping, or clicking a dot flips to the next post.
 */
export default function RecentActivityCarousel({ items }: { items: RecentActivityItem[] }) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  const wrapRef = useRef<HTMLDivElement>(null);
  const cool = useRef(0);
  const touchY = useRef<number | null>(null);

  // Wheel anywhere over the card flips posts and never moves the page
  // (non-passive so the card owns the gesture).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || count < 2) return;
    const onWheel = (e: WheelEvent) => {
      // Horizontal gestures (trackpad sideways, shift+wheel) pass through.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      const now = Date.now();
      if (now - cool.current < 900) return;
      cool.current = now;
      setIndex((i) => (i + (e.deltaY > 0 ? 1 : -1) + count) % count);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [count]);

  if (count === 0) return null;
  const item = items[((index % count) + count) % count]!;
  const meta = isPostStatus(item.status) ? POST_STATUS_META[item.status] : null;
  const media = item.media.slice(0, 4);

  return (
    <div
      ref={wrapRef}
      className="mt-4 flex touch-pan-x gap-2.5 select-none"
      onTouchStart={(e) => {
        touchY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchY.current == null || count < 2) return;
        const dy = touchY.current - (e.changedTouches[0]?.clientY ?? touchY.current);
        touchY.current = null;
        if (Math.abs(dy) < 40) return;
        setIndex((i) => (i + (dy > 0 ? 1 : -1) + count) % count);
      }}
    >
      <div className="min-w-0 flex-1">
        <article key={item.id}>
          {/* Header: avatar + name/handle + time + status */}
          <div className="flex items-center gap-2.5">
            <ChannelAvatar provider={item.provider} avatar={item.avatar} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold">{item.authorName}</span>
              <span className="flex items-center gap-1 text-[11px] text-faint">
                {item.authorHandle ? <span className="truncate">{item.authorHandle}</span> : null}
                {item.authorHandle ? (
                  <span aria-hidden="true">·</span>
                ) : null}
                <span className="shrink-0" title={item.timeTitle}>
                  {item.timeLabel}
                </span>
              </span>
            </span>
            {meta ? <span className={`pill shrink-0 ${meta.className}`}>{meta.label}</span> : null}
          </div>

          {/* Body: single text block */}
          {item.text ? (
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-soft">
              {item.text}
            </p>
          ) : (
            <p className="mt-2 text-[13px] italic text-faint">No text — media only.</p>
          )}

          {/* Media: centered, natural ratio, rail-sized */}
          {media.length > 0 && (
            <div className={`mt-2 flex flex-wrap justify-center gap-1 ${media.length > 1 ? 'max-w-[320px]' : ''}`}>
              {media.map((m) =>
                m.kind === 'video' ? (
                  <video
                    key={m.id}
                    src={m.signed_url}
                    muted
                    playsInline
                    controls
                    preload="metadata"
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
                      media.length > 1 ? 'max-h-[120px] max-w-[calc(50%-0.25rem)]' : 'max-h-[220px] max-w-full'
                    }`}
                  />
                ) : (
                  <span
                    key={m.id}
                    className="flex h-20 w-20 items-center justify-center rounded-xl border border-line bg-bone text-[10px] text-faint"
                  >
                    {m.kind}
                  </span>
                ),
              )}
            </div>
          )}
        </article>
      </div>

      {/* Dot rail: vertical, right side */}
      {count > 1 && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5" role="tablist" aria-label="Recent posts">
          {items.map((it, i) => {
            const on = i === ((index % count) + count) % count;
            return (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`Show post ${i + 1} of ${count}`}
                title={`Post ${i + 1} of ${count}`}
                onClick={() => setIndex(i)}
                className={`w-1.5 rounded-full transition-all ${
                  on ? 'h-5 bg-accent' : 'h-1.5 bg-line hover:bg-faint'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
