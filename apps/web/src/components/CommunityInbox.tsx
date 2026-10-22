'use client';

/**
 * Community inbox — tab host for the unified Comments feed and the
 * unified Messages inbox (both p92). Data comes from the workspace
 * tables; actions queue through the scan-now / reply-comment / inbox-send
 * edge functions.
 */

import { useState } from 'react';
import CommentsFeed from '@/components/CommentsFeed';
import MessagesInbox from '@/components/MessagesInbox';
import type { ConnectedChannel } from '@/lib/types';

type InboxTab = 'comments' | 'messages';

export default function CommunityInbox({
  channels,
  workspaceId,
  plan,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  plan: string;
}) {
  const [tab, setTab] = useState<InboxTab>('comments');

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Inbox sections" className="flex w-fit gap-1 rounded-full border border-line bg-card p-1">
        {(
          [
            ['comments', 'Comments'],
            ['messages', 'Messages'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === key ? 'bg-accent text-[#0b1220]' : 'text-soft hover:bg-paper-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'comments' ? (
        <CommentsFeed channels={channels} workspaceId={workspaceId} />
      ) : (
        <MessagesInbox workspaceId={workspaceId} channels={channels} paid={plan !== 'free'} />
      )}
    </div>
  );
}
