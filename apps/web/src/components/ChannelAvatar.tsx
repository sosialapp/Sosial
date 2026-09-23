import { BrandIcon, type BrandProvider } from './BrandIcon';
import { providerMeta } from '@/lib/providers';

/** Avatar URL tucked into channel metadata by the mobile sync (may be absent). */
export function channelAvatar(metadata: Record<string, unknown> | null | undefined): string | undefined {
  const v = metadata?.avatar;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Channel mark: the social logo leads as the main tile; the account's
 * profile picture rides in the corner, slightly larger than a plain badge
 * so faces stay recognizable. Brand tile alone when there's no avatar.
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
  const r = Math.round(size * 0.3);
  const badge = Math.max(16, Math.round(size * 0.58));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size, borderRadius: r, background: meta.color }}
      >
        <BrandIcon provider={provider as BrandProvider} mono className="h-1/2 w-1/2 text-white" />
      </span>
      {avatar ? (
        <span
          className="absolute overflow-hidden rounded-full border-2 border-card"
          style={{ right: -2, bottom: -2, width: badge, height: badge }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            width={badge}
            height={badge}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </span>
      ) : null}
    </span>
  );
}
