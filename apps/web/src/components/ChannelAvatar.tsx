'use client';

import { useEffect, useState } from 'react';
import { BrandIcon, type BrandProvider } from './BrandIcon';
import { providerMeta } from '@/lib/providers';

/**
 * THE way a connected account is shown, everywhere on web (and the same rule
 * as ChannelAvatar in the mobile src/components/ui.tsx): the account's
 * profile picture as a circle with the platform logo as a small badge in the
 * corner; the brand disc alone when there is no picture. Every place that
 * shows or picks an account uses this (or ChannelAvatarStack below).
 * badge={false} is only for mock-ups of a platform's own UI (studio post
 * previews), where the platform itself would not draw a badge.
 * Plain <img>, avatar hosts are arbitrary, so next/image can't preallow them.
 */
export default function ChannelAvatar({
  provider,
  avatar,
  size = 40,
  badge = true,
}: {
  provider: string;
  avatar?: string;
  size?: number;
  /** Corner brand disc over a photo. Off only in platform-native mock-ups. */
  badge?: boolean;
}) {
  const meta = providerMeta(provider);
  const badgeSize = Math.max(14, Math.round(size * 0.54));
  // Integer, even pixel sizes everywhere: at 14px badges a fractional glyph
  // rounds asymmetrically and reads as off-center. Border is 2px a side.
  const even = (n: number): number => Math.max(8, Math.round(n / 2) * 2);
  const badgeGlyph = even(badgeSize - 6);
  const discGlyph = even(size * 0.6);
  // Stored avatar URLs die (TikTok/fbcdn sign theirs with expiries), a dead
  // photo must fall back to the brand disc, never a broken-image icon.
  const [dead, setDead] = useState(false);
  useEffect(() => setDead(false), [avatar]);
  if (!avatar || dead) {
    return (
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size, background: meta.color }}
        title={meta.label}
      >
        <BrandIcon provider={provider as BrandProvider} mono className="block text-white" style={{ width: discGlyph, height: discGlyph }} />
      </span>
    );
  }
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} title={meta.label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatar}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setDead(true)}
        className="block h-full w-full rounded-full object-cover"
        style={{ background: meta.color }}
      />
      {badge ? (
        <span
          className="absolute flex items-center justify-center rounded-full border-2 border-card"
          style={{
            right: -2,
            bottom: -2,
            width: badgeSize,
            height: badgeSize,
            background: meta.color,
          }}
          aria-hidden="true"
        >
          <BrandIcon provider={provider as BrandProvider} mono className="block text-white" style={{ width: badgeGlyph, height: badgeGlyph }} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * The accounts a post went out on, as overlapping ChannelAvatars (badge on
 * each), +n past `max`. Mirrors AccountAvatars in the mobile ui.tsx.
 */
export function ChannelAvatarStack({
  accounts,
  size = 24,
  max = 3,
  ring = 'card',
}: {
  accounts: { provider: string; avatar?: string }[];
  size?: number;
  max?: number;
  /** Background the stack sits on, so each avatar's ring blends into it. */
  ring?: 'card' | 'paper';
}) {
  if (accounts.length === 0) return null;
  const shown = accounts.slice(0, max);
  const extra = accounts.length - shown.length;
  const ringClass = ring === 'paper' ? 'ring-paper' : 'ring-card';
  const overlap = -Math.round(size * 0.3);
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((a, i) => (
        <span
          key={`${a.provider}-${i}`}
          className={`rounded-full ring-2 ${ringClass}`}
          style={{ marginLeft: i ? overlap : 0, zIndex: shown.length - i }}
        >
          <ChannelAvatar provider={a.provider} avatar={a.avatar} size={size} />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className={`flex items-center justify-center rounded-full bg-surface font-bold text-soft ring-2 ${ringClass}`}
          style={{ marginLeft: overlap, width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
