'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { LOCALE_COOKIE, LOCALE_COOKIE_ATTRS, LOCALE_META, LOCALES, type Locale } from '@/lib/i18n/locales';

/**
 * Top-of-site language switcher: lists every locale by its own native name,
 * persists to the `sosial_locale` cookie and refreshes so server components
 * re-read it. Current locale arrives via client context (SiteNav).
 */
export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const pick = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; ${LOCALE_COOKIE_ATTRS}`;
    setOpen(false);
    router.refresh();
  };

  const current = LOCALE_META[locale].name;

  return (
    <details
      className="relative"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-xs font-bold text-soft transition hover:border-ink hover:text-ink [&::-webkit-details-marker]:hidden"
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="max-w-20 truncate">{current}</span>
      </summary>
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
    </details>
  );
}
