import { BrandIcon } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';

/** Infinite CSS marquee of every channel Sosial publishes to. Pauses on hover. */
export default function ChannelMarquee() {
  const loop = [...CHANNEL_GUIDES, ...CHANNEL_GUIDES];
  return (
    <div className="relative overflow-hidden border-y border-line bg-card/60 py-6">
      <div className="marquee-track flex w-max items-center gap-10 px-4">
        {loop.map((c, i) => (
          <span
            key={`${c.key}-${i}`}
            className="flex shrink-0 items-center gap-2.5 text-sm font-bold text-soft"
            aria-hidden={i >= CHANNEL_GUIDES.length}
          >
            <BrandIcon provider={c.key} className="h-5 w-5" />
            {c.name}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-bone to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-bone to-transparent" />
    </div>
  );
}
