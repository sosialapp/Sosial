'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Smile, X } from 'lucide-react';
import { useDismiss } from '@/lib/useDismiss';

/** The only picker UI library — full emoji menu with search, loaded on demand. */
const EmojiPicker = dynamic(() => import('@/components/EmojiPickerClient'), {
  ssr: false,
  loading: () => <div className="p-6 text-center text-xs text-faint">Loading emoji…</div>,
});

const PANEL_W = 340;
/** Estimated panel height used to decide whether to open up or down. */
const PANEL_H = 424;
const GAP = 8;
const MARGIN = 8;
const HEADER_H = 40;

/** Insert `text` at the caret of a text field; returns the next value, restoring the caret. */
function insertAtCaret(el: HTMLTextAreaElement | HTMLInputElement | null, text: string): string | null {
  if (!el) return null;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  const caret = start + text.length;
  requestAnimationFrame(() => {
    el.focus();
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* detached */
    }
  });
  return next;
}

/**
 * The smiley toolbar button + popover, shared by every emoji-capable input.
 * The popover is portaled and anchored to the button (flipping up/down to
 * stay on screen), and closes on outside click or Escape.
 */
export function EmojiButton({
  onPick,
  align = 'bottom',
  className,
}: {
  onPick: (emoji: string) => void;
  /** Preferred opening direction when both fit. */
  align?: 'top' | 'bottom';
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<CSSProperties>({});
  const close = useCallback(() => setOpen(false), []);
  useDismiss([btnRef, panelRef], open, close);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_W, vw - MARGIN * 2);
    const height = Math.min(PANEL_H, vh - MARGIN * 2);
    let left = r.right - width;
    left = Math.min(Math.max(MARGIN, left), vw - width - MARGIN);

    const roomBelow = vh - r.bottom - GAP - MARGIN;
    const roomAbove = r.top - GAP - MARGIN;
    const openUp =
      align === 'top' ? roomAbove >= height || roomAbove >= roomBelow : roomBelow < height && roomAbove > roomBelow;
    let top = openUp ? r.top - GAP - height : r.bottom + GAP;
    top = Math.min(Math.max(MARGIN, top), vh - MARGIN - height);
    setBox({ left, top, width, height });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const panelH = typeof box.height === 'number' ? box.height : PANEL_H;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert emoji"
        aria-expanded={open}
        title="Insert emoji"
        className={
          className ??
          'flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink'
        }
      >
        <Smile className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Emoji picker"
              style={box}
              className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-card p-2 shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
            >
              <div className="flex shrink-0 items-center justify-between pl-2 pr-1" style={{ height: HEADER_H }}>
                <span className="text-xs font-extrabold uppercase tracking-wide text-faint">Emoji</span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close emoji picker"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <EmojiPicker
                height={Math.max(220, panelH - HEADER_H - 16)}
                onPick={(emoji) => {
                  onPick(emoji);
                  setOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** A textarea with the shared emoji button beneath it. Drop-in for the plain one. */
export function EmojiTextarea({
  value,
  onChange,
  className,
  buttonClassName,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  /** Extra classes for the emoji button (e.g. to match a themed toolbar). */
  buttonClassName?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
      <div className="-mt-0.5 flex justify-end">
        <EmojiButton
          align="bottom"
          className={buttonClassName}
          onPick={(emoji) => onChange(insertAtCaret(ref.current, emoji) ?? value + emoji)}
        />
      </div>
    </div>
  );
}

/** A single-line text input with the shared emoji button beneath it. Drop-in for the plain one. */
export function EmojiInput({
  value,
  onChange,
  className,
  buttonClassName,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  /** Extra classes for the emoji button (e.g. to match a themed toolbar). */
  buttonClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
      <div className="-mt-0.5 flex justify-end">
        <EmojiButton
          align="bottom"
          className={buttonClassName}
          onPick={(emoji) => onChange(insertAtCaret(ref.current, emoji) ?? value + emoji)}
        />
      </div>
    </div>
  );
}
