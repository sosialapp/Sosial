import type { Metadata } from 'next';
import { BrandIcon } from '@/components/BrandIcon';
import { CalendarPreview } from '@/components/landing/Preview';
import { CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';

/** CMS edits go live within minutes. */
export const revalidate = 300;
import { ALL_PROVIDERS, PROVIDER_META } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'Publish',
  description:
    'Schedule across X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest from one calendar and queue. Published by a worker, on time.',
  alternates: { canonical: '/publish' },
};

function QueueVisual() {
  const rows = [
    ['Launch teaser', 'Queued', 'bg-paper-dim text-ink'],
    ['Roundup video', 'Publishing', 'bg-paper-dim text-ink'],
    ['Founder story', 'Sent', 'bg-[#EDF3EC] text-[#346538]'],
  ] as const;
  return (
    <div className="card flex flex-col gap-2 p-4" aria-hidden="true">
      {rows.map(([label, status, cls]) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-2"
        >
          <span className="text-xs font-semibold text-soft">{label}</span>
          <span className={`pill ${cls}`}>{status}</span>
        </div>
      ))}
      <p className="px-1 pt-1 text-[11px] text-faint">Shipped by the worker, app open or closed.</p>
    </div>
  );
}

function LimitsVisual() {
  return (
    <div className="card p-4" aria-hidden="true">
      <p className="eyebrow">Real limits, enforced up front</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALL_PROVIDERS.map((p) => {
          const meta = PROVIDER_META[p];
          return (
            <span
              key={p}
              className="pill bg-paper px-2.5 py-1 text-[11px] text-soft ring-1 ring-line"
            >
              <BrandIcon provider={p} className="mr-1 h-3 w-3" />
              {meta.label} · {meta.limit.toLocaleString()}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Over the limit? The composer trims before you schedule, never after you publish.
      </p>
    </div>
  );
}

export default function PublishPage() {
  return (
    <>
      <PageHero
        eyebrow="Publish"
        title="Every post, on time, everywhere."
        lede="Write once, drop it on the calendar, and let the queue ship all ten channels. No retyping per network, no 11pm manual posting."
        secondary={{ href: '/integrations', label: 'See every channel' }}
        visual={
          <div className="card p-3 md:p-4">
            <CalendarPreview />
          </div>
        }
      />

      <PageCms slug="publish" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Calendar',
            title: 'One calendar for ten channels.',
            body: 'Drafts, the queue and approvals live on the same grid. Drag a post between days and every channel target moves with it. Nothing to re-enter, nothing to forget.',
            points: [
              'See the whole week across every network at a glance',
              'Drafts sit beside scheduled posts until you commit them',
              'Approvals show exactly where they are in the flow',
            ],
          },
          {
            eyebrow: 'Queue',
            title: 'A queue that runs itself.',
            body: 'Schedule a post and the cloud worker publishes each channel inside a minute of its slot, even with the app closed and the laptop shut. Per-channel results land back in the queue so you always know what went out.',
            points: [
              'Post now or schedule for later in the same composer',
              'Pause, edit or pull anything before its slot',
              'Every channel reports back: sent, publishing or failed',
            ],
            visual: <QueueVisual />,
          },
          {
            eyebrow: 'Limits',
            title: 'Character limits, handled before you schedule.',
            body: 'Every network gets its real limit: 280 on X, 500 on Threads, 2,200 on Instagram and TikTok, all the way to 63,206 on Facebook. Counters count, bars fill, and over-long captions trim before they leave, not after.',
            visual: <LimitsVisual />,
          },
          {
            eyebrow: 'Control',
            title: 'Change your mind freely.',
            body: 'Plans shift. Edit a caption, swap the image, move the slot or pull the post entirely, up to the minute it ships. Disconnecting a channel pauses its queued items instead of failing them.',
          },
        ]}
      />

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

      <CtaBand
        title="Fill next week in one sitting."
        body="One caption, ten channels, zero late-night posting."
        secondary={{ href: '/features/create', label: 'See the composer' }}
      />
    </>
  );
}
