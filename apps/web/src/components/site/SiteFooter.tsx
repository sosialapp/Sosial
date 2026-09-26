import Link from 'next/link';
import { BRAND_NAMES, BrandIcon, brandColor, type BrandProvider } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { siteFooterPages } from '@/lib/sitePages';
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

/** Near-black marks read as invisible on the dark footer — those brands ship white on dark. */
const DARK_MARKS: BrandProvider[] = ['tiktok', 'x', 'threads'];

export default async function SiteFooter() {
  // Custom CMS pages flagged "show in footer" (live only — drafts never leak).
  const extraPages = await siteFooterPages();
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-10 px-4 py-14 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1.1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper/60">
            Every channel. One calendar. Compose once and publish across ten networks, with an AI
            writer, approvals and a queue that runs itself.
          </p>
          <Link href="/login" className="btn btn-bolt mt-5">
            Start scheduling free
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-3" aria-label="Sosial on social media">
            {SOCIALS.map((p) => (
              <Link
                key={p}
                href={`/integrations/${p}`}
                aria-label={`Sosial on ${BRAND_NAMES[p]}`}
                title={`Sosial on ${BRAND_NAMES[p]}`}
                className="text-white transition hover:opacity-75"
              >
                {DARK_MARKS.includes(p) ? (
                  <BrandIcon provider={p} mono className="h-6 w-6" />
                ) : (
                  <BrandIcon provider={p} badge={false} className="h-6 w-6" />
                )}
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
              <Link href="/features/create" className="hover:text-paper">
                Create
              </Link>
            </li>
            <li>
              <Link href="/ai-assistant" className="hover:text-paper">
                AI Assistant
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-paper">
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
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-white"
                    style={{ background: brandColor(c.key) }}
                  >
                    <BrandIcon provider={c.key} mono className="h-3 w-3" />
                  </span>
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
            <li>
              <Link href="/compare" className="hover:text-paper">
                Compare
              </Link>
            </li>
            <li>
              <Link href="/made-for-everyone" className="hover:text-paper">
                Made for everyone
              </Link>
            </li>
            <li>
              <Link href="/transparency" className="hover:text-paper">
                Transparency
              </Link>
            </li>
            {extraPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="hover:text-paper">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="eyebrow text-paper/50">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/about" className="hover:text-paper">
                About
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
          <p>© {new Date().getFullYear()} EGATE WORLDWIDE · Sosial. All rights reserved.</p>
          <p>
            Made for people who publish everywhere. ·{' '}
            <a href="mailto:support@sosial.app" className="underline hover:text-paper">
              support@sosial.app
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
