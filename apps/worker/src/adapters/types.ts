/**
 * Adapter interface for the Unified Inbox (DMs) and Unified Comments.
 * One file per platform implementing exactly this surface; everything is
 * normalized here, raw platform payloads never leave the adapter.
 *
 * Rules from the spec:
 *  - only official endpoints (see repo README for the link table)
 *  - never touch tokens: `account.token` is already Vault-resolved by the
 *    caller; adapters treat it as an opaque credential
 *  - normalize timestamps to ISO-8601 UTC strings
 *  - pagination via opaque cursor strings; null = first page/end
 *  - throw plain-language errors; the sync engine surfaces them
 */

export interface Account {
  /** connected_channels.id */
  id: string;
  workspaceId: string;
  provider: string;
  /** platform-scoped account id (threads user id, page id, DID, …) */
  externalId: string;
  instanceUrl: string | null;
  displayId?: string | null;
  /** connected_channels.metadata (non-secret extras) */
  metadata?: Record<string, unknown>;
  token: string;
}

export interface Page<T> {
  items: T[];
  cursor: string | null;
}

export interface NormalizedConversation {
  externalId: string;
  /** Platform id of the other person (PSID/IGSID), when sending needs it. */
  participantExternalId?: string | null;
  participantName: string;
  participantAvatar: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

export interface NormalizedMessage {
  externalId: string;
  direction: 'in' | 'out';
  body: string;
  attachments: { url: string }[];
  sentAt: string;
}

export interface NormalizedComment {
  externalId: string;
  parentExternalId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  /** true when the connected account wrote it (our own reply in the thread) */
  isOwn?: boolean;
}

export interface SendResult {
  externalId: string;
  sentAt: string;
}

export interface Capabilities {
  inbox: boolean;
  comments: boolean;
  hideComment: boolean;
  deleteComment: boolean;
}

export interface InboxAdapter {
  capabilities(): Capabilities;
  listConversations(account: Account, cursor: string | null): Promise<Page<NormalizedConversation>>;
  listMessages(account: Account, conversationId: string, cursor: string | null): Promise<Page<NormalizedMessage>>;
  sendMessage(
    account: Account,
    conversationId: string,
    content: { text: string; attachmentUrls?: string[] },
    /** The other party's platform id (Messenger PSID / Instagram IGSID). */
    recipientId?: string | null,
  ): Promise<SendResult>;
  listComments(account: Account, postId: string, cursor: string | null): Promise<Page<NormalizedComment>>;
  /** Own posts that can carry comments, for platforms where Sosial can
   *  enumerate the account timeline. Optional: providers without a cheap
   *  "my posts" read keep the Sosial-published list only. */
  listOwnPosts?(account: Account, limit: number): Promise<{ externalId: string; commentCount: number }[]>;
  replyToComment(account: Account, commentId: string, content: { text: string }): Promise<SendResult>;
}
