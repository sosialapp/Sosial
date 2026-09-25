import { createClient as createAnonClient } from '@supabase/supabase-js';
import type { Article, Block, Category } from '@/content/types';

export { BLOG_TAGS } from '@/content/types';

/** Cookie-free anon client: blog rows are public (RLS `blog_public_read`),
 *  and generateStaticParams/sitemap run outside a request scope where
 *  next/headers cookies() throws. No session is ever needed here. */
function publicClient() {
  return createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface BlogRow {
  slug: string;
  title: string;
  description: string | null;
  body: unknown;
  body_html: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  show_cover_home: boolean | null;
  tag: string | null;
  minutes: number | null;
  published_at: string | null;
}

const COLS = 'slug, title, description, body, body_html, cover_url, cover_alt, show_cover_home, tag, minutes, published_at';

function isBlock(b: unknown): b is Block {
  if (typeof b !== 'object' || b === null) return false;
  const t = (b as { t?: unknown }).t;
  if (t === 'p' || t === 'h' || t === 'quote' || t === 'img' || t === 'video') {
    return typeof (b as { c?: unknown }).c === 'string';
  }
  if (t === 'ul') {
    const c = (b as { c?: unknown }).c;
    return Array.isArray(c) && c.every((x) => typeof x === 'string');
  }
  if (t === 'table') {
    const c = (b as { c?: unknown }).c;
    return (
      Array.isArray(c) &&
      c.every((r) => Array.isArray(r) && r.every((x) => typeof x === 'string'))
    );
  }
  return false;
}

function toArticle(r: BlogRow): Article {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description ?? '',
    date: (r.published_at ?? '').slice(0, 10),
    tag: (r.tag as Category) ?? 'Strategy',
    minutes: typeof r.minutes === 'number' && r.minutes > 0 ? r.minutes : 5,
    body: Array.isArray(r.body) ? (r.body as unknown[]).filter(isBlock) : [],
    bodyHtml: typeof r.body_html === 'string' && r.body_html.trim() ? r.body_html : null,
    coverUrl: typeof r.cover_url === 'string' && r.cover_url.trim() ? r.cover_url : null,
    coverAlt: typeof r.cover_alt === 'string' && r.cover_alt.trim() ? r.cover_alt : null,
    showCoverHome: r.show_cover_home !== false,
  };
}

/** Published articles, newest first (public RLS: anyone). */
export async function allArticles(): Promise<Article[]> {
  const sb = publicClient();
  const { data } = await sb
    .from('blog_posts')
    .select(COLS)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  return ((data ?? []) as BlogRow[]).map(toArticle);
}

export async function article(slug: string): Promise<Article | undefined> {
  const sb = publicClient();
  const { data } = await sb
    .from('blog_posts')
    .select(COLS)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();
  return data ? toArticle(data as BlogRow) : undefined;
}

export async function articlesByTag(tag: string): Promise<Article[]> {
  return (await allArticles()).filter((a) => a.tag === tag);
}

export async function relatedArticles(slug: string, count = 3): Promise<Article[]> {
  const all = await allArticles();
  const current = all.find((a) => a.slug === slug);
  if (!current) return all.slice(0, count);
  const sameTag = all.filter((a) => a.slug !== slug && a.tag === current.tag);
  const rest = all.filter((a) => a.slug !== slug && a.tag !== current.tag);
  return [...sameTag, ...rest].slice(0, count);
}
