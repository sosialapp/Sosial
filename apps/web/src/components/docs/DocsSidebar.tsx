'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DocsNavPage, DocsNavSection } from '@/lib/docs';
import DocsIcon from './DocsIcon';

/** Paths here are what the browser shows on docs.sosial.app (`/slug`); the
 *  middleware maps them onto /docs/slug. Empty means the docs home. */
export function docsSlugOf(path: string): string {
  return path.replace(/^\/(docs\/?)?/, '').replace(/\/+$/, '');
}

function useActiveSlug(): string {
  return docsSlugOf(usePathname() ?? '/');
}

function itemClass(on: boolean): string {
  return `flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition ${
    on ? 'bg-surface font-medium text-ink' : 'text-ink/70 hover:bg-surface/60 hover:text-ink'
  }`;
}

/** A page row; pages with children get a chevron that opens them. The group
 *  starts open when the current page is the parent or one of its children. */
function NavItem({ page, active, onPick }: { page: DocsNavPage; active: string; onPick?: () => void }) {
  const inside = page.slug === active || page.children.some((c) => c.slug === active);
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);

  if (!page.children.length) {
    return (
      <li>
        <Link href={`/${page.slug}`} onClick={onPick} aria-current={page.slug === active ? 'page' : undefined} className={itemClass(page.slug === active)}>
          <DocsIcon name={page.icon} fallback className="h-4 w-4 shrink-0" />
          <span className="truncate">{page.title}</span>
        </Link>
      </li>
    );
  }
  return (
    <li>
      <div className="flex items-center">
        <Link href={`/${page.slug}`} onClick={onPick} aria-current={page.slug === active ? 'page' : undefined} className={itemClass(page.slug === active)}>
          <DocsIcon name={page.icon} fallback className="h-4 w-4 shrink-0" />
          <span className="truncate">{page.title}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Collapse ${page.title}` : `Expand ${page.title}`}
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 hover:bg-surface hover:text-ink"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {open ? (
        <ul className="mb-1 ml-[18px] mt-0.5 grid gap-0.5 border-l border-line pl-2">
          {page.children.map((c) => (
            <li key={c.slug}>
              <Link href={`/${c.slug}`} onClick={onPick} aria-current={c.slug === active ? 'page' : undefined} className={itemClass(c.slug === active)}>
                {c.icon ? <DocsIcon name={c.icon} className="h-4 w-4 shrink-0" /> : null}
                <span className="truncate">{c.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function NavList({ nav, active, onPick }: { nav: DocsNavSection[]; active: string; onPick?: () => void }) {
  return (
    <div className="grid gap-7">
      {nav.map((s) => (
        <div key={s.slug}>
          <p className="px-3 text-[13px] font-medium text-ink/50">{s.title}</p>
          <ul className="mt-2 grid gap-0.5">
            {s.pages.map((p) => (
              <NavItem key={p.slug} page={p} active={active} onPick={onPick} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Desktop rail: full-height column with the logo on top, like the header it
 *  sits beside. Not shown on the docs home, which is a full-width landing. */
export default function DocsSidebar({ nav }: { nav: DocsNavSection[] }) {
  const active = useActiveSlug();
  if (!active) return null;
  return (
    <aside className="docs-rail sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-line bg-paper lg:flex">
      <Link href="/" className="flex h-[60px] shrink-0 items-center gap-2 px-6" aria-label="Sosial Docs home">
        <Image src="/bolt.png" alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
        <span className="font-display text-lg font-medium tracking-tight">Sosial</span>
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink/70">Docs</span>
      </Link>
      <nav aria-label="Docs" className="min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-4">
        <NavList nav={nav} active={active} />
      </nav>
    </aside>
  );
}

/** Phone and tablet: a "Menu" bar under the header that unfolds the same list. */
export function DocsMobileNav({ nav }: { nav: DocsNavSection[] }) {
  const path = usePathname() ?? '/';
  const active = docsSlugOf(path);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  if (!active) return null;
  const current = nav.flatMap((s) => s.pages.flatMap((p) => [p, ...p.children])).find((p) => p.slug === active);
  return (
    <div className="sticky top-[60px] z-30 border-b border-line bg-paper/95 backdrop-blur lg:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm">
        <span className="text-ink/60">Menu</span>
        {current ? <DocsIcon name={current.icon} fallback className="h-4 w-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate font-medium">{current?.title ?? ''}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <nav aria-label="Docs" className="max-h-[70vh] overflow-y-auto border-t border-line px-2 pb-5 pt-4">
          <NavList nav={nav} active={active} onPick={() => setOpen(false)} />
        </nav>
      ) : null}
    </div>
  );
}
