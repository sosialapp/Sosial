import { notFound } from 'next/navigation';
import PageEditor, { type AdminPageMeta } from '@/components/PageEditor';
import { sitePageDef, isValidSiteSlug, type SitePageDef } from '@/content/sitePages';
import { sitePageDoc } from '@/lib/sitePages';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type MetaRow = {
  title?: unknown;
  meta_title?: unknown;
  meta_description?: unknown;
  published_at?: unknown;
  status?: unknown;
  show_in_footer?: unknown;
  is_custom?: unknown;
};

/**
 * Owner page editor — registry slugs plus admin-created custom slugs.
 * Metadata loads with the admin session (not the public anon path) so
 * drafts open here even though they are invisible publicly.
 */
export default async function AdminPageEdit({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const full = (slug ?? []).join('/');
  if (!isValidSiteSlug(full)) notFound();

  const registered = sitePageDef(full);

  let def: SitePageDef;
  let meta: AdminPageMeta;
  let initial: unknown = null;
  let loadedAt: string | null = null;

  if (registered) {
    def = registered;
    const doc = await sitePageDoc(full);
    initial = doc?.body ?? null;
    loadedAt = doc?.updatedAt ?? null;
    const sb = await createClient();
    const { data } = await sb
      .from('site_pages')
      .select('title, meta_title, meta_description, published_at, status, show_in_footer')
      .eq('slug', full)
      .maybeSingle();
    const r = (data ?? {}) as MetaRow;
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    meta = {
      title: str(r.title),
      metaTitle: str(r.meta_title),
      metaDescription: str(r.meta_description),
      publishedAt: str(r.published_at),
      status: r.status === 'draft' ? 'draft' : 'published',
      showInFooter: r.show_in_footer === true,
      isCustom: false,
    };
  } else {
    const sb = await createClient();
    const { data } = await sb
      .from('site_pages')
      .select('body, updated_at, title, meta_title, meta_description, published_at, status, show_in_footer, is_custom')
      .eq('slug', full)
      .maybeSingle();
    const r = data as (MetaRow & { body?: unknown; updated_at?: unknown }) | null;
    if (!r || r.is_custom !== true) notFound();
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    const title = str(r.title);
    def = {
      slug: full,
      label: title && title.trim() ? title : full,
      group: 'Custom',
      route: `/${full}`,
      mode: 'body',
      hint: 'Standalone page — title, date and SEO live in Page settings below.',
    };
    initial = (r.body as unknown) ?? null;
    loadedAt = str(r.updated_at);
    meta = {
      title,
      metaTitle: str(r.meta_title),
      metaDescription: str(r.meta_description),
      publishedAt: str(r.published_at),
      status: r.status === 'draft' ? 'draft' : 'published',
      showInFooter: r.show_in_footer === true,
      isCustom: true,
    };
  }

  return <PageEditor def={def} initial={initial} loadedAt={loadedAt} meta={meta} />;
}
