import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import ThemeToggle from '@/components/ThemeToggle';
import { providerMeta } from '@/lib/providers';
import { fetchChannels, fetchPosts } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/dashboard', label: 'Dashboard', sub: 'Today at a glance' },
  { href: '/new', label: 'Create', sub: 'Post, ideas and templates' },
  { href: '/queue', label: 'Queue', sub: 'Everything scheduled and sent' },
  { href: '/calendar', label: 'Calendar', sub: 'The month view' },
  { href: '/analytics', label: 'Analytics', sub: 'Pipeline, channels, rhythm' },
];

export default async function ProfilePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPosts(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);
  const initial = (ctx.user.email?.[0] ?? ctx.workspace.name[0] ?? 'S').toUpperCase();

  const sent = posts.filter((p) => p.status === 'sent' || p.status === 'partial').length;
  const scheduled = posts.filter(
    (p) => p.status === 'queued' || p.status === 'publishing' || p.status === 'approval',
  ).length;
  const live = channels.filter((c) => c.status === 'connected').length;

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Profile</p>
      <div className="card mt-3 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-xl font-extrabold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold">{ctx.workspace.name}</p>
          <p className="truncate text-sm text-muted">{ctx.user.email}</p>
        </div>
        <span className="pill shrink-0 bg-accent-soft text-accent-ink">{ctx.workspace.role}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: 'Sent', value: sent, href: '/queue' },
          { label: 'Scheduled', value: scheduled, href: '/calendar' },
          { label: 'Channels', value: `${live}/${channels.length}`, href: '/channels' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card group p-4 text-center transition hover:border-accent">
            <p className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="card mt-3 p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Channels</p>
          <Link href="/channels" className="text-xs font-bold text-accent hover:underline">
            Manage →
          </Link>
        </div>
        {channels.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing connected yet — connect accounts in the mobile app.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {channels.slice(0, 4).map((c) => {
              const meta = providerMeta(c.provider);
              const ok = c.status === 'connected';
              return (
                <li key={c.id} className="flex items-center gap-2.5">
                  <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {c.handle ? `@${c.handle}` : (c.display_name ?? meta.label)}
                  </span>
                  <span
                    aria-hidden="true"
                    title={c.status}
                    className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-[#2f8f5b]' : 'bg-[#E60023]'}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {channels.length > 4 ? (
          <p className="mt-2 text-xs text-muted">+{channels.length - 4} more in Channels.</p>
        ) : null}
      </div>

      <div className="card mt-3 divide-y divide-line-soft">
        {SECTIONS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-bone dark:hover:bg-white/5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{l.label}</span>
              <span className="block truncate text-xs text-muted">{l.sub}</span>
            </span>
            <span aria-hidden="true" className="text-faint">›</span>
          </Link>
        ))}
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Appearance</span>
            <span className="block text-xs text-muted">Light or dark dashboard</span>
          </span>
          <ThemeToggle />
        </div>
      </div>

      <form action="/auth/signout" method="post" className="mt-3">
        <button type="submit" className="btn btn-ghost w-full">
          Sign out
        </button>
      </form>
    </div>
  );
}
