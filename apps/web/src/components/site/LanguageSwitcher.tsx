'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Globe } from 'lucide-react';
import { LOCALE_COOKIE, LOCALE_COOKIE_ATTRS, LOCALE_META, LOCALES, type Locale } from '@/lib/i18n/locales';

/**
 * Language switcher. Two shapes: the borderless globe + chevron pill in the desktop
 * nav, and a full-width "Language" row inside the mobile drawer, where the
 * list renders in flow so it can never hang off the viewport. Lists every
 * locale by its own native name, persists to the `sosial_locale` cookie and
 * refreshes so server components re-read it. Uses a tap-outside/Escape
 * listener instead of <details> so it also closes reliably on mobile.
 */
export default function LanguageSwitcher({
  locale,
  variant = 'icon',
  label,
}: {
  locale: Locale;
  variant?: 'icon' | 'menu';
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inline = variant === 'menu';

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; ${LOCALE_COOKIE_ATTRS}`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={rootRef} className={inline ? 'w-full' : 'relative'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label ?? 'Change language'}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          inline
            ? 'flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-soft hover:bg-card'
            : 'flex h-9 items-center gap-0.5 rounded-full px-1.5 text-muted transition hover:bg-accent-soft hover:text-ink'
        }
      >
        {inline ? (
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" aria-hidden="true" />
            {label}
          </span>
        ) : (
          <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={
            inline
              ? 'mt-1 w-full rounded-xl bg-card p-1'
              : 'card absolute right-0 top-full z-50 mt-2 w-44 p-1 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)]'
          }
          role="listbox"
          aria-label={label ?? 'Languages'}
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === locale}
              onClick={() => pick(l)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent-soft ${
                l === locale ? 'font-bold text-ink' : 'text-soft'
              }`}
            >
              {LOCALE_META[l].name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
