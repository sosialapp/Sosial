import HubPage from './hub-page';

export const dynamic = 'force-dynamic';

/** Mobile-style Post hub: quick composer, templates, publish, ideas. */
export default async function PostPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  return <HubPage tab="post" searchTab={sp?.tab} />;
}
