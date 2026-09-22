import { BrandIcon, type BrandProvider } from './BrandIcon';
import { providerMeta } from '@/lib/providers';

/** Avatar URL tucked into channel metadata by the mobile sync (may be absent). */
export function channelAvatar(metadata: Record<string, unknown> | null | undefined): string | undefined {
  const v = metadata?.avatar;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Mobile-style channel mark: the account's profile picture with the social
 * logo stacked in the corner; brand tile fallback when there's no avatar.
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
  const badge = Math.max(14, Math.round(size * 0.48));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="object-cover"
          style={{ width: size, height: size, borderRadius: r }}
        />
      ) : (
        <span
          className="flex items-center justify-center"
          style={{ width: size, height: size, borderRadius: r, background: `${meta.color}14` }}
        >
          <BrandIcon provider={provider as BrandProvider} className="h-1/2 w-1/2" />
        </span>
      )}
      {avatar ? (
        <span
          className="absolute flex items-center justify-center rounded-full border-2 border-card"
          style={{
            right: -2,
            bottom: -2,
            width: badge,
            height: badge,
            background: meta.color,
          }}
        >
          <BrandIcon provider={provider as BrandProvider} mono className="h-1/2 w-1/2 text-white" />
        </span>
      ) : null}
    </span>
  );
}
