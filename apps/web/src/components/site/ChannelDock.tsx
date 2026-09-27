import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { channelHref } from '@/content/types';
import { providerMeta } from '@/lib/providers';

/**
 * Integration logo dock: one line of every channel Sosial publishes to,
 * macOS-dock style — the page's own channel rides enlarged, the rest link
 * to their guides. Shared by all ten integration pages.
 */
export default function ChannelDock({ active }: { active: string }) {
  return (
    <nav aria-label="All integrations" className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-end gap-2.5 sm:gap-3">
        {CHANNEL_GUIDES.map((g) => {
          const isActive = g.key === active;
          const label = providerMeta(g.key).label;
          const box = isActive
            ? 'border-accent bg-white p-3 shadow-[0_12px_28px_-12px_rgba(28,26,20,0.35)] ring-2 ring-accent'
            : 'border-line bg-white/70 p-2.5 transition hover:-translate-y-1 hover:border-ink/30 hover:bg-white';
          const body = (
            <>
              <BrandIcon provider={g.key} className={isActive ? 'h-14 w-14' : 'h-9 w-9'} />
              <span
                className={`mt-1.5 text-[10px] leading-none ${
                  isActive ? 'font-extrabold text-ink' : 'font-bold text-muted'
                }`}
              >
                {label}
              </span>
            </>
          );
          return isActive ? (
            <span
              key={g.key}
              aria-current="page"
              title={label}
              className={`flex shrink-0 flex-col items-center rounded-2xl border ${box}`}
            >
              {body}
            </span>
          ) : (
            <Link
              key={g.key}
              href={channelHref(g.key)}
              aria-label={`${label} integration`}
              title={label}
              className={`flex shrink-0 flex-col items-center rounded-2xl border ${box}`}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
