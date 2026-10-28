import type { Metadata } from 'next';
import {
  Accessibility, Briefcase, Check, Globe2, HeartHandshake, Languages, MonitorSmartphone, User, Users, UsersRound, Wallet,
} from 'lucide-react';
import Reveal from '@/components/anim/Reveal';
import { FaqList } from '@/components/site/PageBlocks';
import { CheckList, CtaCard, Hero, IconGrid, Section, SectionHead, Stats } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('made-for-everyone');
  return {
    title: meta?.metaTitle ?? meta?.title ?? 'Made for everyone',
    description:
      meta?.metaDescription ??
      'Sosial is built for solo creators, small teams and agencies alike: a free plan that stays free, 100+ languages, real accessibility, and apps on iOS, Android and web.',
    alternates: { canonical: '/made-for-everyone' },
  };
}

export default async function MadeForEveryonePage() {
  const meta = await sitePageMeta('made-for-everyone');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <Hero
        icon={Globe2}
        kicker="Made for everyone"
        title={meta?.title ?? 'Publishing should not be a privilege.'}
        lede="The tools behind daily posting got expensive, English-first and desktop-only. Sosial is the opposite: a free plan that stays free, a hundred languages, and the same app in your pocket as on your desk."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />

      <PageCms slug="made-for-everyone" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <Stats
          items={[
            { value: '100+', label: 'Languages the AI writer drafts in natively.' },
            { value: '3', label: 'Ways in: iOS, Android and the web, on one workspace.' },
            { value: 'Free', label: 'Plan with no card, no trial clock and no end date.' },
            { value: '0', label: 'Devices that need to stay on for posts to go out.' },
          ]}
        />
      </Section>

      <Section>
        <SectionHead
          icon={Users}
          kicker="Who it is for"
          title="One workspace, very different jobs."
          lede="Solo, small team or agency: the same composer, calendar and queue, with roles where you need them."
        />
        <IconGrid
          items={[
            {
              icon: User,
              title: 'Creators and founders',
              body: 'One person, many channels, no team. Write in the morning, let the queue ship through the day, keep the evening for actual work.',
              href: '/features/create',
              linkLabel: 'See the composer',
            },
            {
              icon: UsersRound,
              title: 'Small teams',
              body: 'A marketer, a writer and a founder who wants to approve things. Members draft, admins publish, owners hold accounts and billing.',
              href: '/ai-assistant',
              linkLabel: 'Meet the AI writer',
            },
            {
              icon: Briefcase,
              title: 'Agencies and freelancers',
              body: 'Many clients, clear edges. Keep each workspace separate, schedule across every network, and report with real analytics.',
              href: '/publish',
              linkLabel: 'See publishing',
            },
          ]}
        />
      </Section>

      <Section tone="surface">
        <SectionHead
          icon={HeartHandshake}
          kicker="Built in, not bolted on"
          title="Access is part of the product."
          lede="Language, devices and accessibility are defaults, not a premium tier."
        />
        <IconGrid
          cols={2}
          items={[
            {
              icon: Languages,
              title: 'Your language, first',
              body: 'The AI writer picks from 100+ languages before it drafts, so the output is native rather than translated. English, Melayu, Tamil and beyond, with previews in your script.',
            },
            {
              icon: MonitorSmartphone,
              title: 'Phone, tablet, desk, equal',
              body: 'iOS, Android and the web run the same workspace and queue. Approve a post on the train; the worker still ships it on time with the laptop shut.',
            },
            {
              icon: Accessibility,
              title: 'Built to be used',
              body: 'Contrast checked in light and dark, keyboard paths through every flow, and alt text prompts where networks expect them.',
            },
            {
              icon: Wallet,
              title: 'Free means free',
              body: 'Three channels and a month of scheduled posts cost nothing. When you outgrow it, the paid prices are on a page you can read before signing up.',
            },
          ]}
        />
      </Section>

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHead icon={Check} kicker="Every plan" title="The basics are never behind a paywall." />
          <Reveal>
            <div className="rounded-[24px] border border-line bg-surface p-7 sm:p-9">
              <CheckList
                items={[
                  'Calendar and queue',
                  'Per-channel previews and limits',
                  'iOS, Android and web',
                  'Your data, exportable on request',
                ]}
              />
            </div>
          </Reveal>
        </div>
      </Section>

      <FaqList
        items={[
          {
            q: 'Is the free plan a trial?',
            a: 'No. It has limits (3 channels, 10 scheduled posts per channel, 20 AI credits a month) and no end date. Credits reset on the 1st whether you upgrade or not.',
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

      <CtaCard
        title="Start free. Stay free as long as it fits."
        body="No card, no trial clock. Connect three channels and schedule your first month today."
      />
    </>
  );
}
