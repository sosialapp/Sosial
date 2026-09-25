import type { Metadata } from 'next';
import { ComposerPreview } from '@/components/landing/Preview';
import { CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Create',
  description:
    'One composer for ten channels. Per-channel previews, live character counters, templates, and media that fits every network.',
  alternates: { canonical: '/features/create' },
};

export default function CreatePage() {
  return (
    <>
      <PageHero
        eyebrow="Create"
        title="Start from a blank page less."
        lede="One composer writes for ten networks at once, with live previews, honest character counts, reusable templates and media that fits everywhere."
        secondary={{ href: '/ai-assistant', label: 'Meet the AI writer' }}
        visual={
          <div className="card p-3 md:p-4">
            <ComposerPreview />
          </div>
        }
      />

      <PageCms slug="features/create" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Composer',
            title: 'Write once, preview everywhere.',
            body: 'Pick your channels and the composer shows each one the way it will actually appear, with a live counter against its real limit. No surprises after you hit schedule.',
            points: [
              'Per-channel preview cards before anything ships',
              'Live counters against true platform limits',
              'Over-long captions trim before scheduling, not after',
            ],
            visual: (
              <div className="card p-4" aria-hidden="true">
                <p className="eyebrow">This week, from one draft</p>
                <div className="mt-3 space-y-2">
                  {[
                    ['Launch teaser · 10 channels', 'Scheduled'],
                    ['Roundup video · 6 channels', 'Queued'],
                    ['Founder story · 4 channels', 'Draft'],
                  ].map(([label, status]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-2"
                    >
                      <span className="text-xs font-semibold text-soft">{label}</span>
                      <span className="pill bg-paper-dim text-ink">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            eyebrow: 'Templates',
            title: 'Your greatest hits, reusable.',
            body: 'Starter templates cover launches, roundups and founder stories, and your own best posts become templates too. A proven structure beats a blank page every time.',
            points: [
              'Starter templates for common post shapes',
              'Save your own winners as templates',
              'Pair with the caption-formulas cheat sheet',
            ],
          },
          {
            eyebrow: 'Media',
            title: 'Photos and video that fit each feed.',
            body: 'Attach up to four images or a video to any post, pull a real photo matched to your topic, or generate a cover image from a prompt. Each channel gets media in the shape it expects.',
            points: [
              'Up to 4 images or video per post',
              'Real topical photos when the camera roll is empty',
              'AI cover images generated from a prompt',
            ],
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'Do I have to rewrite my caption for each channel?',
            a: 'No. You write once; the composer adapts with per-channel previews and counters, and trims where a limit demands it.',
          },
          {
            q: 'Which media types can I attach?',
            a: 'Up to four images or a video per post, plus topical photos and AI-generated covers. Each channel page lists exactly what its network accepts.',
          },
          {
            q: 'Can I edit a post after scheduling it?',
            a: 'Yes. Edit the caption, swap media or move the slot any time before it ships.',
          },
          {
            q: 'What templates are included?',
            a: 'Starters for launches, roundups, founder stories and more, plus your own saved templates from posts that performed.',
          },
        ]}
      />

      <CtaBand
        title="Write it once. Ship it ten times."
        body="The composer does the reformatting. You do the thinking."
        secondary={{ href: '/publish', label: 'See publishing' }}
      />
    </>
  );
}
