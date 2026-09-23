'use client';

import { useEffect, useState } from 'react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import { THEME_CLASS } from './ThemeScope';

/**
 * Thin wrapper so the heavy `emoji-picker-react` bundle is still pulled in
 * lazily (this module is the target of a `next/dynamic` import) while the
 * picker follows the app's light/dark theme.
 *
 * Theme.AUTO follows the OS colour scheme, which is wrong whenever the user
 * forces light or dark in the app — so resolve the ThemeScope class directly
 * and stay in sync through the same `sosial-theme` event ThemeToggle fires.
 */
function appDark(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.querySelector<HTMLElement>('[data-theme-root]');
  if (root) return root.classList.contains(THEME_CLASS);
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export default function EmojiPickerClient({
  onPick,
  height = 360,
}: {
  onPick: (emoji: string) => void;
  height?: number;
}) {
  const [dark, setDark] = useState(appDark);
  useEffect(() => {
    const sync = () => setDark(appDark());
    sync();
    window.addEventListener('sosial-theme', sync);
    return () => window.removeEventListener('sosial-theme', sync);
  }, []);
  return (
    <EmojiPicker
      onEmojiClick={(d: EmojiClickData) => onPick(d.emoji)}
      theme={dark ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      autoFocusSearch={false}
      searchPlaceholder="Search emoji…"
      width="100%"
      height={height}
      previewConfig={{ showPreview: false }}
    />
  );
}
