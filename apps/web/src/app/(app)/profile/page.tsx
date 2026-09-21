import Link from 'next/link';
import { redirect } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const QUICK_LINKS = [
  { href: '/channels', label: 'Channels', sub: 'Connect or review social accounts' },
  { href: '/queue', label: 'Queue', sub: 'Everything scheduled and sent' },
  { href: '/calendar', label: 'Dashboard', sub: 'Back to the calendar' },
];

export default async function ProfilePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const initial = (ctx.user.email?.[0] ?? ctx.workspace.name[0] ?? 'S').toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
      <p className="eyebrow">Profile</p>
      <div className="card mt-3 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-xl font-extrabold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold">{ctx.workspace.name}</p>
          <p className="truncate text-sm text-muted">{ctx.user.email}</p>
        </div>
        <span className="pill bg-accent-soft text-accent-ink">{ctx.workspace.role}</span>
      </div>

      <div className="card mt-3 divide-y divide-line-soft">
        {QUICK_LINKS.map((l) => (
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
