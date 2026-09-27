import HubPage from '../post/hub-page';

export const dynamic = 'force-dynamic';

/** Ideas inbox at its own URL. */
export default async function PostIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  return <HubPage tab="ideas" searchTab={sp?.tab} />;
}
