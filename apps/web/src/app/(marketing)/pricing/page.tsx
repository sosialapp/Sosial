import type { Metadata } from 'next';
import { CtaBand, FaqList, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';
import PricingPlans from '@/components/PricingPlans';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'A free plan that stays free, Solo for unlimited publishing across all ten channels, Team for approvals, Business for scale. Monthly or annual — annual gives you two months free. Cancel any time.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple plans, published prices."
        lede="Start free and stay free if that is enough. Upgrade when you want all ten channels, the AI writer or approvals. Monthly or annual — annual gives you two months free."
        secondary={{ href: '/compare', label: 'Compare with alternatives' }}
      />

      <PageCms slug="pricing" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <PricingPlans />

      <FaqList
        items={[
          {
            q: 'What counts against the free plan limit?',
            a: 'Scheduled and sent posts. Drafts do not count, and neither do edits to a post before it ships.',
          },
          {
            q: 'Are there per-channel fees?',
            a: 'No. Connecting Instagram costs the same as connecting X. Every plan that includes a channel includes all of its features.',
          },
          {
            q: 'What happens if I hit the free limit mid-month?',
            a: 'New scheduling pauses; nothing already queued is lost. Upgrade and the queue picks up where it left off, or wait for the reset next month.',
          },
          {
            q: 'Can I switch plans or cancel?',
            a: 'Any time, from billing settings. Plan and billing-interval changes apply immediately and are prorated by Stripe; cancelling keeps your plan until the end of the current period.',
          },
          {
            q: 'Is the AI writer included?',
            a: 'On Solo, Team and Business — 500, 1,000 and 2,000 generations a month respectively. Free plans get the composer, previews and queue without AI generation.',
          },
          {
            q: 'Do you charge for team seats on Team or Business?',
            a: 'No. Team and Business are flat prices for the whole workspace, whether it is two people or ten.',
          },
          {
            q: 'How does annual billing work?',
            a: 'You pay once a year — annual costs the same as ten months, so you get two months free. Monthly allowances (AI generations, scheduled posts) still reset every month.',
          },
        ]}
      />

      <CtaBand
        title="Start on free. Upgrade when it earns it."
        body="No credit card for the free plan, and the prices above are the prices you pay."
        secondary={{ href: '/compare', label: 'See the comparison' }}
      />
    </>
  );
}
