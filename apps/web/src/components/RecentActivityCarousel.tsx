'use client';

import { useEffect, useRef, useState } from 'react';
import SocialPost from '@/components/SocialPost';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { POST_STATUS_META } from '@/lib/providers';
import type { MediaAssetRow, PostStatus } from '@/lib/types';

/** One dashboard carousel slide, plain JSON from the server. */
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
 * Recent activity as a single-post carousel, each slide drawn as a feed
 * post (SocialPost), with a vertical dot rail on the right.
 * Scrolling over the card, swiping, or clicking a dot flips to the next post.
 */
export default function RecentActivityCarousel({
  items,
  onOpen,
}: {
  items: RecentActivityItem[];
  /** Single click / tap on the post (not a rail/dot/wheel swipe) opens it. */
  onOpen?: (item: RecentActivityItem) => void;
}) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  const wrapRef = useRef<HTMLDivElement>(null);
  const cool = useRef(0);
  const touchY = useRef<number | null>(null);
  // Last swipe/wheel navigation time, a click right after a swipe is the
  // swipe's own tap, not an open-preview intent.
  const navAt = useRef(0);

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
      navAt.current = now;
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
        navAt.current = Date.now();
        setIndex((i) => (i + (dy > 0 ? 1 : -1) + count) % count);
      }}
    >
      <div className="min-w-0 flex-1">
        <article
          key={item.id}
          onClick={() => {
            if (!onOpen || Date.now() - navAt.current < 600) return;
            onOpen(item);
          }}
          title={onOpen ? 'Open preview' : undefined}
          className={onOpen ? 'cursor-pointer rounded-xl' : undefined}
        >
          <SocialPost
            author={{ name: item.authorName, handle: item.authorHandle, provider: item.provider, avatar: item.avatar }}
            time={item.timeLabel}
            timeTitle={item.timeTitle}
            badge={meta ? <span className={`pill shrink-0 ${meta.className}`}>{meta.label}</span> : undefined}
            body={item.text}
            emptyLabel="No text, media only."
            clamp={4}
            media={media
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
          />
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
