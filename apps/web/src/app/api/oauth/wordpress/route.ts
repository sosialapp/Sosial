import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * WordPress connect passthrough — per-site Application Passwords, validated
 * by connect-wordpress against the site's own REST API. Same shape as the
 * Telegram/Discord routes.
 */
export async function POST(req: Request) {
  let body: { site_url?: unknown; username?: unknown; app_password?: unknown };
  try {
    body = (await req.json()) as { site_url?: unknown; username?: unknown; app_password?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const siteUrl = typeof body.site_url === 'string' ? body.site_url.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const appPassword = typeof body.app_password === 'string' ? body.app_password.trim() : '';
  if (!siteUrl) return NextResponse.json({ error: 'Site URL required.' }, { status: 400 });
  if (!username) return NextResponse.json({ error: 'Username required.' }, { status: 400 });
  if (!appPassword) return NextResponse.json({ error: 'Application password required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-wordpress', {
    body: { workspace_id: ctx.workspace.id, site_url: siteUrl, username, app_password: appPassword },
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
    const msg = out.error ?? detail ?? error?.message ?? 'Could not connect WordPress.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json(out);
}
