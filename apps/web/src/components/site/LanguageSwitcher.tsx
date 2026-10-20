'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { LOCALE_COOKIE, LOCALE_COOKIE_ATTRS, LOCALE_META, LOCALES, type Locale } from '@/lib/i18n/locales';

/**
 * Top-of-site language switcher: borderless globe + chevron, lists every
 * locale by its own native name, persists to the `sosial_locale` cookie and
 * refreshes so server components re-read it. Uses a tap-outside/Escape
 * listener instead of <details> so it also closes reliably on mobile.
 */
export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 items-center gap-0.5 rounded-full px-1.5 text-muted transition hover:bg-accent-soft hover:text-ink"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="card absolute right-0 top-full z-50 mt-2 w-44 p-1 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)]" role="listbox" aria-label="Languages">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === locale}
              onClick={() => pick(l)}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition hover:bg-accent-soft ${l === locale ? 'font-bold text-ink' : 'text-soft'}`}
            >
              {LOCALE_META[l].name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
