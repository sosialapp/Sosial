import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * VK connect passthrough — community access key validated by connect-vk
 * against groups.getById. Same shape as the Ghost route.
 */
export async function POST(req: Request) {
  let body: { community?: unknown; access_token?: unknown };
  try {
    body = (await req.json()) as { community?: unknown; access_token?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const community = typeof body.community === 'string' ? body.community.trim() : '';
  const accessToken = typeof body.access_token === 'string' ? body.access_token.trim() : '';
  if (!community) return NextResponse.json({ error: 'Community required.' }, { status: 400 });
  if (!accessToken) return NextResponse.json({ error: 'Access key required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-vk', {
    body: { workspace_id: ctx.workspace.id, community, access_token: accessToken },
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
    const msg = out.error ?? detail ?? error?.message ?? 'Could not connect VK.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json(out);
}
