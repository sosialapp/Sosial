import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SLUG_RE } from './docs';

/**
 * Server side of the /admin/docs editor. Every write goes through
 * /api/admin/docs/*, which calls requireAdmin() first; the docs_* RLS
 * policies (is_app_admin) then re-check the same JWT on the database.
 */

type Sb = Awaited<ReturnType<typeof createClient>>;

export async function requireAdmin(): Promise<{ sb: Sb } | { error: Response }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: Response.json({ error: 'Sign in first.' }, { status: 401 }) };
  const { data: isAdmin } = await sb.rpc('is_app_admin');
  if (isAdmin !== true) return { error: Response.json({ error: 'Admins only.' }, { status: 403 }) };
  return { sb };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/** Postgres error → a message the editor can show. */
export function dbError(error: { code?: string; message: string }): Response {
  if (error.code === '23505') return bad('That slug is already taken.', 409);
  if (error.code === '23503') return bad('Move or delete the pages in this section first.', 409);
  if (error.code === '23514') return bad('Slugs use lowercase letters, numbers and dashes.', 400);
  return bad(error.message || 'Database error.', 500);
}

/** Public docs read on every request today, purge anyway so ISR stays honest if that changes. */
export function revalidateDocs() {
  try {
    revalidatePath('/docs', 'layout');
  } catch {
    /* never block a save on the cache */
  }
}

const slug = z.string().trim().min(1).max(80).regex(SLUG_RE, 'Slugs use lowercase letters, numbers and dashes.');
const title = z.string().trim().min(1, 'Title is required.').max(160);

/** '' (none), a docs icon name, or 'brand:<provider>'. See DocsIcon. */
const icon = z.string().trim().max(40).regex(/^(brand:[a-z]+|[a-z-]*)$/, 'Unknown icon.');

const pageFields = {
  section_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  slug,
  title,
  description: z.string().trim().max(300),
  body_md: z.string().max(200_000),
  published: z.boolean(),
  icon,
};
// No defaults on the patch schema: an omitted field must stay untouched,
// never reset to ''.
export const pagePatch = z.object(pageFields).partial();
export const pageInput = z.object({
  ...pageFields,
  description: pageFields.description.default(''),
  body_md: pageFields.body_md.default(''),
  published: pageFields.published.default(false),
  parent_id: pageFields.parent_id.default(null),
  icon: icon.default(''),
});

export const sectionInput = z.object({ slug, title });
export const sectionPatch = sectionInput.partial();

export const reorderInput = z.object({
  kind: z.enum(['pages', 'sections']),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * Nesting is one level deep and stays inside a section: the parent must be a
 * top-level page of `sectionId`, not the page itself, and a page that already
 * has children can't become a child. Returns an error response, or null.
 */
export async function checkParent(
  sb: Sb,
  { pageId, sectionId, parentId }: { pageId: string | null; sectionId: string; parentId: string | null },
): Promise<Response | null> {
  if (!parentId) return null;
  if (parentId === pageId) return bad("A page can't be its own parent.");
  const { data } = await sb.from('docs_pages').select('section_id, parent_id').eq('id', parentId).maybeSingle();
  const parent = data as { section_id: string; parent_id: string | null } | null;
  if (!parent) return bad('Unknown parent page.');
  if (parent.section_id !== sectionId) return bad('The parent page must be in the same section.');
  if (parent.parent_id) return bad('Pick a top-level page as the parent; pages nest one level deep.');
  if (pageId) {
    const { count } = await sb.from('docs_pages').select('id', { count: 'exact', head: true }).eq('parent_id', pageId);
    if (count) return bad("This page has its own sub-pages, so it can't go under another page.");
  }
  return null;
}

export function issue(err: z.ZodError): Response {
  return bad(err.issues[0]?.message ?? 'Invalid input.');
}
