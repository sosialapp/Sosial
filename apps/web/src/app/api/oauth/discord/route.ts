import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Discord connect passthrough — staged bot-token flow (token → servers →
 * channels → save), same shape as the Telegram route. The edge function
 * validates each stage against Discord before storing anything.
 */
export async function POST(req: Request) {
  let body: { bot_token?: unknown; guild_id?: unknown; channel_id?: unknown };
  try {
    body = (await req.json()) as { bot_token?: unknown; guild_id?: unknown; channel_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const botToken = typeof body.bot_token === 'string' ? body.bot_token.trim() : '';
  if (!botToken) return NextResponse.json({ error: 'Bot token required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  const payload: Record<string, string> = { workspace_id: ctx.workspace.id, bot_token: botToken };
  if (typeof body.guild_id === 'string' && body.guild_id) payload.guild_id = body.guild_id;
  if (typeof body.channel_id === 'string' && body.channel_id) payload.channel_id = body.channel_id;

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-discord', { body: payload });
  const out = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    title?: string;
    guilds?: { id: string; name: string }[];
    channels?: { id: string; name: string }[];
  };
  if (error || (!out.ok && !out.guilds && !out.channels)) {
    let detail: string | null = null;
    const context = (error as { context?: unknown } | null)?.context;
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as { error?: string; message?: string } | null;
      detail = parsed?.error ?? parsed?.message ?? null;
    } else if (context && typeof context === 'object') {
      const parsed = context as { error?: string; message?: string };
      detail = parsed.error ?? parsed.message ?? null;
    }
    const msg = out.error ?? detail ?? error?.message ?? 'Could not connect Discord.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json(out);
}
