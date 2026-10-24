'use client';

import { useRef, useState } from 'react';
import { Image as ImageIcon, ChevronDown, Film, Plus, X } from 'lucide-react';
import { EmojiButton } from '@/components/Emoji';
import ChannelAvatar from '@/components/ChannelAvatar';
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

/** An account the post goes out as (one face in the stack). */
export interface PostAuthor {
  id: string;
  provider: string;
  avatar?: string;
  name: string;
}

/**
 * One composer box. A header stacks the faces of every account the post goes
 * to ("Posting to …"), then the text, then the media strip (compact tiles,
 * hold + drag to rearrange, a + tile to add more), then a toolbar of labelled
 * Media / Emoji buttons with a ring counter. Used for the first post, every
 * thread part, and idea parts (which have no accounts, so no header).
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
  authors,
  partLabel,
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
  /** Accounts the post goes to; omitted for ideas. Empty = none picked yet. */
  authors?: PostAuthor[];
  /** Thread part tag shown on the header's right ("2/4"). */
  partLabel?: string;
}) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const t = useT(appMessages);
  const mediaBtnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dragFrom = useRef<number | null>(null);
  const over = seg.body.length > limit;

  function pick(accept: string) {
    const el = fileRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  }

  /** Emoji lands at the caret, not just at the end. */
  function insertEmoji(emoji: string) {
    const el = textRef.current;
    if (!el) return onChange(seg.body + emoji);
    const start = el.selectionStart ?? seg.body.length;
    const end = el.selectionEnd ?? seg.body.length;
    onChange(seg.body.slice(0, start) + emoji + seg.body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  // Ring counter: fills as you type, amber near the limit, red past it.
  const used = seg.body.length;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const left = limit - used;
  const near = left <= Math.max(20, limit * 0.1);
  const ringTone = over ? '#E5484D' : near ? '#F2A400' : 'var(--color-ink)';
  const R = 8;
  const CIRC = 2 * Math.PI * R;

  const stack = authors?.slice(0, 5) ?? [];
  const extra = (authors?.length ?? 0) - stack.length;
  const names = authors?.map((a) => a.name) ?? [];
  const toLine =
    names.length === 0
      ? 'Pick accounts above'
      : names.length <= 2
        ? names.join(' & ')
        : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;

  const toolBtn =
    'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-soft transition hover:bg-surface hover:text-ink';

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card transition focus-within:border-ink/35 focus-within:shadow-[0_0_0_3px_rgba(255,198,46,0.18)]">
      {/* Who it goes out as: every picked account, stacked. */}
      {authors ? (
        <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5 py-2.5">
          {stack.length ? (
            <span className="flex shrink-0 items-center">
              {stack.map((a, i) => (
                <span
                  key={a.id}
                  className="rounded-full ring-2 ring-card"
                  style={{ marginLeft: i ? -9 : 0, zIndex: stack.length - i }}
                  title={a.name}
                >
                  <ChannelAvatar provider={a.provider} avatar={a.avatar} size={28} />
                </span>
              ))}
              {extra > 0 ? (
                <span className="-ml-2 grid h-7 min-w-7 place-items-center rounded-full bg-surface px-1.5 text-[10px] font-extrabold text-muted ring-2 ring-card">
                  +{extra}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-line" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate text-xs">
            <span className="text-faint">{names.length ? 'Posting to ' : ''}</span>
            <span className={`font-bold ${names.length ? 'text-soft' : 'text-faint'}`}>{toLine}</span>
          </span>
          {partLabel ? <span className="shrink-0 text-[11px] font-bold text-faint">{partLabel}</span> : null}
        </div>
      ) : null}

      <textarea
        ref={textRef}
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
        className="block min-h-[110px] w-full resize-y bg-transparent px-4 pt-3 pb-2 text-base leading-relaxed text-ink placeholder:text-faint focus:outline-none sm:text-[15px]"
      />

      {/* Media strip: compact tiles, hold + drag to rearrange, + to add more. */}
      {seg.media.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
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
              className="group/tile relative block h-20 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-xl bg-surface ring-1 ring-line"
              title={t('pbEnlarge')}
              onClick={() => {
                if (f.url) setLightbox(f);
              }}
            >
              {!f.url ? (
                // Stored asset whose signed preview expired: keep the tile (and
                // the asset id) so saving still carries the media.
                <span className="flex h-full w-full items-center justify-center text-ink/40">
                  {f.kind === 'image' ? <ImageIcon className="h-6 w-6" aria-hidden="true" /> : <Film className="h-6 w-6" aria-hidden="true" />}
                </span>
              ) : f.kind === 'image' ? (
                <SafeImg
                  src={f.url}
                  alt=""
                  className="h-full w-full object-cover"
                  fallback={
                    <span className="flex h-full w-full items-center justify-center text-ink/40">
                      <ImageIcon className="h-6 w-6" aria-hidden="true" />
                    </span>
                  }
                />
              ) : (
                <>
                  <video src={f.url} muted playsInline className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white" aria-hidden="true">
                    Video
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMedia(i);
                }}
                aria-label={t('pbRemoveMedia')}
                className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white opacity-90 transition hover:bg-black/80 group-hover/tile:opacity-100"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
              {seg.media.length > 1 && f.kind !== 'video' ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[9px] font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
              ) : null}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setSourcesOpen(true)}
            aria-label={t('pbAddMedia')}
            className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-dashed border-line text-faint transition hover:border-ink/40 hover:text-ink"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-1 border-t border-line-soft px-2 py-1.5">
        <button
          type="button"
          ref={mediaBtnRef}
          onClick={() => setSourcesOpen(true)}
          aria-label={t('pbAddMedia')}
          title={t('pbAddMedia')}
          className={toolBtn}
        >
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Media</span>
          <ChevronDown className="h-3 w-3 text-faint" aria-hidden="true" />
        </button>
        <EmojiButton align="top" onPick={insertEmoji} className={toolBtn} label="Emoji" />
        <span className="flex-1" />
        <span className="flex items-center gap-2 pr-1.5" title={`${used} / ${limit}`}>
          {used > 0 && near ? (
            <span className={`text-xs font-bold tabular-nums ${over ? 'text-[#E5484D]' : 'text-muted'}`}>{left}</span>
          ) : (
            <span className="text-[11px] tabular-nums text-faint">
              {used} / {limit}
            </span>
          )}
          <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90" aria-hidden="true">
            <circle cx="10" cy="10" r={R} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
            <circle
              cx="10"
              cy="10"
              r={R}
              fill="none"
              stroke={ringTone}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - ratio)}
              className="transition-[stroke-dashoffset] duration-200"
            />
          </svg>
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
