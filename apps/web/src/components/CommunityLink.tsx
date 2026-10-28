'use client';

/**
 * Community header pill. Comments and messages no longer raise bell
 * notifications — this is the single place their badge lives. The count
 * comes from community_unseen() and clears when a section is opened
 * (CommunityInbox fires `sosial:community-seen`).
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CommunityLink({ workspaceId }: { workspaceId: string }) {
  const [count, setCount] = useState(0);

  const fetchUnseen = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb.rpc('community_unseen', { p_workspace: workspaceId });
    if (error) return;
    const j = (data ?? {}) as { comments?: number; messages?: number };
    setCount(Number(j.comments ?? 0) + Number(j.messages ?? 0));
  }, [workspaceId]);

  useEffect(() => {
    void fetchUnseen();
    const t = setInterval(() => void fetchUnseen(), 60_000);
    const onChange = () => void fetchUnseen();
    window.addEventListener('focus', onChange);
    window.addEventListener('sosial:community-seen', onChange);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onChange);
      window.removeEventListener('sosial:community-seen', onChange);
    };
  }, [fetchUnseen]);

  const label = count > 0 ? `Community, ${count} new` : 'Community';
  return (
    <Link
      href="/community"
      data-tour="community-badge"
      aria-label={label}
      title="Community - comments and messages"
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-bone"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
        <path
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-extrabold leading-none text-[#0b1220] ring-2 ring-card">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
