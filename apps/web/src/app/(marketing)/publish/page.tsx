import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { Activity, CalendarDays, ListChecks, PauseCircle, PencilLine, Ruler, Send, ShieldCheck } from 'lucide-react';
import { FaqList } from '@/components/site/PageBlocks';
import { CtaCard, Hero, IconGrid, Section, SectionHead, Split, Stats } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('publish');
  return seo({
    path: '/publish',
    title: meta?.metaTitle ?? 'Social media scheduling and auto-publishing',
    description: meta?.metaDescription ?? 'Schedule posts to every network from one calendar and queue. Sosial publishes each channel on time, with live character limits and per-channel results.',
    kicker: 'Publish',
    cardTitle: meta?.title ?? 'Every post, on time, everywhere.',
  });
}

export default async function PublishPage() {
  const meta = await sitePageMeta('publish');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }, { name: 'Publish', path: '/publish' }]} />
      <Hero
        icon={Send}
        kicker="Publish"
        title={meta?.title ?? 'Every post, on time, everywhere.'}
        lede="Write once, drop it on the calendar, and let the queue ship every channel. No retyping per network, no 11pm manual posting."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/integrations', label: 'See every channel' }}
        visual={<AppPreview screen="calendar-month" caption="The Sosial calendar, month view. Drag a post to another day to move it." />}
      />

      <PageCms slug="publish" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <Stats
          items={[
            { value: '~1 min', label: 'From the scheduled slot to published, on every channel.' },
            { value: '0', label: 'Devices that need to stay on. The queue runs in the cloud.' },
            { value: '1', label: 'Calendar for every network you post to.' },
            { value: '280', label: 'Characters on X, 63,206 on Facebook. Each real limit, checked.' },
          ]}
        />
      </Section>

      <Section>
        <Split
          icon={CalendarDays}
          kicker="Calendar"
          title="One calendar for every channel."
          body="Drafts, the queue and approvals live on the same grid. Drag a post between days and every channel target moves with it. Nothing to re-enter, nothing to forget."
          points={[
            'See the whole week across every network at a glance',
            'Drafts sit beside scheduled posts until you commit them',
            'Approvals show exactly where they are in the flow',
          ]}
          visual={<AppPreview screen="calendar-list" caption="List view: the next two weeks, day by day." />}
        />
      </Section>

      <Section tone="surface">
        <Split
          flip
          icon={ListChecks}
          kicker="Queue"
          title="A queue that runs itself."
          body="Schedule a post and the cloud worker publishes each channel within about a minute of its slot, even with the app closed and the laptop shut. Per-channel results land back in the queue, so you always know what went out."
          points={[
            'Post now or schedule for later in the same composer',
            'Pause, edit or pull anything before its slot',
            'Every channel reports back: sent, publishing or failed',
          ]}
          visual={<AppPreview screen="week" caption="The dashboard week: every queued post, by day." />}
        />
      </Section>

      <Section>
        <SectionHead
          icon={ShieldCheck}
          kicker="Control"
          title="Mistakes caught before they ship."
          lede="Limits, edits and outages are handled in the composer and the queue, not discovered on the network afterwards."
        />
        <IconGrid
          items={[
            {
              icon: Ruler,
              title: 'Limits, checked as you type',
              body: '280 on X, 500 on Threads, 2,200 on Instagram and TikTok. Counters run against the strictest channel you pick.',
            },
            {
              icon: PencilLine,
              title: 'Change your mind freely',
              body: 'Edit the caption, swap the image, move the slot or pull the post, right up to the minute it ships.',
            },
            {
              icon: PauseCircle,
              title: 'Disconnects pause, not fail',
              body: 'Queued posts for a disconnected channel wait. Reconnect and they carry on, nothing lost.',
            },
            {
              icon: Activity,
              title: 'One result per channel',
              body: 'If a network is down at your slot, only that channel fails. Fix it and re-queue just that one.',
            },
          ]}
          cols={4}
        />
      </Section>

      <FaqList
        items={[
          {
            q: 'Do I need my phone nearby for posts to go out?',
            a: 'No. Publishing runs on the cloud worker, not your device. Schedule from anywhere and close the app. Posts still ship on time.',
          },
          {
            q: 'Can I publish immediately instead of scheduling?',
            a: 'Yes. Post now and schedule later live in the same composer with the same channels, previews and results.',
          },
          {
            q: 'What happens if a platform is down at my slot?',
            a: 'That channel reports failed in the queue while the rest go out normally. Fix the connection and re-queue just the failed channel.',
          },
          {
            q: 'What happens if I disconnect a channel with posts queued?',
            a: 'Its queued items pause instead of failing. Reconnect and they resume. Nothing is lost.',
          },
          {
            q: 'How fast does publishing happen?',
            a: 'The worker ships every channel inside about a minute of the scheduled time, and each result lands back in the queue.',
          },
        ]}
      />

      <CtaCard
        title="Fill the calendar once. Let it run all week."
        body="Connect your channels, schedule the week in one sitting, and let the queue publish while you work on something else."
      />
    </>
  );
}
