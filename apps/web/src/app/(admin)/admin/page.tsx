import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import { ArrowRight, BookOpen, FileText, Flag, LayoutTemplate, Megaphone, Plus } from 'lucide-react';
import { SITE_PAGES } from '@/content/sitePages';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const PLANNED = [
  {
    title: 'Sales',
    desc: 'Revenue, plans and churn. Needs a payment provider (Stripe) first.',
  },
  {
    title: 'Marketing email',
    desc: 'Campaigns via an ESP (needs Resend/Postmark + domain DNS).',
  },
];

interface OpenReport {
  id: string;
  kind: string;
  subject: string | null;
  email: string | null;
  created_at: string;
}

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const n = (v: number | null | undefined): string => (v == null ? '-' : v.toLocaleString('en-US'));

/** Owner overview: what needs attention now, live counts, then the tools. */
export default async function AdminOverview() {
  const sb = await createClient();
  // Head-only counts; a failing query reads "-" instead of taking the page down.
  const count = (q: PromiseLike<{ count: number | null; error: unknown }>) =>
    Promise.resolve(q).then((r) => (r.error ? null : r.count ?? 0), () => null);
  const head = { count: 'exact' as const, head: true };
  const [openReports, totalReports, blogLive, blogDrafts, pages, docs, devices, latest, lastNotice] = await Promise.all([
    count(sb.from('reports').select('id', head).eq('status', 'open')),
    count(sb.from('reports').select('id', head)),
    count(sb.from('blog_posts').select('id', head).eq('status', 'published')),
    count(sb.from('blog_posts').select('id', head).neq('status', 'published')),
    // Same sum as /admin/pages: the built-in registry plus custom pages; the
    // table only holds customized or custom rows.
    sb
      .from('site_pages')
      .select('slug, is_custom')
      .limit(400)
      .then((r) =>
        r.error ? null : { edited: (r.data ?? []).length, custom: (r.data ?? []).filter((x) => x.is_custom === true).length },
      ),
    count(sb.from('docs_pages').select('id', head)),
    count(sb.from('push_tokens').select('id', head)),
    sb
      .from('reports')
      .select('id, kind, subject, email, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5)
      .then((r) => (r.error ? [] : ((r.data ?? []) as OpenReport[]))),
    sb
      .from('announcements')
      .select('title, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .then((r) => (r.error ? null : ((r.data?.[0] ?? null) as { title: string; created_at: string } | null))),
  ]);

  const pageTotal = pages ? SITE_PAGES.length + pages.custom : null;

  const stats: { label: string; value: string; sub: string; href: string; alert?: boolean }[] = [
    {
      label: 'Open reports',
      value: n(openReports),
      sub: `${n(totalReports)} total`,
      href: '/admin/reports',
      alert: (openReports ?? 0) > 0,
    },
    { label: 'Blog posts live', value: n(blogLive), sub: `${n(blogDrafts)} drafts`, href: '/admin/blog' },
    { label: 'Site pages', value: n(pageTotal), sub: `${n(pages?.edited)} customized`, href: '/admin/pages' },
    { label: 'Push devices', value: n(devices), sub: 'Reachable by a notice', href: '/admin/notifications' },
  ];

  const tools: { title: string; desc: string; href: string; icon: Icon; meta: string }[] = [
    {
      title: 'Blog',
      desc: 'Write, edit and publish posts. Live on /blog within minutes.',
      href: '/admin/blog',
      icon: FileText,
      meta: `${n(blogLive)} live`,
    },
    {
      title: 'Pages',
      desc: 'Edit product, channel, resource and company pages. Same editor as the blog.',
      href: '/admin/pages',
      icon: LayoutTemplate,
      meta: `${n(pageTotal)} pages`,
    },
    {
      title: 'Docs',
      desc: 'Write and order the help pages at docs.sosial.app. Markdown with a live preview.',
      href: '/admin/docs',
      icon: BookOpen,
      meta: `${n(docs)} pages`,
    },
    {
      title: 'Notify',
      desc: 'Send an announcement to the in-app bell and, on request, to devices.',
      href: '/admin/notifications',
      icon: Megaphone,
      meta: lastNotice ? `Last ${ago(lastNotice.created_at)}` : 'Nothing sent yet',
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Overview</h1>
          <p className="mt-1 text-sm text-muted">What needs you today, and the tools that run the site.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/notifications" className="btn btn-ghost btn-sm">
            <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
            Send a notice
          </Link>
          <Link href="/admin/blog/new" className="btn btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New post
          </Link>
        </div>
      </div>

      {/* Live numbers: one card, cells split by hairlines (the analytics hero look). */}
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-card lg:grid-cols-4">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            className={`group relative border-line p-4 transition hover:bg-surface sm:p-5 ${i % 2 === 1 ? 'border-l' : ''} ${
              i > 1 ? 'border-t lg:border-t-0' : ''
            } ${i > 0 ? 'lg:border-l' : ''}`}
          >
            {s.alert ? <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" /> : null}
            <p className="text-xs font-bold text-muted">{s.label}</p>
            <p className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[2rem]">
              {s.value}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-faint">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Needs attention: the newest open reports, straight to triage. */}
        <section className="card p-5 lg:col-span-2" aria-labelledby="admin-attention">
          <div className="flex items-center justify-between gap-2">
            <h2 id="admin-attention" className="font-display text-base font-extrabold tracking-tight">
              Needs attention
            </h2>
            <Link href="/admin/reports" className="text-xs font-bold text-ink hover:underline">
              Open inbox
            </Link>
          </div>
          {latest.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line-soft bg-card px-4 py-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-soft">
                <Flag className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm text-muted">No open reports. New bugs, ideas and billing questions land here.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft bg-card">
              {latest.map((r) => (
                <li key={r.id}>
                  <Link href="/admin/reports" className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface">
                    <span className="pill shrink-0 border border-line bg-paper font-bold capitalize text-soft">{r.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{r.subject || 'No subject'}</span>
                      <span className="block truncate text-[11px] text-muted">{r.email || 'Anonymous'}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-faint">{ago(r.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Roadmap: what the console will grow into, clearly not live yet. */}
        <section className="card p-5" aria-labelledby="admin-roadmap">
          <h2 id="admin-roadmap" className="font-display text-base font-extrabold tracking-tight">
            Roadmap
          </h2>
          <ul className="mt-3 space-y-3">
            {PLANNED.map((c) => (
              <li key={c.title} className="rounded-2xl border border-line-soft bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{c.title}</p>
                  <span className="pill border border-line bg-paper font-bold text-muted">Planned</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{c.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h2 className="mt-8 font-display text-lg font-extrabold tracking-tight">Content and tools</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col rounded-2xl border border-line bg-card p-5 transition hover:border-faint"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-ink">
              <tool.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-bold">{tool.title}</p>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">{tool.desc}</p>
            <span className="mt-4 flex items-center justify-between gap-2 text-[11px] font-bold text-faint">
              {tool.meta}
              <ArrowRight className="h-3.5 w-3.5 text-soft transition group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
