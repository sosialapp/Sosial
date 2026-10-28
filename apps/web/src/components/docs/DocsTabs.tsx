'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { docsSlugOf } from './DocsSidebar';

export interface DocsTab {
  label: string;
  href: string;
  /** Page slugs that light this tab up; empty for Home. */
  slugs: string[];
}

/** Header tabs (Home, Guides, Developers), highlighted by the current page. */
export default function DocsTabs({ tabs }: { tabs: DocsTab[] }) {
  const slug = docsSlugOf(usePathname() ?? '/');
  return (
    <nav aria-label="Docs areas" className="hidden items-center gap-1 md:flex">
      {tabs.map((t) => {
        const on = t.slugs.length ? t.slugs.includes(slug) : !slug;
        return (
          <Link
            key={t.label}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${on ? 'bg-surface font-medium text-ink' : 'text-ink/70 hover:text-ink'}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
