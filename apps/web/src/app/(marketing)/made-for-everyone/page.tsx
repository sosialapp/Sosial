import type { Metadata } from 'next';
import { CardTrio, CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Made for everyone',
  description:
    'Sosial is built for solo creators, small teams and agencies alike: a free plan that stays free, 100+ languages, real accessibility, and apps on iOS, Android and web.',
  alternates: { canonical: '/made-for-everyone' },
};

export default function MadeForEveryonePage() {
  return (
    <>
      <PageHero
        eyebrow="Made for everyone"
        title="Publishing should not be a privilege."
        lede="The tools behind daily posting got expensive, English-first and desktop-only. Sosial is the opposite: a free plan that stays free, a hundred languages, and the same app in your pocket as on your desk."
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />

      <PageCms slug="made-for-everyone" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <CardTrio
        eyebrow="Who it is for"
        title="One workspace, very different jobs."
        cards={[
          {
            title: 'Creators and founders',
            body: 'One person, ten channels, no team. Write in the morning, let the queue ship through the day, and keep the evening for actual work.',
            href: '/features/create',
            linkLabel: 'See the composer',
          },
          {
            title: 'Small teams',
            body: 'A marketer, a writer and a founder who wants to approve things. Members draft, admins publish, owners hold the accounts and billing.',
            href: '/ai-assistant',
            linkLabel: 'Meet the AI writer',
          },
          {
            title: 'Agencies and freelancers',
            body: 'Many clients, clear edges. Keep each workspace separate, schedule across every network, and show up with analytics instead of excuses.',
            href: '/publish',
            linkLabel: 'See publishing',
          },
        ]}
      />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Languages',
            title: 'Your language, first, not last.',
            body: 'The AI writer picks from 100+ languages before it drafts anything, so the output is native rather than translated. English, Melayu, Tamil, beyond: the composer and previews follow you.',
            points: [
              '100+ languages chosen up front',
              'No English-first awkwardness',
              'Per-channel previews in your script',
            ],
          },
          {
            eyebrow: 'Devices',
            title: 'Phone, tablet, desk, equal.',
            body: 'iOS, Android and the web run the same workspace with the same queue behind them. Approve a post on the train; the worker still ships it on time with the laptop shut.',
            points: [
              'Native apps on iOS and Android',
              'Full workspace in the browser',
              'Cloud queue publishes without any device open',
            ],
          },
          {
            eyebrow: 'Access',
            title: 'Built to be used.',
            body: 'Real contrast on every surface, keyboard paths through every flow, alt text treated as expected rather than optional, and no feature hidden behind a paywall that used to be free.',
            points: [
              'Contrast checked on light and dark',
              'Alt text prompts where the network expects them',
              'A free plan with no expiry date',
            ],
          },
          {
            eyebrow: 'Price',
            title: 'Free means free.',
            body: 'Three channels and a month of scheduled posts cost nothing, with no card and no trial clock. When you outgrow it, the paid prices are on a page you can read before signing up.',
            visual: (
              <div className="card p-5" aria-hidden="true">
                <p className="eyebrow">Every plan includes</p>
                <ul className="mt-3 space-y-2.5 text-sm text-soft">
                  {[
                    'Calendar and queue',
                    'Per-channel previews and limits',
                    'iOS, Android and web',
                    'Your data exportable on request',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-ink">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'Is the free plan a trial?',
            a: 'No. It has limits (3 channels, 30 scheduled posts a month) and no end date. It resets every month whether you upgrade or not.',
          },
          {
            q: 'Does it work outside English?',
            a: 'Yes. The product interface is built for global use, and the AI writer handles 100+ languages natively rather than translating from English.',
          },
          {
            q: 'Do I need a computer?',
            a: 'No. iOS and Android apps carry the full compose, schedule and approve flows. The queue itself runs in the cloud, so no device needs to stay open.',
          },
          {
            q: 'Is it usable with a keyboard or screen reader?',
            a: 'Flows are keyboard-operable, contrast is checked in both themes, and alt text is part of the compose flow because several networks treat it as required.',
          },
        ]}
      />

      <CtaBand
        title="Everyone gets the same ten channels."
        body="Start on free. The upgrades are speed, not survival."
        secondary={{ href: '/about', label: 'About Sosial' }}
      />
    </>
  );
}
