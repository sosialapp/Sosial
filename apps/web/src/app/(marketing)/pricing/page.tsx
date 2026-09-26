import type { Metadata } from 'next';
import { CtaBand, FaqList } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';
import PricingPlans from '@/components/PricingPlans';
import PlanComparison from '@/components/PlanComparison';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('pricing');
  return {
    title: meta?.metaTitle ?? meta?.title ?? 'Pricing',
    description:
      meta?.metaDescription ??
      'A free plan that stays free, Solo for creators, Team for approvals, Business for scale — with 3, 6, 25 and 100 channels. Monthly or annual, and annual gives you two months free. Cancel any time.',
    alternates: { canonical: '/pricing' },
  };
}

export default async function PricingPage() {
  const meta = await sitePageMeta('pricing');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <PricingPlans
        title={meta?.title ?? 'Simple plans, published prices.'}
        lede="Start free and stay free if that is enough. Upgrade for more channels, more AI credits and team approvals. Monthly or annual — annual gives you two months free."
        updated={date ?? undefined}
      />

      <PageCms slug="pricing" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <PlanComparison />

      <FaqList
        items={[
          {
            q: 'What counts against the scheduled-post limit?',
            a: 'Posts that are scheduled or waiting on a channel and not yet published. The limit is per connected channel, so each channel gets its own allowance, and a slot frees up the moment a post publishes. Drafts never count.',
          },
          {
            q: 'How many channels can I connect?',
            a: 'Free connects 3, Solo 6, Team 25 and Business 100. Connecting Instagram costs the same as connecting X — there are no per-channel fees.',
          },
          {
            q: 'How do AI credits work?',
            a: 'Every plan gets AI credits that reset on the 1st of each month: 20 on Free, then 500, 1,500 and 5,000 on Solo, Team and Business. A short rewrite costs 1 credit, a caption or platform adaptation 2, a thread or repurpose 3, and a long-form draft 5.',
          },
          {
            q: 'Can I switch plans or cancel?',
            a: 'Any time, from billing settings. Plan and billing-interval changes apply immediately and are prorated by Stripe; cancelling keeps your plan until the end of the current period.',
          },
          {
            q: 'What is the Sosial watermark?',
            a: 'Free posts carry a small “made with Sosial” badge. On Solo, Team and Business you control it and can turn it off in the studio — it never applies to content you bring in yourself.',
          },
          {
            q: 'Do you charge for team seats on Team or Business?',
            a: 'No. Team and Business are flat prices for the whole workspace — up to 5 members and 5 workspaces on Team, unlimited on Business.',
          },
          {
            q: 'How does annual billing work?',
            a: 'You pay once a year — annual costs the same as ten months, so you get two months free. AI credits still reset on the 1st of every month.',
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
