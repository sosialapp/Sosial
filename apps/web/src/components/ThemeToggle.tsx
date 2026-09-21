'use client';

import { useEffect, useState } from 'react';

const KEY = 'sosial-theme';

/** Light/dark switch for the dashboard. Marketing stays light always. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* private mode — theme just won't persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-bone"
    >
      {dark ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="4" />
          <path d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M4 4l1.6 1.6M14.4 14.4 16 16M16 4l-1.6 1.6M5.6 14.4 4 16" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16.5 13.5A7.5 7.5 0 0 1 6.5 3.5a7.5 7.5 0 1 0 10 10Z" />
        </svg>
      )}
    </button>
  );
}
