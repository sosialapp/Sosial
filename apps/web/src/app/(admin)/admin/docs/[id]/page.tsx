import { notFound } from 'next/navigation';
import DocsEditor from '@/components/docs/DocsEditor';
import { adminDocs } from '@/lib/docsAdminRead';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit docs page' };

export default async function AdminDocsEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sections, pages } = await adminDocs();
  const page = pages.find((p) => p.id === id);
  if (!page) notFound();
  // key: a fresh editor state after router.replace from /new.
  return <DocsEditor key={page.id} sections={sections} pages={pages} initial={page} />;
}
