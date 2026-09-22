import type { Metadata } from 'next';
import { CardTrio, CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import { resourceHref } from '@/content/types';

export const metadata: Metadata = {
  title: 'Sosial for small business',
  description:
    'Look open every day with a 30-minute weekly ritual. Templates, one composer and a queue that publishes while you serve customers.',
  alternates: { canonical: '/audiences/small-business' },
};

export default function SmallBusinessPage() {
  return (
    <>
      <PageHero
        eyebrow="For small business"
        title="Look open every day."
        lede="There's no marketing team. It's you, between customers. Sosial turns social media into a 30-minute Monday ritual instead of a daily guilt trip."
        secondary={{ href: '/publish', label: 'See publishing' }}
      />

      <CardTrio
        eyebrow="Sound familiar?"
        title="The small-business posting trap."
        cards={[
          {
            title: 'Feast or famine',
            body: 'A burst of daily posts, then three silent weeks when the shop gets busy. Customers check your profile and wonder if you are still open.',
          },
          {
            title: 'No marketing person',
            body: 'Strategy decks assume a team. You have a phone, twenty spare minutes, and a business to run.',
          },
          {
            title: 'Every app wants something different',
            body: 'Image sizes, caption lengths, hashtags, best times. A full-time education disguised as a free tool.',
          },
        ]}
      />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Monday, 30 minutes',
            title: 'Plan the week on one page.',
            body: 'The content calendar template turns planning into filling boxes: one offer, one behind-the-scenes, one proof post. Repeat weekly and you never start from zero.',
          },
          {
            eyebrow: 'Templates do the writing',
            title: 'Say it once, reuse it forever.',
            body: 'Starter templates and caption formulas cover the posts every local business needs: new stock, opening hours, happy customers. Swap the details, keep the structure.',
          },
          {
            eyebrow: 'Queue and forget',
            title: 'Publish while you serve.',
            body: 'Schedule the week in that same half hour. The worker posts on time while you are with customers, and Sunday takes two minutes to see what worked.',
          },
        ]}
      />

      <CardTrio
        eyebrow="Start here"
        title="The small-business stack."
        cards={[
          {
            title: 'Publish',
            body: 'A calendar and queue that post while you work.',
            href: '/publish',
            linkLabel: 'Explore Publish',
          },
          {
            title: 'Content calendar template',
            body: 'The free weekly planning sheet behind the ritual.',
            href: resourceHref('content-calendar-template'),
            linkLabel: 'Get the template',
          },
          {
            title: 'Posting consistency systems',
            body: 'The guide to staying visible on little time.',
            href: '/blog/posting-consistency-systems',
            linkLabel: 'Read the guide',
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'How much time does this actually take?',
            a: 'About thirty minutes once a week once the habit exists: plan on the template, draft in the composer, queue everything. Daily posting then happens without you.',
          },
          {
            q: 'Which channels should a small business be on?',
            a: 'Wherever your customers already look, usually two or three. The Free plan covers two channels, so start there and expand when it pays.',
          },
          {
            q: 'What does it cost?',
            a: 'Free covers two channels with the composer, calendar and queue. Pro is $5 a month for all ten channels and the AI writer, less than one boosted post.',
          },
        ]}
      />

      <CtaBand
        title="Thirty minutes on Monday."
        body="A week of looking open, done before the shutters go up."
      />
    </>
  );
}
