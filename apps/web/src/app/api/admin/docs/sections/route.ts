import { dbError, issue, readJson, requireAdmin, revalidateDocs, sectionInput } from '@/lib/docsAdmin';

/** Create a docs section at the end of the sidebar. Admin-only.
 *  POST { slug, title } → 201 { section } */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = sectionInput.safeParse(await readJson(req));
  if (!parsed.success) return issue(parsed.error);

  const { data: last } = await auth.sb
    .from('docs_sections')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position?: number } | null)?.position ?? -1) + 1;

  const { data, error } = await auth.sb
    .from('docs_sections')
    .insert({ ...parsed.data, position })
    .select('id, slug, title, position')
    .single();
  if (error) return dbError(error);
  revalidateDocs();
  return Response.json({ section: data }, { status: 201 });
}
