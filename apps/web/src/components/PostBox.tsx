'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

/** The only UI library besides gsap — full emoji menu with search. */
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <div className="p-2 text-xs text-faint">Loading…</div>,
});

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
  onAddFiles: (list: FileList | null) => void;
  onRemoveMedia: (i: number) => void;
  onReorderMedia: (from: number, to: number) => void;
  placeholder: string;
  rows?: number;
  limit: number;
  label: string;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
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
              className="relative block h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-xl bg-paper-dim active:cursor-grabbing"
              title="Drag to rearrange"
            >
              {f.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={f.url} muted playsInline className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onRemoveMedia(i)}
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
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
            <circle cx="7" cy="7" r="1.4" />
            <path d="m4.5 15.5 4-4 2.5 2.5 2-2 2.5 2.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => pick('video/*')}
          aria-label="Add video"
          title="Add video"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="12.5" height="12" rx="2.5" />
            <path d="m14.5 10 3.5-2.5v5L14.5 10Z" />
          </svg>
        </button>
        <span className="mx-1 h-4 w-px bg-line-soft" aria-hidden="true" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
              <circle cx="10" cy="10" r="6.5" />
              <path d="M7.5 8.2h.01M12.5 8.2h.01M7.5 12c.7.8 1.6 1.2 2.5 1.2s1.8-.4 2.5-1.2" />
            </svg>
          </button>
          {emojiOpen ? (
            <div className="absolute bottom-9 left-0 z-30 rounded-xl border border-line bg-card shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]" role="dialog" aria-label="Emoji picker">
              <EmojiPicker
                onEmojiClick={(d: { emoji: string }) => {
                  onChange(seg.body + d.emoji);
                  setEmojiOpen(false);
                }}
                searchPlaceholder="Search emoji…"
                width={320}
                height={380}
                previewConfig={{ showPreview: false }}
              />
            </div>
          ) : null}
        </div>
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
    </div>
  );
}
