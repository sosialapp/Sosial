import { BrandIcon, type BrandProvider } from './BrandIcon';
import { providerMeta } from '@/lib/providers';

/** Avatar URL tucked into channel metadata by the mobile sync (may be absent). */
export function channelAvatar(metadata: Record<string, unknown> | null | undefined): string | undefined {
  const v = metadata?.avatar;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Channel avatar, same as the mobile app: the account's profile picture
 * leads as a circular tile; the social logo rides as a larger circular disc
 * stacked in the corner. Brand disc alone when there's no avatar.
 * Plain <img> — avatar hosts are arbitrary, so next/image can't preallow them.
 */
export default function ChannelAvatar({
  provider,
  avatar,
  size = 40,
}: {
  provider: string;
  avatar?: string;
  size?: number;
}) {
  const meta = providerMeta(provider);
  const badgeSize = Math.max(16, Math.round(size * 0.56));
  if (!avatar) {
    return (
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size, background: meta.color }}
        title={meta.label}
      >
        <BrandIcon provider={provider as BrandProvider} mono className="h-[62%] w-[62%] text-white" />
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
        className="block h-full w-full rounded-full object-cover"
        style={{ background: meta.color }}
      />
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
        <BrandIcon provider={provider as BrandProvider} mono className="text-white" style={{ width: '62%', height: '62%' }} />
      </span>
    </span>
  );
}
