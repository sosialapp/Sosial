import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { RESOURCES } from '@/content/resources';
import { resourceHref } from '@/content/types';
import Logo from './Logo';

/** Footer for every public page. Only links to routes that exist. */
export default function SiteFooter() {
  const topResources = RESOURCES.slice(0, 5);

  return (
    <footer className="border-t border-line bg-card/60">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:grid-cols-[1.6fr_1fr_1.2fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Every channel. One calendar. Compose once and publish across ten networks — with an AI
            writer, approvals and a queue that runs itself.
          </p>
          <Link href="/login" className="btn btn-primary mt-5">
            Start scheduling free
          </Link>
        </div>

        <nav aria-label="Product">
          <p className="eyebrow">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/#ai" className="hover:text-ink">
                AI writer
              </Link>
            </li>
            <li>
              <Link href="/#how" className="hover:text-ink">
                How it works
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
            <li>
              <Link href="/integrations" className="hover:text-ink">
                All integrations
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
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sosial. All rights reserved.</p>
          <p>Made for people who publish everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
