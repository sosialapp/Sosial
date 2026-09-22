import Link from 'next/link';
import { BRAND_NAMES, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
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
    <footer className="border-t border-line bg-card/60">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr] lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Every channel. One calendar. Compose once and publish across ten networks — with an AI
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper transition hover:border-accent hover:bg-white"
              >
                <BrandIcon provider={p} className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>

        <nav aria-label="Product">
          <p className="eyebrow">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/publish" className="hover:text-ink">
                Publish
              </Link>
            </li>
            <li>
              <Link href="/create" className="hover:text-ink">
                Create
              </Link>
            </li>
            <li>
              <Link href="/ai-assistant" className="hover:text-ink">
                AI Assistant
              </Link>
            </li>
            <li>
              <Link href="/#teams" className="hover:text-ink">
                Teams &amp; approvals
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="hover:text-ink">
                Pricing
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Who it's for">
          <p className="eyebrow">Who it&rsquo;s for</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/audiences/creators" className="hover:text-ink">
                Creators
              </Link>
            </li>
            <li>
              <Link href="/audiences/small-business" className="hover:text-ink">
                Small business
              </Link>
            </li>
            <li>
              <Link href="/audiences/agencies" className="hover:text-ink">
                Agencies
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Channels">
          <p className="eyebrow">Channels</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-soft">
            {CHANNEL_GUIDES.map((c) => (
              <li key={c.key}>
                <Link href={`/integrations/${c.key}`} className="flex items-center gap-2 hover:text-ink">
                  <BrandIcon provider={c.key} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Resources">
          <p className="eyebrow">Resources</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/blog" className="hover:text-ink">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/resources" className="hover:text-ink">
                Resource library
              </Link>
            </li>
            {topResources.map((r) => (
              <li key={r.slug}>
                <Link href={resourceHref(r.slug)} className="hover:text-ink">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="eyebrow">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/login" className="hover:text-ink">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-ink">
                Get started
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-ink">
                Terms of Use
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-ink">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sosial. All rights reserved.</p>
          <p>Made for people who publish everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
