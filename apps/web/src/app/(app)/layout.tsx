import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import Dock from '@/components/Dock';
import ThemeScope from '@/components/ThemeScope';
import ThemeToggle from '@/components/ThemeToggle';
import { providerMeta } from '@/lib/providers';
import { fetchChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext, hasSupabaseEnv } from '@/lib/supabase/server';
import type { ConnectedChannel } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Masthead Connect pill, same as the mobile app: card pill with a stacked
 * row of channel avatars (avatar tile + brand badge, max 4 then +n) and
 * "Connect". Stack shows only when channels are connected.
 */
function ConnectHeader({ channels }: { channels: ConnectedChannel[] }) {
  const MAX_LOGOS = 4;
  const shown = channels.slice(0, MAX_LOGOS);
  const extra = channels.length - shown.length;
  return (
    <Link
      href="/channels"
      aria-label={channels.length ? `${channels.length} channels, manage` : 'Connect channels'}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-card pl-2.5 pr-4 transition hover:shadow-[0_2px_8px_rgba(28,26,20,0.12)]"
    >
      {shown.length > 0 ? (
        <span className="flex items-center">
          {shown.map((c, i) => (
            <span
              key={c.id}
              className="rounded-full ring-2 ring-card"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
              title={providerMeta(c.provider).label}
            >
              <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={28} />
            </span>
          ))}
          {extra > 0 ? (
            <span className="ml-1 text-xs font-bold text-muted">+{extra}</span>
          ) : null}
        </span>
      ) : null}
      <span className="text-[13px] font-extrabold tracking-tight text-accent-ink">Connect</span>
    </Link>
  );
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!hasSupabaseEnv()) redirect('/login');
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchChannels(sb, ctx.workspace.id);

  return (
    <ThemeScope className="app-shell min-h-screen bg-bone text-ink">
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-card/95 py-3 pr-4 pl-[76px] backdrop-blur-sm sm:pl-24">
        <Image src="/bolt.png" alt="Sosial" width={24} height={24} />
        <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">{ctx.workspace.name}</p>
        <p className="hidden truncate text-xs text-muted md:block">{ctx.user.email}</p>
        <ConnectHeader channels={channels} />
        <Link
          href="/team"
          className="hidden h-11 items-center rounded-full border border-line bg-paper px-4 text-sm font-bold text-soft transition hover:bg-bone sm:inline-flex"
        >
          Team
        </Link>
        <ThemeToggle />
      </header>
      {/* Left clearance for the fixed rail on every breakpoint; no bottom dock anymore. */}
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 pr-4 pb-14 pl-[76px] sm:pl-24 sm:pr-6">{children}</main>
      <Dock />
    </ThemeScope>
  );
}
