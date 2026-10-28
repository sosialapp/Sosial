import { redirect } from 'next/navigation';
import DocsEditor from '@/components/docs/DocsEditor';
import { adminDocs } from '@/lib/docsAdminRead';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New docs page' };

export default async function AdminDocsNew() {
  const { sections, pages } = await adminDocs();
  // A page needs a section; the list page is where sections are added.
  if (!sections.length) redirect('/admin/docs');
  return <DocsEditor sections={sections} pages={pages} initial={null} />;
}
