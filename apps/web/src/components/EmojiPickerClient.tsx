'use client';

import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';

/**
 * Thin wrapper so the heavy `emoji-picker-react` bundle is still pulled in
 * lazily (this module is the target of a `next/dynamic` import) while the
 * picker follows the app's light/dark theme.
 */
export default function EmojiPickerClient({
  onPick,
  height = 360,
}: {
  onPick: (emoji: string) => void;
  height?: number;
}) {
  return (
    <EmojiPicker
      onEmojiClick={(d: EmojiClickData) => onPick(d.emoji)}
      theme={Theme.AUTO}
      emojiStyle={EmojiStyle.NATIVE}
      autoFocusSearch={false}
      searchPlaceholder="Search emoji…"
      width="100%"
      height={height}
      previewConfig={{ showPreview: false }}
    />
  );
}
