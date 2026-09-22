import Link from 'next/link';
import BlogEditor from '@/components/BlogEditor';

export const dynamic = 'force-dynamic';

/** Owner new post. */
export default function AdminBlogNew() {
  return (
    <div>
      <Link href="/admin/blog" className="text-xs font-bold text-muted hover:text-ink">
        ← All posts
      </Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        New post
      </h1>
      <div className="mt-4">
        <BlogEditor initial={null} />
      </div>
    </div>
  );
}
