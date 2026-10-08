import Link from 'next/link';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { channelHref } from '@/content/types';
import { providerMeta } from '@/lib/providers';

/** Listed but not connectable yet — the tile carries a Soon tag. */
const SOON = new Set<BrandProvider>(['gmb', 'linkedin', 'pinterest']);

function SoonTag() {
  return (
    <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full border border-line bg-white px-1 py-px text-[8px] font-bold uppercase leading-none tracking-wide text-faint">
      Soon
    </span>
  );
}

/**
 * Integration dock: every channel Sosial publishes to, in one wrapped panel.
 * The page's own channel sits enlarged with an accent ring; the rest link to
 * their guides and lift on hover. Shared by every integration page.
 */
export default function ChannelDock({ active }: { active: string }) {
  return (
    <nav
      aria-label="All integrations"
      className="rounded-[26px] border border-line bg-white/60 p-2.5 shadow-[0_20px_50px_-32px_rgba(28,26,20,0.5)] backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2">
        {CHANNEL_GUIDES.map((g) => {
          const isActive = g.key === active;
          const soon = SOON.has(g.key as BrandProvider);
          const label = providerMeta(g.key).label;

          const tile = isActive
            ? 'border-accent bg-white shadow-[0_14px_30px_-14px_rgba(28,26,20,0.45)] ring-2 ring-accent'
            : 'border-transparent bg-white/0 hover:-translate-y-1 hover:border-line hover:bg-white hover:shadow-[0_12px_26px_-18px_rgba(28,26,20,0.4)]';

          const body = (
            <>
              <span className="relative">
                <BrandIcon
                  provider={g.key}
                  className={isActive ? 'h-9 w-9' : 'h-7 w-7 opacity-90 transition group-hover:opacity-100'}
                />
                {soon ? <SoonTag /> : null}
              </span>
              <span
                className={`mt-1.5 text-[10px] leading-none ${
                  isActive ? 'font-extrabold text-ink' : 'font-semibold text-muted'
                }`}
              >
                {label}
              </span>
            </>
          );

          const cls = `group flex w-[74px] shrink-0 flex-col items-center rounded-2xl border px-1.5 pb-2 pt-2.5 transition duration-200 ${tile}`;

          return isActive ? (
            <span key={g.key} aria-current="page" title={label} className={cls}>
              {body}
            </span>
          ) : (
            <Link
              key={g.key}
              href={channelHref(g.key)}
              aria-label={`${label} integration`}
              title={label}
              className={cls}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
