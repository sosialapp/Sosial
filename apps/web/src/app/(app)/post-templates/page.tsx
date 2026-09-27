import HubPage from '../post/hub-page';

export const dynamic = 'force-dynamic';

/** Templates studio at its own URL. */
export default async function PostTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  return <HubPage tab="templates" searchTab={sp?.tab} />;
}
