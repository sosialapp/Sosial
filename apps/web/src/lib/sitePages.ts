import { createClient as createAnonClient } from '@supabase/supabase-js';

/**
 * Public read of CMS page bodies. Cookie-free anon client like lib/blog —
 * site_pages rows are public (RLS `site_pages_public_read`) and these run in
 * server components outside request scope.
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
