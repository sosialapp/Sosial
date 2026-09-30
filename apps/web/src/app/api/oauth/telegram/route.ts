import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Telegram connect — no OAuth. The user pastes a @BotFather token plus the
 * destination chat; the edge function validates both against the Bot API
 * (getMe + getChat) and stores the channel through import-channel-token.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect channels.' },
      { status: 403 },
    );
  }

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

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-telegram`;
  // Service-role key: this call needs the user's JWT downstream, so forward
  // the incoming Authorization header rather than re-authenticating.
  const auth = req.headers.get('authorization') ?? '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: auth,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ workspace_id: ctx.workspace.id, bot_token: botToken, chat_id: chatId }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; title?: string };
    if (!res.ok || !json.ok) {
      return NextResponse.json({ error: json.error ?? 'Could not connect Telegram.' }, { status: res.status || 500 });
    }
    return NextResponse.json({ ok: true, title: json.title });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not connect Telegram.' },
      { status: 500 },
    );
  }
}
