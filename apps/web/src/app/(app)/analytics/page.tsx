import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import { StatCard } from '@/components/ui';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import type { ProviderKey } from '@/lib/types';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DAY = 24 * 3600_000;

const fmtDate = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ACTIVE_TARGET = new Set(['pending', 'needs_approval', 'queued', 'publishing']);

/** Full analytics: pipeline funnel, per-channel delivery, weekly rhythm, recent sends. */
export default async function AnalyticsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);

  const now = Date.now();
  const byStatus = (s: string[]) => posts.filter((p) => s.includes(p.status));
  const drafts = byStatus(['draft']).length;
  const queued = byStatus(['queued', 'publishing', 'approval']).length;
  const sent = byStatus(['sent', 'partial']);
  const failed = byStatus(['failed']).length;
  const sentWeek = sent.filter((p) => p.sent_at && now - new Date(p.sent_at).getTime() < 7 * DAY).length;
  const liveChannels = channels.filter((c) => c.status === 'connected').length;
  const funnelMax = Math.max(1, drafts, queued, sent.length, failed);

  // Per-channel delivery across every target ever recorded.
  const perChannel = new Map<ProviderKey, { sent: number; active: number; failed: number }>();
  for (const p of posts) {
    for (const t of p.post_targets ?? []) {
      const row = perChannel.get(t.provider) ?? { sent: 0, active: 0, failed: 0 };
      if (t.status === 'sent') row.sent += 1;
      else if (t.status === 'failed' || t.status === 'skipped') row.failed += 1;
      else if (ACTIVE_TARGET.has(t.status)) row.active += 1;
      perChannel.set(t.provider, row);
    }
  }
  const channelRows = [...perChannel.entries()]
    .map(([provider, r]) => ({ provider, ...r, total: r.sent + r.active + r.failed }))
    .sort((a, b) => b.sent - a.sent || b.total - a.total);

  // Weekly rhythm: sent posts per week, last 8 weeks.
  const weeks: { label: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY;
    const end = now - i * 7 * DAY;
    const count = sent.filter((p) => {
      if (!p.sent_at) return false;
      const t = new Date(p.sent_at).getTime();
      return t >= start && t < end;
    }).length;
    weeks.push({
      label: new Date(end).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      count,
    });
  }
  const weekMax = Math.max(1, ...weeks.map((w) => w.count));

  const recent = [...sent]
    .filter((p) => p.sent_at)
    .sort((a, b) => +new Date(b.sent_at!) - +new Date(a.sent_at!))
    .slice(0, 5);

  const funnel: { label: string; value: number; href: string; bar: string }[] = [
    { label: 'Drafts', value: drafts, href: '/queue', bar: 'bg-surface' },
    { label: 'Queued', value: queued, href: '/calendar', bar: 'bg-bolt' },
    { label: 'Sent', value: sent.length, href: '/queue', bar: 'bg-ink' },
    { label: 'Failed', value: failed, href: '/queue', bar: 'bg-[#E60023]' },
  ];

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Analytics</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        How you&apos;re doing
      </h1>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Posts sent" value={sent.length} href="/queue" />
        {[
          { label: 'Sent this week', value: sentWeek, href: '/queue' },
          { label: 'Scheduled', value: queued, href: '/calendar' },
          { label: 'Channels live', value: `${liveChannels}/${channels.length}`, href: '/channels' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card group p-4 transition hover:border-ink sm:p-5">
            <p className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-muted">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Pipeline */}
        <section className="card p-5" aria-label="Pipeline">
          <p className="eyebrow">Pipeline</p>
          <ul className="mt-3 space-y-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <Link href={f.href} className="font-bold hover:text-ink">
                    {f.label}
                  </Link>
                  <span className="font-display font-extrabold">{f.value}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                  <div className={`h-full rounded-full ${f.bar}`} style={{ width: `${Math.round((f.value / funnelMax) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Weekly rhythm */}
        <section className="card p-5 lg:col-span-2" aria-label="Weekly rhythm">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Sends per week · last 8 weeks</p>
            <p className="text-xs font-bold text-muted">best: {weekMax}/wk</p>
          </div>
          <div className="mt-4 flex h-36 items-end gap-2">
            {weeks.map((w) => (
              <div key={w.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${w.count} sent`}>
                <span className="text-xs font-bold">{w.count > 0 ? w.count : ''}</span>
                <div
                  className={`w-full max-w-10 rounded-t-lg ${w.count > 0 ? 'bg-bolt' : 'bg-surface'}`}
                  style={{ height: `${Math.max(w.count > 0 ? 8 : 4, Math.round((w.count / weekMax) * 100))}%` }}
                />
                <span className="text-[10px] text-faint">{w.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Per-channel delivery */}
        <section className="card p-5 lg:col-span-2" aria-label="Per-channel delivery">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Delivery by channel</p>
            <Link href="/channels" className="text-xs font-bold text-ink hover:underline">
              Manage
            </Link>
          </div>
          {channelRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing published yet. Your per-channel numbers land here after the first send.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft">
              {channelRows.map((r) => {
                const meta = providerMeta(r.provider);
                const ok = Math.round((r.sent / Math.max(1, r.total)) * 100);
                return (
                  <li key={r.provider} className="flex items-center gap-3 py-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${meta.color}14` }}
                    >
                      <BrandIcon provider={r.provider} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold">{meta.label}</p>
                        <p className="shrink-0 text-xs text-muted">
                          {r.sent} sent · {r.active} active · {r.failed} failed
                        </p>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-[#2f8f5b]" style={{ width: `${ok}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recently sent */}
        <section className="card p-5" aria-label="Recently sent">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Recently sent</p>
            <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
              Queue
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No sends yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recent.map((p) => {
                const providers = [...new Set((p.post_targets ?? []).map((t) => t.provider))];
                const st = POST_STATUS_META[p.status];
                return (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <div className="flex shrink-0 items-center" aria-hidden="true">
                      {providers.slice(0, 3).map((pv, i) => (
                        <span
                          key={pv}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-paper"
                          style={{ marginLeft: i === 0 ? 0 : -7 }}
                          title={providerMeta(pv).label}
                        >
                          <BrandIcon provider={pv} className="h-3 w-3" />
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.title || 'Untitled post'}</p>
                      <p className="text-xs text-muted">{fmtDate(p.sent_at)}</p>
                    </div>
                    <span className={`pill shrink-0 ${st.className}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="card mt-3 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Likes, comments and reach per post arrive with the stats pipeline.</p>
        <Link href="/new" className="btn btn-bolt shrink-0">
          Create a post
        </Link>
      </div>
    </div>
  );
}
