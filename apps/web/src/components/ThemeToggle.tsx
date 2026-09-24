'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
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
      {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
