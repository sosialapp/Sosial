'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import { imageThumb, THUMB_WIDTHS } from '@/lib/media';
import { POST_STATUS_META } from '@/lib/providers';
import type { MediaAssetRow, PostStatus } from '@/lib/types';

/** Plain-JSON post preview — dashboard carousel, analytics tables, anywhere. */
export interface PreviewPostData {
  id: string;
  text: string;
  status: string;
  timeLabel: string;
  timeTitle?: string;
  provider: string;
  authorName: string;
  authorHandle: string | null;
  avatar?: string;
  media: MediaAssetRow[];
  stats?: { likes: number; comments: number; shares: number; views: number | null } | null;
}

const isPostStatus = (s: string): s is PostStatus => s in POST_STATUS_META;

/**
 * Shared read-only post preview popup: social header, full text, natural-ratio
 * media, optional stat strip. Rendered into document.body so no ancestor can
 * trap it. Backdrop click, ✕, Escape, or the Close button dismisses it.
 */
export default function PostPreviewDialog({
  post,
  onClose,
}: {
  post: PreviewPostData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [post, onClose]);

  if (!post || typeof document === 'undefined') return null;
  const meta = isPostStatus(post.status) ? POST_STATUS_META[post.status] : null;
  const media = (post.media ?? []).slice(0, 4);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Post preview"
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <ChannelAvatar provider={post.provider} avatar={post.avatar} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{post.authorName}</span>
            <span className="flex items-center gap-1 text-xs text-faint">
              {post.authorHandle ? <span className="truncate">{post.authorHandle}</span> : null}
              {post.authorHandle ? <span aria-hidden="true">·</span> : null}
              <span className="shrink-0" title={post.timeTitle}>
                {post.timeLabel}
              </span>
            </span>
          </span>
          {meta ? <span className={`pill shrink-0 ${meta.className}`}>{meta.label}</span> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-muted transition hover:bg-paper-dim hover:text-ink"
          >
            ✕
          </button>
        </div>

        {post.text ? (
          <p className="mt-3 max-h-[30vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-soft">
            {post.text}
          </p>
        ) : (
          <p className="mt-3 text-sm italic text-faint">No text — media only.</p>
        )}

        {media.length > 0 ? (
          <div
            className={`mt-3 flex flex-wrap justify-center gap-1.5 ${media.length > 1 ? 'mx-auto max-w-[320px]' : ''}`}
          >
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
              ) : null,
            )}
          </div>
        ) : null}

        {post.stats ? (
          <div className="mt-3 flex items-center gap-4 rounded-xl bg-paper-dim px-3 py-2 text-xs font-bold text-muted">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              {post.stats.likes.toLocaleString('en-US')}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {post.stats.comments.toLocaleString('en-US')}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              {post.stats.shares.toLocaleString('en-US')}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {post.stats.views === null ? '—' : post.stats.views.toLocaleString('en-US')}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="btn btn-sm mt-4 w-full border border-line bg-paper"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
