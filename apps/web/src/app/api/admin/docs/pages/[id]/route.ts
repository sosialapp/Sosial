import { z } from 'zod';
import { PAGE_COLUMNS } from '@/lib/docs';
import { bad, checkParent, dbError, issue, pagePatch, readJson, requireAdmin, revalidateDocs } from '@/lib/docsAdmin';

const patchBody = pagePatch.extend({
  /** updated_at the editor opened with; the save is refused if the row moved on. */
  expected_updated_at: z.string().optional(),
});

/**
 * Update a docs page. Admin-only.
 *
 * PATCH { ...fields, expected_updated_at? } → 200 { page } | 409 when stale
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return bad('Unknown page.', 404);
  const parsed = patchBody.safeParse(await readJson(req));
  if (!parsed.success) return issue(parsed.error);
  const { expected_updated_at, ...fields } = parsed.data;

  const { data: current } = await auth.sb
    .from('docs_pages')
    .select('section_id, parent_id, updated_at')
    .eq('id', id)
    .maybeSingle();
  const row = current as { section_id: string; parent_id: string | null; updated_at: string } | null;
  if (!row) return bad('Unknown page.', 404);
  if (expected_updated_at && new Date(expected_updated_at).getTime() !== new Date(row.updated_at).getTime()) {
    return bad('Someone else saved this page since you opened it. Reload to see their changes.', 409);
  }

  const sectionId = fields.section_id ?? row.section_id;
  const moving = sectionId !== row.section_id;
  // A move to another section drops the old parent unless a new one is given.
  const parentId = fields.parent_id !== undefined ? fields.parent_id : moving ? null : row.parent_id;
  const parentErr = await checkParent(auth.sb, { pageId: id, sectionId, parentId });
  if (parentErr) return parentErr;

  const update: Record<string, unknown> = { ...fields, parent_id: parentId };
  if (moving) {
    // Its sub-pages stay behind as top-level pages of the old section.
    await auth.sb.from('docs_pages').update({ parent_id: null }).eq('parent_id', id);
    // Moving sections: land at the end of the new one.
    const { data: last } = await auth.sb
      .from('docs_pages')
      .select('position')
      .eq('section_id', fields.section_id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    update.position = ((last as { position?: number } | null)?.position ?? -1) + 1;
  }

  const { data, error } = await auth.sb.from('docs_pages').update(update).eq('id', id).select(PAGE_COLUMNS).single();
  if (error) return dbError(error);
  revalidateDocs();
  return Response.json({ page: data });
}

/** DELETE → 200 { ok: true }. Admin-only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return bad('Unknown page.', 404);
  const { data, error } = await auth.sb.from('docs_pages').delete().eq('id', id).select('id');
  if (error) return dbError(error);
  if (!data?.length) return bad('Unknown page.', 404);
  revalidateDocs();
  return Response.json({ ok: true });
}
