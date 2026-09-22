'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Dark-mode boundary. Only subtrees wrapped here (dashboard, login) can go
 * dark — the marketing site never renders one, so it stays light no matter
 * what the saved theme is. Applies the saved/system theme on mount.
 */
export const THEME_KEY = 'sosial-theme';
export const THEME_CLASS = 'theme-dark';

export function resolveTheme(): boolean {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export default function ThemeScope({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.classList.toggle(THEME_CLASS, resolveTheme());
  }, []);

  return (
    <div ref={ref} data-theme-root className={className}>
      {children}
    </div>
  );
}
