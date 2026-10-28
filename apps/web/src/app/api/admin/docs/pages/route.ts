import { PAGE_COLUMNS } from '@/lib/docs';
import { checkParent, dbError, issue, pageInput, readJson, requireAdmin, revalidateDocs } from '@/lib/docsAdmin';

/**
 * Create a docs page. Admin-only (401 signed out, 403 non-admin).
 *
 * POST { section_id, slug, title, description?, body_md?, published?, icon?, parent_id? }
 *   → 201 { page }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = pageInput.safeParse(await readJson(req));
  if (!parsed.success) return issue(parsed.error);
  const parentErr = await checkParent(auth.sb, {
    pageId: null,
    sectionId: parsed.data.section_id,
    parentId: parsed.data.parent_id,
  });
  if (parentErr) return parentErr;

  // New pages go to the end of their section.
  const { data: last } = await auth.sb
    .from('docs_pages')
    .select('position')
    .eq('section_id', parsed.data.section_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position?: number } | null)?.position ?? -1) + 1;

  const { data, error } = await auth.sb
    .from('docs_pages')
    .insert({ ...parsed.data, position })
    .select(PAGE_COLUMNS)
    .single();
  if (error) return dbError(error);
  revalidateDocs();
  return Response.json({ page: data }, { status: 201 });
}
