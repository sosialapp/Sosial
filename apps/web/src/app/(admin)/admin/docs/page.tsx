import DocsAdminList from '@/components/docs/DocsAdminList';
import { adminDocs } from '@/lib/docsAdminRead';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Docs' };

/** Owner docs list: sections, pages, order and publish state. */
export default async function AdminDocsList() {
  const { sections, pages } = await adminDocs();
  return <DocsAdminList sections={sections} pages={pages} />;
}
