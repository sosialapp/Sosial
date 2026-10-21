/**
 * Client for the stateless DM inbox (Messages tab). All reads/writes go
 * through the inbox-fetch / inbox-send edge functions — nothing is stored
 * in the database, secrets stay in Vault, and the plan gate is enforced
 * server-side (free plans get { ok:false, upgrade:true }).
 */
import { createClient } from '@/lib/supabase/client';
import { edgeErrorMessage } from '@/lib/functions';

export interface InboxConversation {
  provider: string;
  channel_id: string;
  id: string;
  title: string;
  unread: number | null;
  previewText: string;
  updated_at: string | null;
  other_id: string | null;
  other_acct: string | null;
  last_status_id: string | null;
}

export interface InboxMessage {
  provider: string;
  channel_id: string;
  conversation_id: string;
  id: string;
  text: string;
  from_me: boolean;
  from_name: string | null;
  ts: string | null;
}

export class InboxError extends Error {
  upgrade: boolean;
  constructor(message: string, upgrade = false) {
    super(message);
    this.upgrade = upgrade;
  }
}

async function call<T>(fn: 'inbox-fetch' | 'inbox-send', body: Record<string, unknown>): Promise<T> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) {
    const detail = await edgeErrorMessage(error);
    throw new InboxError(detail ?? error.message);
  }
  const j = (data ?? {}) as Record<string, unknown>;
  if (j.ok === false) throw new InboxError(String(j.error ?? 'Request failed.'), j.upgrade === true);
  return j as T;
}

export async function fetchConversations(workspaceId: string, limit = 15): Promise<InboxConversation[]> {
  const j = await call<{ conversations?: InboxConversation[] }>('inbox-fetch', {
    workspace_id: workspaceId,
    limit,
  });
  return j.conversations ?? [];
}

export async function fetchThread(
  workspaceId: string,
  conversation: InboxConversation,
  limit = 30,
): Promise<InboxMessage[]> {
  const j = await call<{ messages?: InboxMessage[] }>('inbox-fetch', {
    workspace_id: workspaceId,
    channel_id: conversation.channel_id,
    conversation_id: conversation.id,
    other_acct: conversation.other_acct ?? undefined,
    limit,
  });
  return j.messages ?? [];
}

export async function sendDirectMessage(
  workspaceId: string,
  conversation: InboxConversation,
  text: string,
): Promise<InboxMessage> {
  const j = await call<{ message: InboxMessage }>('inbox-send', {
    workspace_id: workspaceId,
    channel_id: conversation.channel_id,
    conversation_id: conversation.id,
    recipient_id: conversation.other_id ?? undefined,
    recipient_acct: conversation.other_acct ?? undefined,
    reply_to_id: conversation.last_status_id ?? undefined,
    text,
  });
  return j.message;
}
