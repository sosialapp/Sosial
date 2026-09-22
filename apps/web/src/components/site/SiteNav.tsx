'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { resourceHref } from '@/content/types';
import { dashboardUrl } from '@/lib/site';
import Logo from './Logo';

interface MenuLink {
  href: string;
  title: string;
  desc: string;
}

const FEATURES: MenuLink[] = [
  { href: '/publish', title: 'Publish', desc: 'One calendar and queue across ten channels' },
  { href: '/create', title: 'Create', desc: 'Composer, media, templates and previews' },
  { href: '/ai-assistant', title: 'AI Assistant', desc: 'Research-backed drafts in 100+ languages' },
  { href: '/#teams', title: 'Teams & approvals', desc: 'Draft, review and approve in one tap' },
];

const AUDIENCES: MenuLink[] = [
  { href: '/audiences/creators', title: 'Creators', desc: 'Post everywhere without living everywhere' },
  { href: '/audiences/small-business', title: 'Small business', desc: 'Look open every day, minus the marketing team' },
  { href: '/audiences/agencies', title: 'Agencies', desc: 'Client content without the screenshot ping-pong' },
];

const RESOURCES: MenuLink[] = [
  { href: '/blog', title: 'Blog', desc: 'Strategy, scheduling systems and AI writing' },
  { href: '/resources', title: 'Resource library', desc: 'Templates, playbooks and cheat sheets' },
  {
    href: resourceHref('content-calendar-template'),
    title: 'Content calendar template',
    desc: 'The weekly planning sheet, ready to copy',
  },
  {
    href: resourceHref('caption-formulas-cheat-sheet'),
    title: 'Caption formulas',
    desc: 'Hooks and structures that survive the fold',
  },
];

/** Soft rounded chevron — no sharp triangles. */
function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2.5 4.5 3.5 3.5 3.5-3.5" />
    </svg>
  );
}

function DesktopDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        className="flex items-center gap-1 py-2 text-sm font-semibold text-soft transition hover:text-ink"
      >
        {label}
        <Chevron className="text-faint transition group-hover:rotate-180" />
      </button>
      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
        {children}
      </div>
    </div>
  );
}

function MenuCard({ link }: { link: MenuLink }) {
  return (
    <Link
      href={link.href}
      className="block rounded-xl px-3 py-2.5 transition hover:bg-bone"
    >
      <span className="block text-sm font-bold text-ink">{link.title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{link.desc}</span>
    </Link>
  );
}

function MobileSection({ label, links, onGo }: { label: string; links: MenuLink[]; onGo: () => void }) {
  return (
    <details className="group rounded-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-soft hover:bg-card [&::-webkit-details-marker]:hidden">
        {label}
        <Chevron className="text-faint transition group-open:rotate-180" />
      </summary>
      <div className="pb-1 pl-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={onGo}
            className="block rounded-xl px-3 py-2.5 hover:bg-card"
          >
            <span className="block text-sm font-bold text-ink">{l.title}</span>
            <span className="block text-xs text-muted">{l.desc}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const close = () => setOpen(false);
  const dash = dashboardUrl();
  const GoToSosial = ({ className, onGo }: { className?: string; onGo?: () => void }) =>
    dash.startsWith('http') ? (
      <a href={dash} className={className} onClick={onGo}>
        Go to Sosial
      </a>
    ) : (
      <Link href={dash} className={className} onClick={onGo}>
        Go to Sosial
      </Link>
    );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open ]);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-bone/85 backdrop-blur transition-colors ${
        scrolled ? 'border-line' : 'border-transparent'
      }`}
    >
      <nav className="relative mx-auto flex h-16 max-w-[1440px] items-center px-4" aria-label="Main">
        <Logo />

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 lg:flex">
          <DesktopDropdown label="Features">
            <div className="card w-80 p-2 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)]">
              {FEATURES.map((l) => (
                <MenuCard key={l.href} link={l} />
              ))}
            </div>
          </DesktopDropdown>

          <DesktopDropdown label="Integrations">
            <div className="card w-[34rem] p-4 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)]">
              <p className="eyebrow px-2">Channels</p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {CHANNEL_GUIDES.map((c) => (
                  <Link
                    key={c.key}
                    href={`/integrations/${c.key}`}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-bone"
                  >
                    <BrandIcon provider={c.key} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{c.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {c.limit.toLocaleString()}-character limit
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/integrations"
                className="mt-2 flex items-center justify-between rounded-xl bg-bone px-3 py-2.5 text-sm font-bold text-accent transition hover:bg-accent-soft"
              >
                All 10 integrations
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </DesktopDropdown>

          <DesktopDropdown label="Audiences">
            <div className="card w-80 p-2 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)]">
              {AUDIENCES.map((l) => (
                <MenuCard key={l.href} link={l} />
              ))}
            </div>
          </DesktopDropdown>

          <DesktopDropdown label="Resources">
            <div className="card w-80 p-2 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)]">
              {RESOURCES.map((l) => (
                <MenuCard key={l.href} link={l} />
              ))}
            </div>
          </DesktopDropdown>

          <Link href="/#pricing" className="py-2 text-sm font-semibold text-soft transition hover:text-ink">
            Pricing
          </Link>
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <GoToSosial className="btn btn-primary" />
        </div>

        <button
          type="button"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3.5 w-5" aria-hidden="true">
            <span
              className={`absolute inset-x-0 top-0 h-0.5 rounded bg-ink transition-transform ${
                open ? 'translate-y-1.5 rotate-45' : ''
              }`}
            />
            <span
              className={`absolute inset-x-0 top-1.5 h-0.5 rounded bg-ink transition-opacity ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`absolute inset-x-0 top-3 h-0.5 rounded bg-ink transition-transform ${
                open ? '-translate-y-1.5 -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-bone lg:hidden">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-4">
            <MobileSection label="Features" links={FEATURES} onGo={close} />
            <MobileSection
              label="Integrations"
              links={[
                ...CHANNEL_GUIDES.map((c) => ({
                  href: `/integrations/${c.key}`,
                  title: c.name,
                  desc: c.tagline,
                })),
                { href: '/integrations', title: 'All 10 integrations', desc: 'Browse every channel' },
              ]}
              onGo={close}
            />
            <MobileSection label="Audiences" links={AUDIENCES} onGo={close} />
            <MobileSection label="Resources" links={RESOURCES} onGo={close} />
            <Link
              href="/#pricing"
              onClick={close}
              className="rounded-xl px-3 py-3 text-sm font-semibold text-soft hover:bg-card"
            >
              Pricing
            </Link>
            <div className="mt-2 flex flex-col gap-2">
              <GoToSosial className="btn btn-primary" onGo={close} />
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
