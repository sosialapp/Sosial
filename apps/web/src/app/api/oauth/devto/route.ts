import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Dev.to connect passthrough — API key validated by connect-devto against
 * GET /api/users/me. Same shape as the other manual-provider routes.
 */
export async function POST(req: Request) {
  let body: { api_key?: unknown };
  try {
    body = (await req.json()) as { api_key?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  if (!apiKey) return NextResponse.json({ error: 'API key required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-devto', {
    body: { workspace_id: ctx.workspace.id, api_key: apiKey },
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
    const msg = out.error ?? detail ?? error?.message ?? 'Could not connect Dev.to.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json(out);
}
