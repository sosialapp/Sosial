import { z } from 'zod';
import { bad, dbError, issue, readJson, requireAdmin, revalidateDocs, sectionPatch } from '@/lib/docsAdmin';

/** Rename a section. Admin-only. PATCH { slug?, title? } → 200 { section } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return bad('Unknown section.', 404);
  const parsed = sectionPatch.safeParse(await readJson(req));
  if (!parsed.success) return issue(parsed.error);

  const { data, error } = await auth.sb
    .from('docs_sections')
    .update(parsed.data)
    .eq('id', id)
    .select('id, slug, title, position');
  if (error) return dbError(error);
  if (!data?.length) return bad('Unknown section.', 404);
  revalidateDocs();
  return Response.json({ section: data[0] });
}

/** Delete an empty section (409 while it still has pages). Admin-only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return bad('Unknown section.', 404);
  const { data, error } = await auth.sb.from('docs_sections').delete().eq('id', id).select('id');
  if (error) return dbError(error);
  if (!data?.length) return bad('Unknown section.', 404);
  revalidateDocs();
  return Response.json({ ok: true });
}
