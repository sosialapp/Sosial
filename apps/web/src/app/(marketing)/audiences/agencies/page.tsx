import type { Metadata } from 'next';
import { CardTrio, CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';

export const metadata: Metadata = {
  title: 'Sosial for agencies',
  description:
    'Client content without the screenshot ping-pong. Member drafts, one-tap approvals, per-channel assignment and roles across every brand you run.',
  alternates: { canonical: '/audiences/agencies' },
};

export default function AgenciesPage() {
  return (
    <>
      <PageHero
        eyebrow="For agencies"
        title="Client content without the screenshot ping-pong."
        lede="Approvals buried in email threads, juniors one misclick from the wrong account, every client on every app. Sosial gives the chaos a workflow."
        secondary={{ href: '/#teams', label: 'See approvals' }}
      />

      <CardTrio
        eyebrow="Sound familiar?"
        title="The agency posting trap."
        cards={[
          {
            title: 'Approval archaeology',
            body: 'Feedback lives across email, chat and annotated screenshots. Nobody can prove what the client actually signed off, until something goes wrong.',
          },
          {
            title: 'One misclick away',
            body: 'A junior with every password can publish anything anywhere. The blast radius of a tired Thursday is the entire client list.',
          },
          {
            title: 'Every client, every app',
            body: 'Ten brands times ten channels is a hundred contexts. Without per-client lanes, context switching eats the margin.',
          },
        ]}
      />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Step one',
            title: 'The team drafts. Nobody publishes by accident.',
            body: 'Members send posts for review instead of publishing directly. Owners and admins see exactly what is waiting, for which client and channel.',
          },
          {
            eyebrow: 'Step two',
            title: 'Approve in one tap.',
            body: 'Approve and it joins the queue; send a note back and it returns as a draft with the feedback attached. The approval itself becomes the paper trail.',
          },
          {
            eyebrow: 'Step three',
            title: 'Assign lanes, shrink the blast radius.',
            body: 'Limit each member to the channels they actually run. A junior on one client\u2019s Instagram can\u2019t touch another client\u2019s LinkedIn. Structural, not policy.',
          },
        ]}
      />

      <CardTrio
        eyebrow="Start here"
        title="The agency stack."
        cards={[
          {
            title: 'Teams & approvals',
            body: 'Roles, review flow and per-channel assignment.',
            href: '/#teams',
            linkLabel: 'See how it works',
          },
          {
            title: 'Publish',
            body: 'One calendar and queue across every client brand.',
            href: '/publish',
            linkLabel: 'Explore Publish',
          },
          {
            title: 'Client approvals guide',
            body: 'The agency workflow for getting to yes, faster.',
            href: '/blog/client-approvals-for-agencies',
            linkLabel: 'Read the guide',
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'What can each role do?',
            a: 'Owners run the workspace and billing, admins review and manage members, members draft and schedule within their assigned channels. Members cannot publish without approval.',
          },
          {
            q: 'How many people fit on the Team plan?',
            a: 'Seats are unlimited on Team. $10 a month covers the whole crew, with roles and per-channel assignment included.',
          },
          {
            q: 'Can a member only see certain channels?',
            a: 'Yes. Assignment limits each member to the channels they run, so client lanes stay separated by structure rather than trust alone.',
          },
        ]}
      />

      <CtaBand
        title="Replace the thread with a workflow."
        body="Drafts in, approvals out, receipts automatic."
      />
    </>
  );
}
