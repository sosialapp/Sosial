import HubPage from '../post/hub-page';

export const metadata = { title: 'Import' };

export const dynamic = 'force-dynamic';

/** Bulk import (Notion) at its own URL, a Post hub tab. */
export default async function PostImportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  return <HubPage tab="import" searchTab={sp?.tab} />;
}
