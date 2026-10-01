import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Hashnode connect passthrough — staged PAT flow (token → publications →
 * save), same shape as the Discord route.
 */
export async function POST(req: Request) {
  let body: { pat?: unknown; publication_id?: unknown };
  try {
    body = (await req.json()) as { pat?: unknown; publication_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const pat = typeof body.pat === 'string' ? body.pat.trim() : '';
  if (!pat) return NextResponse.json({ error: 'Personal access token required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  const payload: Record<string, string> = { workspace_id: ctx.workspace.id, pat };
  if (typeof body.publication_id === 'string' && body.publication_id) {
    payload.publication_id = body.publication_id;
  }

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-hashnode', { body: payload });
  const out = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    title?: string;
    publications?: { id: string; title: string; url: string }[];
  };
  if (error || (!out.ok && !out.publications)) {
    let detail: string | null = null;
    const context = (error as { context?: unknown } | null)?.context;
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as { error?: string; message?: string } | null;
      detail = parsed?.error ?? parsed?.message ?? null;
    } else if (context && typeof context === 'object') {
      const parsed = context as { error?: string; message?: string };
      detail = parsed.error ?? parsed.message ?? null;
    }
    const msg = out.error ?? detail ?? error?.message ?? 'Could not connect Hashnode.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json(out);
}
