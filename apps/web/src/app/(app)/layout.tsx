import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import Dock from '@/components/Dock';
import ThemeScope from '@/components/ThemeScope';
import ThemeToggle from '@/components/ThemeToggle';
import { providerMeta } from '@/lib/providers';
import { fetchLiveChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext, hasSupabaseEnv } from '@/lib/supabase/server';
import type { ConnectedChannel } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Masthead Connect pill, same as the mobile app: card pill with a stacked
 * row of brand tiles (20px colour disc + white glyph, max 4 then +n) and
 * "Connect". deliberately photo-free — profile pictures with corner badges
 * turn to clutter at this size. Stack shows only when channels are connected.
 */
function ConnectHeader({ channels }: { channels: ConnectedChannel[] }) {
  const MAX_LOGOS = 4;
  const shown = channels.slice(0, MAX_LOGOS);
  const extra = channels.length - shown.length;
  return (
    <Link
      href="/channels"
      aria-label={channels.length ? `${channels.length} channels, manage` : 'Connect channels'}
      className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-card pl-2 pr-3 transition hover:shadow-[0_2px_8px_rgba(28,26,20,0.12)]"
    >
      {shown.length > 0 ? (
        <span className="flex items-center">
          {shown.map((c, i) => (
            <span
              key={c.id}
              className="flex shrink-0 rounded-full ring-2 ring-card"
              style={{ marginLeft: i === 0 ? 0 : -7, zIndex: shown.length - i }}
              title={providerMeta(c.provider).label}
            >
              <BrandIcon provider={c.provider as BrandProvider} className="h-5 w-5" />
            </span>
          ))}
          {extra > 0 ? (
            <span className="ml-1 text-xs font-bold text-muted">+{extra}</span>
          ) : null}
        </span>
      ) : null}
      <span className="text-sm font-bold text-soft">Connect</span>
    </Link>
  );
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!hasSupabaseEnv()) redirect('/login');
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchLiveChannels(sb, ctx.workspace.id);

  return (
    <ThemeScope className="app-shell min-h-screen bg-bone text-ink">
      {/* Floating pill masthead: detached look, aligned to the content
          column. The sticky zone itself is opaque theme background (the
          document body is hardwired white, which would bleed through a
          transparent zone) and uses padding, not margin, so no gap can
          show through. Left clearance keeps it clear of the fixed rail. */}
      <div className="sticky top-0 z-30 bg-bone pt-3 pr-4 pb-2 pl-[76px] sm:pr-6 sm:pl-24">
        <header className="mx-auto flex h-12 w-full max-w-7xl items-center gap-2.5 rounded-full border border-line bg-card/95 pr-2 pl-4 shadow-[0_8px_30px_rgba(28,26,20,0.12)] backdrop-blur-sm">
          <Image src="/bolt.png" alt="Sosial" width={24} height={24} />
          <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">{ctx.workspace.name}</p>
          <ConnectHeader channels={channels} />
          <Link
            href="/team"
            className="hidden h-9 items-center rounded-full border border-line bg-paper px-3 text-sm font-bold text-soft transition hover:bg-bone sm:inline-flex"
          >
            Team
          </Link>
          <ThemeToggle />
        </header>
      </div>
      {/* Left clearance for the fixed rail on every breakpoint; no bottom dock anymore. */}
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 pr-4 pb-14 pl-[76px] sm:pl-24 sm:pr-6">{children}</main>
      <Dock />
    </ThemeScope>
  );
}
