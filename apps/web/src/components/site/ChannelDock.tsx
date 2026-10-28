import Link from 'next/link';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { channelHref } from '@/content/types';
import { providerMeta } from '@/lib/providers';

/** Listed but not connectable yet. */
const SOON = new Set<BrandProvider>(['gmb', 'linkedin']);

/**
 * Integration dock: every channel Sosial publishes to as one row of equal
 * icon tiles. The page's own channel opens up to show its name on an ink
 * tile; the rest are quiet bordered squares that link to their guides.
 * One row that swipes sideways on a phone, wraps on wide screens.
 * Shared by the integrations index and every integration page.
 */
export default function ChannelDock({ active, label = 'All integrations' }: { active?: string; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <span className="shrink-0 text-xs font-bold text-muted">{label}</span>
      <div className="no-scrollbar relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {CHANNEL_GUIDES.map((g) => {
          const isActive = g.key === active;
          const soon = SOON.has(g.key as BrandProvider);
          const name = providerMeta(g.key).label;
          const title = soon ? `${name} (coming soon)` : name;

          if (isActive) {
            return (
              <span
                key={g.key}
                aria-current="page"
                title={title}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-ink pr-3.5 pl-2.5 text-sm font-bold text-bone"
              >
                <BrandIcon provider={g.key} mono className="h-5 w-5 text-bone" />
                {name}
              </span>
            );
          }
          return (
            <Link
              key={g.key}
              href={channelHref(g.key)}
              title={title}
              aria-label={`${title} integration`}
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card transition hover:border-ink/30 ${
                soon ? 'opacity-55 hover:opacity-100' : ''
              }`}
            >
              <BrandIcon provider={g.key} className="h-5 w-5" />
              {soon ? (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-faint ring-2 ring-card" aria-hidden="true" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
