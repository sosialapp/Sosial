'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Image, ChevronDown, Film, X } from 'lucide-react';
import { EmojiButton } from '@/components/Emoji';
import SafeImg from '@/components/SafeImg';
import MediaSourcesDialog from '@/components/MediaSourcesDialog';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';

export interface MediaItem {
  /** Present for freshly-picked files; absent for media loaded from a post. */
  file?: File;
  /** Existing media_assets row (draft edit): reused on save, never re-uploaded. */
  assetId?: string;
  kind: 'image' | 'video';
  /** Preview URL. Empty when the stored asset could not be signed. */
  url: string;
}

export interface Segment {
  body: string;
  media: MediaItem[];
}

/**
 * One composer box, laid out like writing a post on X or Threads: the
 * posting account's face on the left (with the thread line running down to
 * the next part), the text, media previewed the way the feed will show it
 * (hold + drag to rearrange), then the media / emoji tools and a ring
 * counter. Used for the first post, every thread part, and idea parts.
 */
export default function PostBox({
  seg,
  onChange,
  onAddFiles,
  onRemoveMedia,
  onReorderMedia,
  placeholder,
  rows = 5,
  limit,
  label,
  author,
  threaded = false,
}: {
  seg: Segment;
  onChange: (body: string) => void;
  onAddFiles: (list: FileList | File[] | null) => void;
  onRemoveMedia: (i: number) => void;
  onReorderMedia: (from: number, to: number) => void;
  placeholder: string;
  rows?: number;
  limit: number;
  label: string;
  /** Who this posts as: avatar on the rail, name above the text. */
  author?: { name: string; handle?: string | null; avatar: ReactNode };
  /** Draw the thread line from the avatar down toward the next part. */
  threaded?: boolean;
}) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const t = useT(appMessages);
  const mediaBtnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const over = seg.body.length > limit;

  function pick(accept: string) {
    const el = fileRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  }

  // Ring counter, the way social composers show it: fills as you type, turns
  // amber near the limit and red past it, with the remaining count close in.
  const used = seg.body.length;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const left = limit - used;
  const ringTone = over ? '#E5484D' : left <= Math.max(20, limit * 0.1) ? '#F2A400' : 'var(--color-sky)';
  const R = 9;
  const C = 2 * Math.PI * R;
  const many = seg.media.length > 1;

  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-3 transition focus-within:border-ink/30 sm:p-4">
      {author ? (
        <div className="flex shrink-0 flex-col items-center">
          {author.avatar}
          {threaded ? <span className="mt-1.5 w-0.5 flex-1 rounded-full bg-line" aria-hidden="true" /> : null}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        {author?.name ? (
          <p className="flex min-w-0 items-baseline gap-1.5 leading-tight">
            <span className="truncate text-[15px] font-bold text-ink">{author.name}</span>
            {author.handle ? <span className="truncate text-sm text-muted">{author.handle}</span> : null}
          </p>
        ) : null}

        <textarea
          value={seg.body}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
              f.type.startsWith('image/') || f.type.startsWith('video/'),
            );
            if (files.length) {
              e.preventDefault();
              onAddFiles(files);
            }
          }}
          placeholder={placeholder}
          rows={rows}
          aria-label={label}
          className="mt-1 min-h-[96px] w-full resize-y bg-transparent text-base leading-relaxed text-ink placeholder:text-faint focus:outline-none sm:text-[15px]"
        />

        {/* Media as it will sit in the feed: one large, or a grid. Hold + drag to reorder. */}
        {seg.media.length > 0 ? (
          <div className={`mt-2 grid gap-1.5 ${many ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {seg.media.map((f, i) => (
              <span
                key={`${f.assetId ?? f.file?.name ?? 'media'}-${i}`}
                draggable
                onDragStart={() => {
                  dragFrom.current = i;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  if (from !== null && from !== i) {
                    onReorderMedia(from, i);
                    dragFrom.current = i;
                  }
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                }}
                className={`relative block cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-surface ${
                  many ? 'aspect-square' : 'max-h-[360px]'
                }`}
                title={t('pbEnlarge')}
                onClick={() => {
                  if (f.url) setLightbox(f);
                }}
              >
                {!f.url ? (
                  // Stored asset whose signed preview expired: keep the tile (and
                  // the asset id) so saving still carries the media.
                  <span className="flex h-full min-h-32 w-full items-center justify-center text-ink/40">
                    {f.kind === 'image' ? <Image className="h-6 w-6" aria-hidden="true" /> : <Film className="h-6 w-6" aria-hidden="true" />}
                  </span>
                ) : f.kind === 'image' ? (
                  <SafeImg
                    src={f.url}
                    alt=""
                    className={`w-full object-cover ${many ? 'h-full' : 'max-h-[360px]'}`}
                    fallback={
                      <span className="flex h-full min-h-32 w-full items-center justify-center text-ink/40">
                        <Image className="h-6 w-6" aria-hidden="true" />
                      </span>
                    }
                  />
                ) : (
                  <video src={f.url} muted playsInline className={`w-full object-cover ${many ? 'h-full' : 'max-h-[360px]'}`} />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMedia(i);
                  }}
                  aria-label={t('pbRemoveMedia')}
                  className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur-sm transition hover:bg-black/80"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
                {many ? (
                  <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex items-center gap-0.5 border-t border-line-soft pt-2">
          <button
            type="button"
            ref={mediaBtnRef}
            onClick={() => setSourcesOpen(true)}
            aria-label={t('pbAddMedia')}
            title={t('pbAddMedia')}
            className="flex h-8 items-center gap-0.5 rounded-full px-2 text-sky transition hover:bg-sky/10"
          >
            <Image className="h-[18px] w-[18px]" aria-hidden="true" />
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
          <span className="text-sky [&_button]:rounded-full [&_button:hover]:bg-sky/10">
            <EmojiButton align="top" onPick={(emoji) => onChange(seg.body + emoji)} />
          </span>
          <span className="flex-1" />
          {used > 0 ? (
            <span className="flex items-center gap-2" title={`${used} / ${limit}`}>
              {left <= Math.max(20, limit * 0.1) ? (
                <span className={`text-xs font-bold tabular-nums ${over ? 'text-[#E5484D]' : 'text-muted'}`}>{left}</span>
              ) : null}
              <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden="true">
                <circle cx="12" cy="12" r={R} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
                <circle
                  cx="12"
                  cy="12"
                  r={R}
                  fill="none"
                  stroke={ringTone}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - ratio)}
                  className="transition-[stroke-dashoffset] duration-200"
                />
              </svg>
              <span className="sr-only">
                {used} / {limit}
              </span>
            </span>
          ) : (
            <span className="text-[11px] tabular-nums text-faint">0 / {limit}</span>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <MediaSourcesDialog
        open={sourcesOpen}
        getAnchor={() => {
          const r = mediaBtnRef.current?.getBoundingClientRect();
          return r ? { left: r.left, topEdge: r.top, bottom: r.bottom } : null;
        }}
        onClose={() => setSourcesOpen(false)}
        onPickLocal={() => pick('image/*,video/*')}
        onAttach={(files, credit) => {
          onAddFiles(files);
          if (credit && !seg.body.includes('Unsplash')) {
            onChange(`${seg.body.trim()}\n\n${credit}`.trim());
          }
        }}
      />

      {/* Large / original preview */}
      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('pbPreview')}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label={t('pbClosePreview')}
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25"
          >
            ×
          </button>
          <div className="max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
            {lightbox.kind === 'image' ? (
              <SafeImg src={lightbox.url} alt="Media preview" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
            ) : (
              <video src={lightbox.url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-2xl" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
