import { redirect } from 'next/navigation';

export const metadata = { title: 'Import' };

export const dynamic = 'force-dynamic';

/** Legacy /import URL: bulk import now lives as a Post hub tab. */
export default function ImportPage() {
  redirect('/post-import');
}
