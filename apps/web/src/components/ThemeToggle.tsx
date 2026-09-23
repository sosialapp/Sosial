'use client';

import { useEffect, useRef, useState } from 'react';
import { THEME_CLASS, THEME_KEY } from './ThemeScope';

function scopeRoot(anchor: HTMLElement | null): HTMLElement | null {
  return (
    anchor?.closest<HTMLElement>('[data-theme-root]') ??
    document.querySelector<HTMLElement>('[data-theme-root]')
  );
}

/** Light/dark switch. Only works inside a ThemeScope (dashboard, login) —
 *  anywhere else it renders inert so marketing can never go dark. */
export default function ThemeToggle() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dark, setDark] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const root = scopeRoot(null);
    if (!root) return;
    setLive(true);
    const sync = () => setDark(root.classList.contains(THEME_CLASS));
    sync();
    window.addEventListener('sosial-theme', sync);
    return () => window.removeEventListener('sosial-theme', sync);
  }, []);

  if (!live) return null;

  const toggle = () => {
    const root = scopeRoot(btnRef.current);
    if (!root) return;
    const next = !root.classList.contains(THEME_CLASS);
    root.classList.toggle(THEME_CLASS, next);
    setDark(next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      /* private mode — theme just won't persist */
    }
    // Keep a second toggle on the same page (header + profile) in sync.
    window.dispatchEvent(new Event('sosial-theme'));
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-bone"
    >
      {dark ? (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="4" />
          <path d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M4 4l1.6 1.6M14.4 14.4 16 16M16 4l-1.6 1.6M5.6 14.4 4 16" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16.5 13.5A7.5 7.5 0 0 1 6.5 3.5a7.5 7.5 0 1 0 10 10Z" />
        </svg>
      )}
    </button>
  );
}
