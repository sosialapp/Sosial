import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import ThemeScope from '@/components/ThemeScope';
import ThemeToggle from '@/components/ThemeToggle';
import DocsSearch from '@/components/docs/DocsSearch';
import DocsSidebar, { DocsMobileNav } from '@/components/docs/DocsSidebar';
import DocsFooter, { type DocsFooterColumn } from '@/components/docs/DocsFooter';
import DocsTabs, { type DocsTab } from '@/components/docs/DocsTabs';
import { buildNav, buildSearchIndex, docsContent, docsUrl } from '@/lib/docs';
import '@/components/docs/docs.css';

export const metadata: Metadata = {
  metadataBase: new URL(docsUrl()),
  title: { default: 'Sosial Docs', template: '%s · Sosial Docs' },
  description: 'Guides for Sosial: connect your social accounts, write once and schedule posts everywhere.',
  openGraph: { type: 'website', siteName: 'Sosial Docs' },
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app').replace(/\/+$/, '');

/** docs.sosial.app shell (the middleware maps that host onto /docs). Its own
 *  ThemeScope: black by default, light only when the visitor picked it. */
export default async function DocsLayout({ children }: { children: ReactNode }) {
  const { sections, pages } = await docsContent();
  const nav = buildNav(sections, pages);
  const index = buildSearchIndex(sections, pages);
  // Developers gets its own tab and footer column; everything else is a guide.
  const devNav = nav.filter((s) => s.slug === 'developers');
  const guideNav = nav.filter((s) => s.slug !== 'developers');
  const slugsOf = (list: typeof nav) => list.flatMap((s) => s.pages.map((p) => p.slug));
  const guideSlugs = slugsOf(guideNav);
  const devSlugs = slugsOf(devNav);
  const tabs: DocsTab[] = [{ label: 'Home', href: '/', slugs: [] }];
  if (guideSlugs.length) tabs.push({ label: 'Guides', href: `/${guideSlugs[0]}`, slugs: guideSlugs });
  if (devSlugs.length) tabs.push({ label: 'Developers', href: `/${devSlugs[0]}`, slugs: devSlugs });
  // One footer column per sidebar section, capped so long sections stay tidy.
  const columns: DocsFooterColumn[] = [
    ...nav.map((sec) => ({ title: sec.title, pages: sec.pages.slice(0, 7) })),
  ].filter((c) => c.pages.length);

  return (
    <ThemeScope defaultDark className="docs-site min-h-screen bg-paper text-ink">
      <div className="flex w-full">
        <DocsSidebar nav={nav} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-[60px] items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-6">
            {/* Hidden on wide screens when the sidebar (which has its own logo) shows. */}
            <Link href="/" className="docs-head-logo flex shrink-0 items-center gap-2" aria-label="Sosial Docs home">
              <Image src="/bolt.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
              <span className="font-display text-lg font-medium tracking-tight">Sosial</span>
              <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink/70">Docs</span>
            </Link>
            <div className="flex min-w-0 flex-1 justify-end sm:justify-start sm:pl-4">
              <DocsSearch index={index} />
            </div>
            <DocsTabs tabs={tabs} />
            <a
              href={SITE}
              className="hidden shrink-0 rounded-xl border border-line px-3 py-1.5 text-sm text-ink/80 transition hover:text-ink xl:block"
            >
              Go to Sosial
            </a>
            <ThemeToggle />
          </header>
          <DocsMobileNav nav={nav} />
          <main className="flex min-w-0 flex-1">{children}</main>
          <DocsFooter columns={columns} />
        </div>
      </div>
    </ThemeScope>
  );
}
