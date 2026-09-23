import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import Dock from '@/components/Dock';
import ThemeScope from '@/components/ThemeScope';
import ThemeToggle from '@/components/ThemeToggle';
import { providerMeta } from '@/lib/providers';
import { fetchChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext, hasSupabaseEnv } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Connected channels as a stacked avatar row, max 4 then +n. Links to /channels. */
function ChannelStackHeader({
  channels,
}: {
  channels: { id: string; provider: string }[];
}) {
  if (channels.length === 0) {
    return (
      <Link
        href="/channels"
        className="hidden rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-bold text-muted transition hover:border-ink hover:text-ink sm:block"
      >
        Connect
      </Link>
    );
  }
  const shown = channels.slice(0, 4);
  const extra = channels.length - shown.length;
  return (
    <Link
      href="/channels"
      aria-label={`${channels.length} connected channels`}
      className="flex items-center"
    >
      {shown.map((c, i) => (
        <span
          key={c.id}
          title={providerMeta(c.provider).label}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-paper ring-1 ring-line"
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: shown.length - i }}
        >
          <BrandIcon provider={c.provider as never} className="h-4 w-4" />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="ml-1.5 flex h-8 items-center rounded-full bg-paper-dim px-2 text-xs font-extrabold text-soft ring-1 ring-line"
          aria-label={`+${extra} more`}
        >
          +{extra}
        </span>
      ) : null}
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
        <ChannelStackHeader channels={channels} />
        <Link
          href="/team"
          className="hidden rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone sm:block"
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
