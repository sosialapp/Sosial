import { redirect } from 'next/navigation';
import InboxView from '@/components/InboxView';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Inbox: inbound channel messages (Discord first) with threaded replies. */
export default async function InboxPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [{ data: channels }, { data: messages }] = await Promise.all([
    sb
      .from('connected_channels')
      .select('id, display_name, handle')
      .eq('workspace_id', ctx.workspace.id)
      .eq('provider', 'discord')
      .eq('status', 'connected')
      .order('created_at', { ascending: true }),
    sb
      .from('channel_messages')
      .select(
        'id, channel_id, external_id, author_name, author_handle, body, has_media, external_created_at, reply_to_external_id',
      )
      .eq('workspace_id', ctx.workspace.id)
      .order('external_created_at', { ascending: false })
      .limit(100),
  ]);
  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Inbox</h1>
      <p className="mt-1 text-sm text-muted">
        {ctx.workspace.name} · messages from your channels, reply without leaving Sosial
      </p>
      <InboxView
        channels={(channels ?? []) as { id: string; display_name: string | null; handle: string | null }[]}
        messages={
          (messages ?? []) as {
            id: string;
            channel_id: string;
            external_id: string;
            author_name: string | null;
            author_handle: string | null;
            body: string;
            has_media: boolean;
            external_created_at: string | null;
            reply_to_external_id: string | null;
          }[]
        }
      />
    </div>
  );
}
