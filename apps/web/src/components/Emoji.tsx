'use client';

import dynamic from 'next/dynamic';
import { useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** The only picker UI library — full emoji menu with search, loaded on demand. */
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <div className="p-2 text-xs text-faint">Loading…</div>,
});

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

/** The smiley toolbar button + popover, shared by every emoji-capable input. */
export function EmojiButton({
  onPick,
  align = 'top',
  className,
}: {
  onPick: (emoji: string) => void;
  /** Which way the popover opens relative to the button. */
  align?: 'top' | 'bottom';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
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
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <path d="M7.5 8.2h.01M12.5 8.2h.01M7.5 12c.7.8 1.6 1.2 2.5 1.2s1.8-.4 2.5-1.2" />
        </svg>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className={`absolute z-40 rounded-xl border border-line bg-card shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)] ${
            align === 'top' ? 'bottom-9 left-0' : 'top-9 right-0'
          }`}
        >
          <EmojiPicker
            onEmojiClick={(d: { emoji: string }) => {
              onPick(d.emoji);
              setOpen(false);
            }}
            searchPlaceholder="Search emoji…"
            width={320}
            height={380}
            previewConfig={{ showPreview: false }}
          />
        </div>
      ) : null}
    </div>
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
          align="top"
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
          align="top"
          className={buttonClassName}
          onPick={(emoji) => onChange(insertAtCaret(ref.current, emoji) ?? value + emoji)}
        />
      </div>
    </div>
  );
}
