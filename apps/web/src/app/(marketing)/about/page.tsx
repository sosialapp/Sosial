import type { Metadata } from 'next';
import { CardTrio, CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('about');
  return {
    title: meta?.metaTitle ?? meta?.title ?? 'About',
    description:
      meta?.metaDescription ??
      'Sosial is a small team building one calendar for ten social networks: compose once, approve as a team, and let a cloud queue ship every channel on time.',
    alternates: { canonical: '/about' },
  };
}

export default async function AboutPage() {
  const meta = await sitePageMeta('about');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <PageHero
        eyebrow="About"
        title={meta?.title ?? 'One calendar for ten networks.'}
        lede="Sosial exists because publishing daily across every network had become a second job: ten tabs, five drafts, and an alarm for the 11pm post. We are a small team building the workspace we wanted ourselves."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />

      <PageCms slug="about" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Why',
            title: 'The job is the writing, not the routing.',
            body: 'Social work is ideas, hooks and edits. The routing, the character counts and the midnight scheduling are overhead. Sosial takes the overhead: one composer with honest previews, one calendar, and a queue that ships while you sleep.',
            points: [
              'Compose once, publish to all ten channels',
              'Approvals so nothing ships unreviewed',
              'A worker that publishes on time, app closed',
            ],
          },
          {
            eyebrow: 'How',
            title: 'Small team, long horizon.',
            body: 'We ship in the open, publish our prices, and keep the free plan genuinely usable. No growth hacks in the composer, no selling your drafts, no dark patterns in billing. The product succeeds when daily posting stops feeling like a chore.',
            points: [
              'Published pricing, plain-language policies',
              'Free plan with no expiry clock',
              'Features earn their place or they leave',
            ],
          },
          {
            eyebrow: 'What is next',
            title: 'Deeper where it counts.',
            body: 'More channels when the networks earn them, smarter drafting that stays under your approval, and analytics that answer what to write next instead of flooding you with charts. The calendar and queue stay the centre of gravity.',
          },
          {
            eyebrow: 'Company',
            title: 'Operated by EGATE WORLDWIDE.',
            body: 'Sosial is built and run by EGATE WORLDWIDE. We are fully remote — no office yet — so email is the fastest way to reach a human: support@sosial.app.',
          },
        ]}
      />

      <CardTrio
        eyebrow="Principles"
        title="What we hold to."
        cards={[
          {
            title: 'Honest limits',
            body: 'The character count you see is the platform real limit, enforced before scheduling, not discovered after publishing.',
            href: '/transparency',
            linkLabel: 'Read transparency',
          },
          {
            title: 'Human approval',
            body: 'AI drafts, teammates review, you decide. Nothing reaches a network without a person pressing the button.',
            href: '/ai-assistant',
            linkLabel: 'Meet the writer',
          },
          {
            title: 'Fair access',
            body: 'A free plan without a trial date, 100+ languages from the first draft, and the same app on every device.',
            href: '/made-for-everyone',
            linkLabel: 'Made for everyone',
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'What is Sosial, in one sentence?',
            a: 'One workspace where a team composes, approves and schedules posts for ten social networks, and a cloud queue publishes them on time.',
          },
          {
            q: 'Who is it built for?',
            a: 'Solo creators, in-house teams and agencies. Anyone whose week includes more than one network and more than zero deadlines.',
          },
          {
            q: 'Which channels are supported?',
            a: 'Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon and Pinterest, each with its own guide and real limits.',
          },
          {
            q: 'How do I get in touch?',
            a: 'Email support@sosial.app — help, billing, feedback, anything. Support inside the app reaches the same team. Security and privacy matters are documented under Transparency and Privacy.',
          },
        ]}
      />

      <CtaBand
        title="Come build a calmer publishing week."
        body="Free to start, priced in the open, ten channels from day one."
        secondary={{ href: '/compare', label: 'See the comparison' }}
      />
    </>
  );
}
