import type { Metadata } from 'next';
import { CardTrio, CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';

export const metadata: Metadata = {
  title: 'Sosial for creators',
  description:
    'Batch content once, adapt it to every channel, and let the queue publish while you create. Built for creators posting everywhere.',
  alternates: { canonical: '/audiences/creators' },
};

export default function CreatorsPage() {
  return (
    <>
      <PageHero
        eyebrow="For creators"
        title="Post everywhere without living everywhere."
        lede="Filming and editing is the job. Reformatting the same idea for six apps is the unpaid second shift. Sosial takes the second shift."
        secondary={{ href: '/create', label: 'See the composer' }}
      />

      <CardTrio
        eyebrow="Sound familiar?"
        title="The creator posting trap."
        cards={[
          {
            title: 'The second shift',
            body: 'The video is done, and now every app wants its own caption length, its own hook, its own hashtags. An hour of creating becomes an hour of admin.',
          },
          {
            title: 'Dead days kill reach',
            body: 'Algorithms reward consistency, but life interrupts. A few silent days and the next post has to climb all over again.',
          },
          {
            title: 'Ideas die in drafts',
            body: 'The notes app is full of half-posts that never shipped because turning them into ten channel-ready versions felt like too much.',
          },
        ]}
      />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Step one',
            title: 'Batch in one sitting.',
            body: 'Film everything, then draft fast. The AI writer turns rough notes into post-ready captions in your style, or bring your own words and skip it entirely.',
          },
          {
            eyebrow: 'Step two',
            title: 'Adapt once, not ten times.',
            body: 'One idea lays itself out across every channel with real limits and live counters. Threads split for readability; hooks land before the fold.',
          },
          {
            eyebrow: 'Step three',
            title: 'Queue the week, get back to creating.',
            body: 'Drop it all on the calendar and the worker publishes while you film the next thing. Per-channel results wait in the queue when you check back.',
          },
        ]}
      />

      <CardTrio
        eyebrow="Start here"
        title="The creator stack."
        cards={[
          {
            title: 'Create',
            body: 'The composer, templates and media that fit every feed.',
            href: '/create',
            linkLabel: 'Explore Create',
          },
          {
            title: 'AI Assistant',
            body: 'Research-backed drafts in your voice, in 100+ languages.',
            href: '/ai-assistant',
            linkLabel: 'Explore AI',
          },
          {
            title: 'Publish',
            body: 'A calendar and queue that ship while you create.',
            href: '/publish',
            linkLabel: 'Explore Publish',
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'Do I need to be on all ten channels?',
            a: 'No. Start with the two or three where your audience actually is. The Free plan covers two channels, and add more when one workflow already works.',
          },
          {
            q: 'Will the AI sound like me?',
            a: 'It drafts in styles with live samples, and you edit and approve everything. Most creators land on two or three saved patterns and reuse them.',
          },
          {
            q: 'What about video?',
            a: 'Attach video to any post and each channel receives it in the shape it expects. Short-form originals travel best between TikTok, Reels, Shorts and Pinterest.',
          },
        ]}
      />

      <CtaBand
        title="Create more. Admin less."
        body="Your week of posting, done in one sitting."
      />
    </>
  );
}
