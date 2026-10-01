import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Telegram connect — no OAuth. The user pastes a @BotFather token plus the
 * destination chat; connect-telegram validates both against the Bot API
 * (getMe + getChat) and stores the channel through import-channel-token.
 */
export async function POST(req: Request) {
  let body: { bot_token?: unknown; chat_id?: unknown };
  try {
    body = (await req.json()) as { bot_token?: unknown; chat_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const botToken = typeof body.bot_token === 'string' ? body.bot_token.trim() : '';
  const chatId = typeof body.chat_id === 'string' ? body.chat_id.trim() : '';
  if (!botToken) return NextResponse.json({ error: 'Bot token required.' }, { status: 400 });
  if (!chatId) return NextResponse.json({ error: 'Destination chat required.' }, { status: 400 });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

  // functions.invoke attaches the session JWT — exactly how every other
  // connect path reaches the edge functions.
  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('connect-telegram', {
    body: { workspace_id: ctx.workspace.id, bot_token: botToken, chat_id: chatId },
  });
  const payload = (data ?? {}) as { ok?: boolean; error?: string; title?: string };
  if (error || !payload.ok) {
    const context = (error as { context?: unknown } | null)?.context;
    const ctxBody = context instanceof Response ? await context.json().catch(() => null) : null;
    const msg =
      payload.error ??
      (ctxBody as { error?: string } | null)?.error ??
      error?.message ??
      'Could not connect Telegram.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ ok: true, title: payload.title });
}
