import HubPage from '../post/hub-page';

export const dynamic = 'force-dynamic';

/** Publish queue at its own URL. */
export default async function PostPublishPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  return <HubPage tab="publish" searchTab={sp?.tab} />;
}
