'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Shared pieces of the one-box AI prompts (AiCard, studio AiStudioPanel):
 * small option chips with their own popover, menu rows and a toggle.
 */

/** iOS-style toggle, yellow when on. */
export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`}
      />
    </button>
  );
}

/** Small inline option chip with its own popover. */
export function Chip({
  label,
  open,
  onOpen,
  children,
  align = 'left',
  active = false,
}: {
  label: ReactNode;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
  active?: boolean;
}) {
  return (
    <span className="relative" data-ai-menu>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
          active
            ? 'border-[#5B3DF0]/40 bg-[#5B3DF0]/10 text-[#4A2FD6] dark:text-[#C9B9FA]'
            : 'border-line bg-paper text-soft hover:text-ink'
        }`}
      >
        {label}
        <ChevronDown className={`h-3 w-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1.5 w-64 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)] ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

export function MenuRow({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold transition hover:bg-paper-dim ${on ? 'bg-accent-soft text-accent-ink' : ''}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {on ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
    </button>
  );
}


/** Close an open chip popover on an outside click or Escape. */
export function useMenuDismiss(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('[data-ai-menu]')) closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
}
