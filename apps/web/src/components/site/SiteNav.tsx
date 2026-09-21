'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Logo from './Logo';

const LINKS = [
  { href: '/#ai', label: 'AI writer' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/#how', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/resources', label: 'Resources' },
  { href: '/blog', label: 'Blog' },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-bone/85 backdrop-blur transition-colors ${
        scrolled ? 'border-line' : 'border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-6 text-sm font-semibold text-soft lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/login" className="btn btn-primary">
            Get started free
          </Link>
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
        <div id="mobile-nav" className="border-t border-line bg-bone lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-soft hover:bg-card"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/login" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Log in
              </Link>
              <Link href="/login" className="btn btn-primary" onClick={() => setOpen(false)}>
                Get started free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
