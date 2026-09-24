'use client';

import { useRef, useState } from 'react';
import { Image, Video } from 'lucide-react';
import { EmojiButton } from '@/components/Emoji';

export interface MediaItem {
  /** Present for freshly-picked files; absent for data-URL media from storage. */
  file?: File;
  kind: 'image' | 'video';
  url: string;
}

export interface Segment {
  body: string;
  media: MediaItem[];
}

/**
 * One composer box: media strip (hold + drag to rearrange) on top, text,
 * toolbar (photo, video, emoji) with a live counter. Used for the first
 * post, every thread part, and idea parts alike.
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
}) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const over = seg.body.length > limit;

  function pick(accept: string) {
    const el = fileRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  }

  return (
    <div className="rounded-xl border border-line bg-paper focus-within:border-ink/40">
      {/* Media strip — above the text, hold + drag to rearrange */}
      {seg.media.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto p-2 pb-0">
          {seg.media.map((f, i) => (
            <span
              key={`${f.file?.name ?? 'media'}-${i}`}
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
              className="relative block h-20 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-xl bg-paper-dim"
              title="Click to enlarge · drag to rearrange"
              onClick={() => setLightbox(f)}
            >
              {f.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={f.url} muted playsInline className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMedia(i);
                }}
                aria-label="Remove media"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] leading-none text-white"
              >
                ×
              </button>
              {seg.media.length > 1 ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[9px] font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
              ) : null}
            </span>
          ))}
        </div>
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
        className="min-h-[110px] w-full resize-y bg-transparent px-3 pt-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
      />

      <div className="flex items-center gap-0.5 border-t border-line-soft px-2 py-1.5">
        <button
          type="button"
          onClick={() => pick('image/*')}
          aria-label="Add photo"
          title="Add photo"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
        >
          <Image className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => pick('video/*')}
          aria-label="Add video"
          title="Add video"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
        >
          <Video className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="mx-1 h-4 w-px bg-line-soft" aria-hidden="true" />
        <EmojiButton align="top" onPick={(emoji) => onChange(seg.body + emoji)} />
        <span className="flex-1" />
        <span className={`text-[11px] ${over ? 'font-bold text-[#9F2F2D]' : 'text-faint'}`}>
          {seg.body.length} / {limit}
        </span>
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

      {/* Large / original preview */}
      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25"
          >
            ×
          </button>
          <div className="max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
            {lightbox.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt="Media preview" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
            ) : (
              <video src={lightbox.url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-2xl" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
