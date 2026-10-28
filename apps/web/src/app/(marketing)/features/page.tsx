import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import Link from 'next/link';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { FeatureBlocks, PageHero } from '@/components/site/PageBlocks';

export const metadata: Metadata = seo({
  path: '/features',
  title: 'Social media management features',
  description: 'Everything in Sosial: a calendar that publishes to every channel, a composer with per-channel limits, approvals, analytics and an AI writer.',
  kicker: 'Features',
  cardTitle: 'Plan it, write it, ship it everywhere.',
});

const MORE = [
  { href: '/integrations', title: 'Integrations', body: 'Every network Sosial publishes to, and what each one rewards.' },
  { href: '/made-for-everyone', title: 'Made for everyone', body: 'Solo creators, small teams and agencies on the same calendar.' },
  { href: '/pricing', title: 'Pricing', body: 'A free plan with no end date, and paid plans you can read up front.' },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Plan it, write it, ship it everywhere."
        lede="Sosial is a calendar, a composer and an AI writer that share one queue, so a post goes from idea to every network without copy and paste. Everything below is the real app."
        secondary={{ href: '/integrations', label: 'See every channel' }}
        visual={<AppPreview screen="calendar-month" caption="The Sosial calendar with a month of posts across six accounts." />}
      />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Publish',
            title: 'One calendar, every channel.',
            body: 'Drop a post on the calendar and the queue ships it on time, app open or closed. Drag it to another day and every channel moves with it.',
            points: ['Day, week, month, year and list views', 'Per-channel publish times', 'Honest per-channel results'],
            visual: <AppPreview screen="week" caption="The dashboard week. Read more on the Publish page." />,
          },
          {
            eyebrow: 'Create',
            title: 'Write once, preview everywhere.',
            body: 'One composer writes for every network you pick, with live counters against the strictest limit and media that fits each feed.',
            points: ['Pick channels, write once', 'Post now or schedule', 'Threads, templates and designs'],
            visual: <AppPreview screen="composer" caption="Create post, with the AI writer beside it." />,
          },
          {
            eyebrow: 'AI assistant',
            title: 'A writer that knows each network.',
            body: 'Draft captions and threads from a single idea in 100+ languages, in the tone and structure you choose. Nothing publishes without you.',
            points: ['Language first', 'Tone, style and structure', 'Single posts or threads'],
            visual: <AppPreview screen="ai-writer" caption="The AI writer card, as it appears in Create post." />,
          },
        ]}
      />

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-10 px-4 py-14 md:grid-cols-3 md:py-20">
          {[
            { href: '/publish', title: 'Publish', body: 'Calendar, queue, limits and control.' },
            { href: '/features/create', title: 'Create', body: 'The composer, templates and media.' },
            { href: '/ai-assistant', title: 'AI assistant', body: 'Research, languages, styles and rewrites.' },
            ...MORE,
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group border-t border-line py-5">
              <span className="flex items-center justify-between gap-3 font-display text-lg font-extrabold tracking-tight">
                {l.title}
                <span aria-hidden="true" className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink">
                  →
                </span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{l.body}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
