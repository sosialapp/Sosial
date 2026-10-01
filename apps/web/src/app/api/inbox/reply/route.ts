import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createPost } from '@/lib/posts';
import { replyTargetOptions } from '@/lib/inbox';
import type { ConnectedChannel } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inbox/reply { channel_id, reply_to, text }
 * Sends a threaded reply through the normal queue: a mode:'now' post whose
 * discord target carries { replyTo }. Members follow the same approval
 * rules as the composer (their reply waits for approval like any post).
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body: { channel_id?: unknown; reply_to?: unknown; text?: unknown };
  try {
    body = (await req.json()) as { channel_id?: unknown; reply_to?: unknown; text?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const channelId = typeof body.channel_id === 'string' ? body.channel_id : '';
  const replyTo = typeof body.reply_to === 'string' ? body.reply_to : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!channelId) return NextResponse.json({ error: 'channel_id required.' }, { status: 400 });
  if (!replyTo) return NextResponse.json({ error: 'reply_to required.' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Reply text required.' }, { status: 400 });
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Replies cap at 2000 characters.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: channel } = await admin
    .from('connected_channels')
    .select('id, workspace_id, provider, external_id, display_name, handle, instance_url, status, metadata')
    .eq('id', channelId)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();
  const ch = channel as ConnectedChannel | null;
  if (!ch || ch.provider !== 'discord' || ch.status !== 'connected') {
    return NextResponse.json({ error: 'Channel is not a connected Discord channel.' }, { status: 400 });
  }
  const { data: original } = await admin
    .from('channel_messages')
    .select('id')
    .eq('channel_id', channelId)
    .eq('external_id', replyTo)
    .maybeSingle();
  if (!original) {
    return NextResponse.json({ error: 'Original message not found — it may have been deleted.' }, { status: 400 });
  }

  try {
    const id = await createPost(admin, {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      role: ctx.workspace.role,
      title: text.split('\n')[0].slice(0, 60),
      body: text,
      mode: 'now',
      scheduleIso: null,
      channels: [ch],
      files: [],
      targetOptions: replyTargetOptions('discord', replyTo),
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not send the reply.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
