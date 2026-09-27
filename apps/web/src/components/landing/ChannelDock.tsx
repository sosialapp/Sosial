import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import { providerMeta } from '@/lib/providers';
import type { ProviderKey } from '@/lib/types';

const CHANNELS: ProviderKey[] = [
  'instagram',
  'tiktok',
  'x',
  'facebook',
  'threads',
  'youtube',
  'linkedin',
  'bluesky',
  'mastodon',
  'pinterest',
];

/**
 * Channel logo cloud (Later register): a quiet grid of every channel
 * Sosial publishes to — icon plus name, no motion. Each tile links to
 * its integration guide.
 */
export default function ChannelDock() {
  return (
    <section aria-label="Channels" className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-20 md:py-28">
        <p className="eyebrow text-center">Channels</p>
        <h2 className="mx-auto mt-2 max-w-xl text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Ten channels, one workspace.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-muted md:text-base">
          Connect any mix. Every post is previewed the way it will actually appear.
        </p>
        <div className="mx-auto mt-9 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CHANNELS.map((p) => (
            <Link
              key={p}
              href={`/integrations/${p}`}
              aria-label={`${providerMeta(p).label} integration`}
              className="card flex items-center gap-3 p-4 transition hover:border-ink/30"
            >
              <BrandIcon provider={p} className="h-9 w-9 shrink-0" />
              <span className="truncate text-sm font-bold text-ink">{providerMeta(p).label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
