import { createClient as createAnonClient } from '@supabase/supabase-js';

/**
 * Public read of CMS pages. Cookie-free anon client like lib/blog — live
 * rows are public (RLS `site_pages_public_read` only admits published rows
 * whose date is due, so drafts and scheduled-future pages are invisible
 * here) and these run in server components outside request scope.
 */
function publicClient() {
  return createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** Serialized HTML for a page slug, or null when never customized. */
export async function sitePageHtml(slug: string): Promise<string | null> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_pages')
      .select('body_html')
      .eq('slug', slug)
      .maybeSingle();
    const html = (data as { body_html?: unknown } | null)?.body_html;
    return typeof html === 'string' && html.trim() ? html : null;
  } catch {
    return null;
  }
}

/** Raw document JSON + its save stamp for the admin editor (null = never customized). */
export async function sitePageDoc(slug: string): Promise<{ body: unknown; updatedAt: string | null } | null> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_pages')
      .select('body, updated_at')
      .eq('slug', slug)
      .maybeSingle();
    const row = data as { body?: unknown; updated_at?: unknown } | null;
    if (!row) return null;
    return { body: row.body ?? null, updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null };
  } catch {
    return null;
  }
}

export interface SiteCustomPage {
  slug: string;
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyHtml: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface SitePageMeta {
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
}

/**
 * Editable metadata for any live row (registry or custom) — what Page
 * settings writes. Null when never customized; drafts and scheduled-future
 * rows are already filtered by RLS, so this is always safe to render.
 */
export async function sitePageMeta(slug: string): Promise<SitePageMeta | null> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_pages')
      .select('title, meta_title, meta_description, published_at')
      .eq('slug', slug)
      .maybeSingle();
    const row = data as {
      title?: unknown; meta_title?: unknown; meta_description?: unknown; published_at?: unknown;
    } | null;
    if (!row) return null;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    return {
      title: str(row.title),
      metaTitle: str(row.meta_title),
      metaDescription: str(row.meta_description),
      publishedAt: str(row.published_at),
    };
  } catch {
    return null;
  }
}

/** Long-form date for a full ISO timestamp: "26 September 2026", or null. */
export function formatPageDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** A live custom page by slug, or null (missing, draft or scheduled-future). */
export async function siteCustomPage(slug: string): Promise<SiteCustomPage | null> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_pages')
      .select('slug, title, meta_title, meta_description, body_html, published_at, updated_at')
      .eq('slug', slug)
      .eq('is_custom', true)
      .maybeSingle();
    const row = data as {
      slug?: unknown; title?: unknown; meta_title?: unknown; meta_description?: unknown;
      body_html?: unknown; published_at?: unknown; updated_at?: unknown;
    } | null;
    if (!row || typeof row.slug !== 'string') return null;
    const html = typeof row.body_html === 'string' ? row.body_html.trim() : '';
    if (!html) return null;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    return {
      slug: row.slug,
      title: str(row.title),
      metaTitle: str(row.meta_title),
      metaDescription: str(row.meta_description),
      bodyHtml: html,
      publishedAt: str(row.published_at),
      updatedAt: str(row.updated_at),
    };
  } catch {
    return null;
  }
}

/** Rename target for a slug, or null when no redirect exists. */
export async function siteRedirectFor(slug: string): Promise<string | null> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_redirects')
      .select('to_slug')
      .eq('from_slug', slug)
      .maybeSingle();
    const to = (data as { to_slug?: unknown } | null)?.to_slug;
    return typeof to === 'string' && to ? to : null;
  } catch {
    return null;
  }
}

/** Live custom pages flagged for the footer, alphabetical by title. */
export async function siteFooterPages(): Promise<{ slug: string; title: string }[]> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_pages')
      .select('slug, title')
      .eq('is_custom', true)
      .eq('show_in_footer', true)
      .order('title', { ascending: true });
    return ((data ?? []) as { slug?: unknown; title?: unknown }[])
      .filter((r) => typeof r.slug === 'string')
      .map((r) => ({
        slug: r.slug as string,
        title: typeof r.title === 'string' && r.title.trim() ? r.title : (r.slug as string),
      }));
  } catch {
    return [];
  }
}

/** Every live custom page (sitemap + admin cross-checks). */
export async function allCustomPages(): Promise<{ slug: string; updatedAt: string | null }[]> {
  try {
    const sb = publicClient();
    const { data } = await sb
      .from('site_pages')
      .select('slug, updated_at')
      .eq('is_custom', true);
    return ((data ?? []) as { slug?: unknown; updated_at?: unknown }[])
      .filter((r) => typeof r.slug === 'string')
      .map((r) => ({
        slug: r.slug as string,
        updatedAt: typeof r.updated_at === 'string' ? r.updated_at : null,
      }));
  } catch {
    return [];
  }
}
