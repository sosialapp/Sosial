import { notFound } from 'next/navigation';
import PageEditor from '@/components/PageEditor';
import { sitePageDef, isValidSiteSlug } from '@/content/sitePages';
import { sitePageDoc } from '@/lib/sitePages';

export const dynamic = 'force-dynamic';

/** Owner page editor — only registered slugs open here. */
export default async function AdminPageEdit({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const full = (slug ?? []).join('/');
  const def = isValidSiteSlug(full) ? sitePageDef(full) : undefined;
  if (!def) notFound();
  const initial = await sitePageDoc(full);
  return <PageEditor def={def} initial={initial?.body ?? null} loadedAt={initial?.updatedAt ?? null} />;
}
