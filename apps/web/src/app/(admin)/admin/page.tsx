import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLANNED = [
  {
    title: 'Sales',
    desc: 'Revenue, plans and churn — needs a payment provider (Stripe) first.',
  },
  {
    title: 'Notifications',
    desc: 'Push to iOS/Android via the worker (needs push-token registration).',
  },
  {
    title: 'Marketing email',
    desc: 'Campaigns via an ESP (needs Resend/Postmark + domain DNS).',
  },
];

/** Owner overview: live counts today, roadmap cards for the rest. */
export default async function AdminOverview() {
  const sb = await createClient();
  const [{ count: open }, { count: total }] = await Promise.all([
    sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb.from('reports').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div>
      <p className="eyebrow">Owner console</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Overview</h1>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/reports"
          className="rounded-2xl border border-line bg-card p-5 transition hover:border-faint"
        >
          <p className="font-display text-3xl font-extrabold">{open ?? 0}</p>
          <p className="mt-1 text-sm font-bold">Open reports</p>
          <p className="mt-0.5 text-xs text-muted">{total ?? 0} total · tap to triage →</p>
        </Link>
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="font-display text-3xl font-extrabold">—</p>
          <p className="mt-1 text-sm font-bold">Sales</p>
          <p className="mt-0.5 text-xs text-muted">No payment provider connected yet</p>
        </div>
      </div>

      <div className="mt-3">
        <Link
          href="/admin/blog"
          className="block rounded-2xl border border-line bg-card p-5 transition hover:border-faint"
        >
          <p className="text-sm font-bold">Blog →</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Write, edit and publish posts. Live on /blog within minutes.
          </p>
        </Link>
      </div>

      <h2 className="mt-8 font-display text-lg font-extrabold">Roadmap</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PLANNED.map((c) => (
          <div key={c.title} className="rounded-2xl border border-line bg-card p-5 opacity-80">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">{c.title}</p>
              <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-bold text-muted">
                Planned
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
