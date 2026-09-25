import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Instant publish: purge the ISR cache for freshly saved blog posts and CMS
 * pages so "Publish" means live now, not live within 5 minutes. Admin-only —
 * the caller's JWT must belong to app_admins.
 *
 * POST { paths: string[] } → 200 { ok: true, revalidated: string[] }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const { data: isAdmin } = await sb.rpc('is_app_admin');
  if (!isAdmin) {
    return Response.json({ error: 'Admins only.' }, { status: 403 });
  }
  let paths: unknown;
  try {
    paths = (await req.json())?.paths;
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (!Array.isArray(paths)) {
    return Response.json({ error: 'paths must be an array.' }, { status: 400 });
  }
  const done: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string' || !p.startsWith('/')) continue;
    try {
      revalidatePath(p);
      done.push(p);
    } catch {
      /* one bad path never blocks the rest */
    }
  }
  return Response.json({ ok: true, revalidated: done });
}
