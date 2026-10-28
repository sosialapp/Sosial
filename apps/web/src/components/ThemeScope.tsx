'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Dark-mode boundary. Only subtrees wrapped here (dashboard, login) can go
 * dark, the marketing site never renders one, so it stays light no matter
 * what the saved theme is. Applies the saved/system theme on mount.
 */
export const THEME_KEY = 'sosial-theme';
export const THEME_CLASS = 'theme-dark';

/** Saved choice first; with none saved, `fallbackDark` (when given) or the
 *  system setting. */
export function resolveTheme(fallbackDark?: boolean): boolean {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return fallbackDark ?? matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return fallbackDark ?? false;
  }
}

/** `defaultDark` renders dark from the server (no light flash) and stays dark
 *  unless the visitor saved light; the docs site uses it. */
export default function ThemeScope({
  children,
  className,
  defaultDark,
}: {
  children: ReactNode;
  className?: string;
  defaultDark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.classList.toggle(THEME_CLASS, resolveTheme(defaultDark || undefined));
  }, [defaultDark]);

  return (
    <div ref={ref} data-theme-root className={defaultDark ? `${THEME_CLASS} ${className ?? ''}` : className}>
      {children}
    </div>
  );
}
