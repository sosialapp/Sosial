'use client';

/**
 * The real app screens behind AppPreview, split out so the calendar, composer,
 * AI writer and team code (several hundred kB) only downloads once a preview
 * scrolls near the viewport, never as part of the marketing page itself.
 */

import { useMemo } from 'react';
import AiCard from '@/components/AiCard';
import CreatePost from '@/components/CreatePost';
import Dock from '@/components/Dock';
import QuickPost from '@/components/QuickPost';
import ScheduleXBoard from '@/components/ScheduleXBoard';
import TeamManager from '@/components/TeamManager';
import { MessagesProvider, useLocale } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { messagesFor } from '@/lib/i18n/locales';
import type { PreviewScreen } from './AppPreview';
import { SAMPLE_CHANNELS, SAMPLE_TEAM, samplePosts } from './sample';

export default function AppPreviewScreen({ screen, shell }: { screen: PreviewScreen; shell?: boolean }) {
  // The real app components read their strings from the app provider. Previews
  // run on marketing pages, outside the app layout, so resolve the visitor's
  // locale here; the dictionary stays inside this lazy chunk.
  const locale = useLocale();
  const messages = useMemo(() => messagesFor(appMessages, locale), [locale]);
  return (
    <MessagesProvider messages={messages}>
      {shell ? (
        // The real Dock is position:fixed; the scaled wrapper's
        // transform makes it the containing block, so it pins here.
        <div className="relative min-h-[720px] pt-3 pr-6 pb-6 pl-[84px]">
          <Dock />
          <Screen screen={screen} />
        </div>
      ) : (
        <Screen screen={screen} />
      )}
    </MessagesProvider>
  );
}

function Screen({ screen }: { screen: PreviewScreen }) {
  const posts = useMemo(() => samplePosts(), []);
  switch (screen) {
    case 'calendar-month':
      return <ScheduleXBoard posts={posts} channels={SAMPLE_CHANNELS} initialView="month" />;
    case 'calendar-list':
      return <ScheduleXBoard posts={posts} channels={SAMPLE_CHANNELS} initialView="list" />;
    case 'week':
      return (
        <div className="p-5">
          <ScheduleXBoard variant="mini" posts={posts} channels={SAMPLE_CHANNELS} />
        </div>
      );
    case 'composer':
      return <CreatePost channels={SAMPLE_CHANNELS} workspaceId="sample" userId="sample" role="owner" />;
    case 'quick-post':
      return <QuickPost channels={SAMPLE_CHANNELS} workspaceId="sample" userId="sample" role="owner" />;
    case 'ai-writer':
      return (
        <div className="card p-5">
          <AiCard
            providers={['instagram', 'x', 'linkedin']}
            thread={false}
            onThreadChange={() => {}}
            parts={3}
            onPartsChange={() => {}}
            onResult={() => {}}
          />
        </div>
      );
    case 'team':
      return (
        <div className="pt-4">
          <TeamManager
            workspaceId="sample"
            workspaceName="Northwind Coffee"
            workspaceAvatar={null}
            memberAvatars={{}}
            myUserId="su1"
            myRole="owner"
            {...SAMPLE_TEAM}
          />
        </div>
      );
  }
}
