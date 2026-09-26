import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SITE_PAGES, type SitePageGroup } from '@/content/sitePages';

export const dynamic = 'force-dynamic';

const GROUPS: SitePageGroup[] = ['Product', 'Channels', 'Resources', 'Company'];

type Row = {
  slug?: unknown;
  updated_at?: unknown;
  title?: unknown;
  status?: unknown;
  published_at?: unknown;
  is_custom?: unknown;
  show_in_footer?: unknown;
};

function stateOf(r: Row): { pill: string; sub: string } {
  const status = r.status === 'draft' ? 'draft' : 'published';
  const at = typeof r.published_at === 'string' ? new Date(r.published_at).getTime() : NaN;
  if (status === 'draft') return { pill: 'Draft', sub: 'hidden from the site' };
  if (!Number.isNaN(at) && at > Date.now()) {
    return {
      pill: 'Scheduled',
      sub: `goes live ${new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    };
  }
  const edited = typeof r.updated_at === 'string' ? r.updated_at : null;
  return {
    pill: 'Live',
    sub: edited ? `edited ${new Date(edited).toLocaleDateString('en-GB')}` : 'published',
  };
}

/** Owner page list: registry pages plus admin-created custom pages. */
export default async function AdminPagesList() {
  const sb = await createClient();
  const { data } = await sb
    .from('site_pages')
    .select('slug, updated_at, title, status, published_at, is_custom, show_in_footer')
    .limit(400);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.slug as string, r]));
  const custom = [...rows.values()].filter((r) => r.is_custom === true);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Pages</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.size} customized · {custom.length} custom — the rest show their default design.
          </p>
        </div>
        <Link href="/admin/pages/new" className="btn btn-primary shrink-0 !px-4 !py-2 !text-sm">
          New page
        </Link>
      </div>

      {custom.length ? (
        <div className="mt-6">
          <p className="eyebrow">Custom</p>
          <div className="mt-2 grid gap-2">
            {custom
              .sort((a, b) => String(a.slug ?? '').localeCompare(String(b.slug ?? '')))
              .map((r) => {
                const slug = String(r.slug ?? '');
                const st = stateOf(r);
                const title = typeof r.title === 'string' && r.title.trim() ? r.title : slug;
                return (
                  <div
                    key={slug}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3"
                  >
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                        st.pill === 'Live'
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-paper text-muted'
                      }`}
                    >
                      {st.pill}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{title}</p>
                      <p className="truncate text-xs text-muted">
                        /{slug} · {st.sub}
                        {r.show_in_footer === true ? ' · in footer' : ''}
                      </p>
                    </div>
                    {st.pill === 'Live' ? (
                      <Link
                        href={`/${slug}`}
                        className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                      >
                        View
                      </Link>
                    ) : null}
                    <Link
                      href={`/admin/pages/${slug}`}
                      className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                    >
                      Edit
                    </Link>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}

      {GROUPS.map((g) => (
        <div key={g} className="mt-6">
          <p className="eyebrow">{g}</p>
          <div className="mt-2 grid gap-2">
            {SITE_PAGES.filter((p) => p.group === g).map((p) => {
              const row = rows.get(p.slug);
              const st = row ? stateOf(row) : null;
              return (
                <div
                  key={p.slug}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3"
                >
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      st && st.pill !== 'Draft'
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-paper text-muted'
                    }`}
                  >
                    {st ? (st.pill === 'Live' ? 'Customized' : st.pill) : 'Default'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.label}</p>
                    <p className="truncate text-xs text-muted">
                      {p.route}
                      {st ? ` · ${st.sub}` : ` · ${p.hint}`}
                    </p>
                  </div>
                  <Link
                    href={p.route}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/pages/${p.slug}`}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                  >
                    Edit
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
