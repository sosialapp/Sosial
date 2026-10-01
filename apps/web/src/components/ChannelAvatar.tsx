'use client';

import { useEffect, useState } from 'react';
import { BrandIcon, type BrandProvider } from './BrandIcon';
import { providerMeta } from '@/lib/providers';

/**
 * Channel avatar, same as the mobile app: the account's profile picture
 * leads as a circular tile; the social logo rides as a larger circular disc
 * stacked in the corner. Brand disc alone when there's no avatar.
 * Small account rows pass badge={false} (mobile parity) so the mini logo
 * never swallows the photo. Plain <img> — avatar hosts are arbitrary, so
 * next/image can't preallow them.
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
  /** Corner brand disc over a photo. Off in dense rows — the disc alone shows. */
  badge?: boolean;
}) {
  const meta = providerMeta(provider);
  const badgeSize = Math.max(14, Math.round(size * 0.54));
  // Integer, even pixel sizes everywhere: at 14px badges a fractional glyph
  // rounds asymmetrically and reads as off-center. Border is 2px a side.
  const even = (n: number): number => Math.max(8, Math.round(n / 2) * 2);
  const badgeGlyph = even(badgeSize - 6);
  const discGlyph = even(size * 0.6);
  // Stored avatar URLs die (TikTok/fbcdn sign theirs with expiries) — a dead
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
