'use client';

import { useState } from 'react';
import RecentActivityCarousel, {
  type RecentActivityItem,
} from '@/components/RecentActivityCarousel';
import PostPreviewDialog, { type PreviewPostData } from '@/components/PostPreviewDialog';

/** Dashboard recent-activity card: carousel + single-click preview popup. */
export default function DashboardRecentActivity({ items }: { items: RecentActivityItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((it) => it.id === openId) ?? null;
  const preview: PreviewPostData | null = open
    ? {
        id: open.id,
        text: open.text,
        status: open.status,
        timeLabel: open.timeLabel,
        timeTitle: open.timeTitle,
        provider: open.provider,
        authorName: open.authorName,
        authorHandle: open.authorHandle,
        avatar: open.avatar,
        media: open.media,
      }
    : null;
  return (
    <>
      <RecentActivityCarousel items={items} onOpen={(it) => setOpenId(it.id)} />
      <PostPreviewDialog post={preview} onClose={() => setOpenId(null)} />
    </>
  );
}
