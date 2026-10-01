import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Merged into /post — the All pill preserves the old publish-list view. */
export default function PostPublishPage() {
  redirect('/post?filter=all');
}
