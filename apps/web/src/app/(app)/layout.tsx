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

/**
 * Header Connect pill: stacked brand discs + "Connect".
 * Connected channels when present; facebook/instagram/threads when empty
 * (same visual as the design reference).
 */
function ConnectHeader({ channels }: { channels: { id: string; provider: string }[] }) {
  const defaults = [
    { id: 'fb', provider: 'facebook' },
    { id: 'ig', provider: 'instagram' },
    { id: 'th', provider: 'threads' },
  ];
  const source = channels.length > 0 ? channels : defaults;
  const shown = source.slice(0, 3);
  const extra = channels.length > 3 ? channels.length - 3 : 0;
  return (
    <Link
      href="/channels"
      aria-label={channels.length ? `${channels.length} channels, manage` : 'Connect channels'}
      className="flex shrink-0 items-center gap-2 rounded-full border border-[#E5DDD0] bg-[#F6F1E8] py-1 pl-1 pr-3.5 shadow-[0_1px_2px_rgba(28,26,20,0.06)] transition hover:shadow-[0_2px_8px_rgba(28,26,20,0.12)] sm:pr-4"
    >
      <span className="flex -space-x-2">
        {shown.map((c, i) => (
          <span
            key={c.id}
            className="rounded-full ring-2 ring-[#F6F1E8]"
            style={{ zIndex: shown.length - i }}
            title={providerMeta(c.provider).label}
          >
            <BrandIcon provider={c.provider as never} className="h-7 w-7" />
          </span>
        ))}
      </span>
      {extra > 0 ? (
        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-extrabold text-[#5C3317]">
          +{extra}
        </span>
      ) : null}
      <span className="text-sm font-extrabold tracking-tight text-[#5C3317]">Connect</span>
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
