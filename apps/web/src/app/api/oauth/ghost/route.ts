import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Ghost connect passthrough — per-site Admin API key validated by
 * connect-ghost against GET /ghost/api/admin/site/. Same shape as the
 * WordPress route.
 */
export async function POST(req: Request) {
  let body: { site_url?: unknown; admin_key?: unknown };
  try {
    body = (await req.json()) as { site_url?: unknown; admin_key?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const siteUrl = typeof body.site_url === 'string' ? body.site_url.trim() : '';
  const adminKey = typeof body.admin_key === 'string' ? body.admin_key.trim() : '';
  if (!siteUrl) return NextResponse.json({ error: 'Site URL required.' }, { status: 400 });
  if (!adminKey) return NextResponse.json({ error: 'Admin API key required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-ghost', {
    body: { workspace_id: ctx.workspace.id, site_url: siteUrl, admin_key: adminKey },
  });
  const out = (data ?? {}) as { ok?: boolean; error?: string; title?: string };
  if (error || !out.ok) {
    let detail: string | null = null;
    const context = (error as { context?: unknown } | null)?.context;
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as { error?: string; message?: string } | null;
      detail = parsed?.error ?? parsed?.message ?? null;
    } else if (context && typeof context === 'object') {
      const parsed = context as { error?: string; message?: string };
      detail = parsed.error ?? parsed.message ?? null;
    }
    const msg = out.error ?? detail ?? error?.message ?? 'Could not connect Ghost.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json(out);
}
