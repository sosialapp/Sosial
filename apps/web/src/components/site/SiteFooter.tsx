import Link from 'next/link';
import { BRAND_NAMES, BrandIcon, brandColor, type BrandProvider } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { RESOURCES } from '@/content/resources';
import { resourceHref } from '@/content/types';
import Logo from './Logo';

/** Footer for every public page. Only links to routes that exist. */
const SOCIALS: BrandProvider[] = [
  'facebook',
  'instagram',
  'threads',
  'tiktok',
  'x',
  'bluesky',
  'mastodon',
  'linkedin',
];

export default function SiteFooter() {
  const topResources = RESOURCES.slice(0, 5);

  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr] lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper/60">
            Every channel. One calendar. Compose once and publish across ten networks, with an AI
            writer, approvals and a queue that runs itself.
          </p>
          <Link href="/login" className="btn btn-bolt mt-5">
            Start scheduling free
          </Link>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Sosial on social media">
            {SOCIALS.map((p) => (
              <Link
                key={p}
                href={`/integrations/${p}`}
                aria-label={`Sosial on ${BRAND_NAMES[p]}`}
                title={`Sosial on ${BRAND_NAMES[p]}`}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white transition hover:opacity-85"
                style={{ background: brandColor(p) }}
              >
                <BrandIcon provider={p} mono className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>

        <nav aria-label="Product">
          <p className="eyebrow text-paper/50">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/publish" className="hover:text-paper">
                Publish
              </Link>
            </li>
            <li>
              <Link href="/create" className="hover:text-paper">
                Create
              </Link>
            </li>
            <li>
              <Link href="/ai-assistant" className="hover:text-paper">
                AI Assistant
              </Link>
            </li>
            <li>
              <Link href="/#teams" className="hover:text-paper">
                Teams &amp; approvals
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="hover:text-paper">
                Pricing
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Channels">
          <p className="eyebrow text-paper/50">Channels</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            {CHANNEL_GUIDES.map((c) => (
              <li key={c.key}>
                <Link href={`/integrations/${c.key}`} className="flex items-center gap-2 hover:text-paper">
                  <BrandIcon provider={c.key} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Resources">
          <p className="eyebrow text-paper/50">Resources</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/blog" className="hover:text-paper">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/resources" className="hover:text-paper">
                Resource library
              </Link>
            </li>
            {topResources.map((r) => (
              <li key={r.slug}>
                <Link href={resourceHref(r.slug)} className="hover:text-paper">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="eyebrow text-paper/50">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/login" className="hover:text-paper">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-paper">
                Get started
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-paper">
                Terms of Use
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-paper">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-paper/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sosial. All rights reserved.</p>
          <p>Made for people who publish everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
