import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogEditor, { type BlogDraft } from '@/components/BlogEditor';
import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/content/types';

export const dynamic = 'force-dynamic';

/** Owner edit post (RLS: admins only). */
export default async function AdminBlogEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb
    .from('blog_posts')
    .select('id, slug, title, description, body, tag, minutes, status, published_at')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();

  const initial: BlogDraft = {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    description: (data.description as string) ?? '',
    body: Array.isArray(data.body) ? (data.body as unknown[]) : [],
    tag: (data.tag as Category) ?? 'Publishing',
    minutes: (data.minutes as number) ?? 5,
    status: data.status === 'published' ? 'published' : 'draft',
    published_at: (data.published_at as string | null) ?? null,
  };

  return (
    <div>
      <Link href="/admin/blog" className="text-xs font-bold text-muted hover:text-ink">
        ← All posts
      </Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Edit post
      </h1>
      <div className="mt-4">
        <BlogEditor initial={initial} />
      </div>
    </div>
  );
}
