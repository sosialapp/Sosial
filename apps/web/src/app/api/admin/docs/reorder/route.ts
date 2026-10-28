import { dbError, issue, readJson, requireAdmin, revalidateDocs, reorderInput } from '@/lib/docsAdmin';

/**
 * Set sidebar order. Admin-only.
 *
 * POST { kind: 'pages' | 'sections', ids: uuid[] } → 200 { ok: true }
 * Each id gets its index as `position`; for pages, send one section's ids.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = reorderInput.safeParse(await readJson(req));
  if (!parsed.success) return issue(parsed.error);
  const table = parsed.data.kind === 'pages' ? 'docs_pages' : 'docs_sections';

  const results = await Promise.all(
    parsed.data.ids.map((id, position) => auth.sb.from(table).update({ position }).eq('id', id)),
  );
  const failed = results.find((r) => r.error)?.error;
  if (failed) return dbError(failed);
  revalidateDocs();
  return Response.json({ ok: true });
}
