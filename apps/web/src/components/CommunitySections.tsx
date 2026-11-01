'use client';

import { useRouter } from 'next/navigation';
import { Bot, Mail, MessageCircle } from 'lucide-react';
import SegmentedPills from '@/components/ui/segmented-pills';

export type CommunitySection = 'comments' | 'messages' | 'auto';

const ROUTE: Record<CommunitySection, string> = {
  comments: '/community',
  messages: '/community?tab=messages',
  auto: '/community/automations',
};

/**
 * Comments / Messages / Auto-replies, one pill row shared by the inbox and the
 * auto-reply editor. Auto-replies is its own section of Community rather than
 * a link tucked into the inbox header, and the inbox keeps its tab in state so
 * the first two switch instantly instead of round-tripping to the server.
 */
export default function CommunitySections({
  value,
  unseen,
  onPick,
}: {
  value: CommunitySection;
  unseen?: { comments: number; messages: number };
  /** Same-page switch; anything not handled here navigates. */
  onPick?: (section: 'comments' | 'messages') => void;
}) {
  const router = useRouter();
  const tabs: { key: CommunitySection; label: string; Icon: typeof MessageCircle }[] = [
    { key: 'comments', label: 'Comments', Icon: MessageCircle },
    { key: 'messages', label: 'Messages', Icon: Mail },
    { key: 'auto', label: 'Auto-replies', Icon: Bot },
  ];

  return (
    <SegmentedPills
      ariaLabel="Community sections"
      role="tablist"
      size="lg"
      value={value}
      onChange={(v) => {
        if (v === value) return;
        if (v === 'auto') {
          router.push(ROUTE.auto);
          return;
        }
        if (onPick) {
          onPick(v);
          return;
        }
        router.push(ROUTE[v]);
      }}
      className="min-w-0 flex-1 sm:flex-none"
      buttonClassName="flex-1 sm:flex-none !px-4"
      options={tabs.map(({ key, label, Icon }) => {
        const count = key === 'auto' ? 0 : (unseen?.[key] ?? 0);
        return {
          value: key,
          title: count > 0 ? `${label}, ${count} new` : label,
          label: (
            <>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
              {count > 0 ? (
                <span className="min-w-[18px] shrink-0 rounded-full bg-accent px-1 text-center text-[10px] font-extrabold leading-[18px] text-on-accent">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </>
          ),
        };
      })}
    />
  );
}
