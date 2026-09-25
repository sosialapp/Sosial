import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SITE_PAGES, type SitePageGroup } from '@/content/sitePages';

export const dynamic = 'force-dynamic';

const GROUPS: SitePageGroup[] = ['Product', 'Channels', 'Resources', 'Company'];

/** Owner page list: CMS-managed marketing pages grouped like the footer. */
export default async function AdminPagesList() {
  const sb = await createClient();
  const { data } = await sb.from('site_pages').select('slug, updated_at').limit(200);
  const customized = new Map((data ?? []).map((r) => [r.slug as string, r.updated_at as string]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Pages</h1>
          <p className="mt-1 text-sm text-muted">
            {customized.size} of {SITE_PAGES.length} pages customized — the rest show their default design.
          </p>
        </div>
      </div>
      {GROUPS.map((g) => (
        <div key={g} className="mt-6">
          <p className="eyebrow">{g}</p>
          <div className="mt-2 grid gap-2">
            {SITE_PAGES.filter((p) => p.group === g).map((p) => {
              const touched = customized.get(p.slug);
              return (
                <div
                  key={p.slug}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3"
                >
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      touched
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-paper text-muted'
                    }`}
                  >
                    {touched ? 'Customized' : 'Default'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.label}</p>
                    <p className="truncate text-xs text-muted">
                      {p.route}
                      {touched
                        ? ` · edited ${new Date(touched).toLocaleDateString('en-GB')}`
                        : ` · ${p.hint}`}
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
