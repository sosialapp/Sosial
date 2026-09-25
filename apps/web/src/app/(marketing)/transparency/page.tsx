import type { Metadata } from 'next';
import { CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Transparency',
  description:
    'Published prices, plain data practices, AI that does not train on your work, real platform limits, and per-channel publish results. How Sosial stays open with the people who use it.',
  alternates: { canonical: '/transparency' },
};

export default function TransparencyPage() {
  return (
    <>
      <PageHero
        eyebrow="Transparency"
        title="Nothing important stays in the fine print."
        lede="Prices you can read before signing up, data practices in plain sentences, AI that never trains on your drafts, and publish results reported per channel. If it affects your work, you can see it."
        secondary={{ href: '/pricing', label: 'Published prices' }}
      />

      <PageCms slug="transparency" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Pricing',
            title: 'The price is on the page.',
            body: 'Free, Solo, Team and Business are listed with what each includes, before you create an account. No per-channel upsells, no seat taxes, and annual billing that simply knocks two months off. Changes to prices reach existing subscribers before they take effect.',
            points: [
              'All plans and limits on one public page',
              'No charge without a plan change you make',
              'Cancel from settings, keep your data',
            ],
          },
          {
            eyebrow: 'Your data',
            title: 'Yours, not ours to sell.',
            body: 'We do not sell your content, your audience data or your schedule. Posts and drafts power your workspace and nothing else. Your briefs and drafts are not used to train AI models. Export or deletion requests are handled from support, in writing.',
            points: [
              'No sale of content or audience data',
              'No training on your drafts',
              'Export and deletion on request',
            ],
          },
          {
            eyebrow: 'AI',
            title: 'A drafter, never a publisher.',
            body: 'The AI writer researches, drafts and flags uncertainty with linked sources. It cannot schedule or publish anything. Every word passes through you first, and you always see what it used to ground a claim.',
            points: [
              'Nothing publishes without your approval',
              'Sources returned with researched drafts',
              'Uncertainties flagged, not smoothed over',
            ],
          },
          {
            eyebrow: 'Publishing',
            title: 'Real limits, real results.',
            body: 'Character limits shown in the composer are the platforms actual limits, enforced before scheduling rather than after publishing. When the worker ships a post, each channel reports back its own result: sent, publishing or failed. Failures are visible, not quietly retried into the night.',
            visual: (
              <div className="card flex flex-col gap-2 p-4" aria-hidden="true">
                {[
                  ['Instagram', 'Sent', 'bg-[#EDF3EC] text-[#346538]'],
                  ['X', 'Sent', 'bg-[#EDF3EC] text-[#346538]'],
                  ['LinkedIn', 'Publishing', 'bg-paper-dim text-ink'],
                  ['TikTok', 'Failed, retry available', 'bg-[#FDEBEC] text-[#9F2F2D]'],
                ].map(([label, status, cls]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-2"
                  >
                    <span className="text-xs font-semibold text-soft">{label}</span>
                    <span className={`pill ${cls}`}>{status}</span>
                  </div>
                ))}
                <p className="px-1 pt-1 text-[11px] text-faint">
                  Per-channel results land in the queue as they happen.
                </p>
              </div>
            ),
          },
        ]}
      />

      <FaqList
        items={[
          {
            q: 'Do you train AI on what I write?',
            a: 'No. Briefs and drafts are not used to train models. Generated copy exists to serve your workspace and nothing else.',
          },
          {
            q: 'Who can see my scheduled posts?',
            a: 'People in your workspace, according to their role. Members see what they need to draft and review; connected accounts and billing stay with owners.',
          },
          {
            q: 'What happens when a platform changes a limit?',
            a: 'The limit updates in our channel data and the composer follows it. Every channel guide shows the number it is enforcing.',
          },
          {
            q: 'How do I get my data out?',
            a: 'Ask from support and you receive an export of your posts, schedule and workspace content. Deletion works the same way, in writing.',
          },
          {
            q: 'Will prices change without notice?',
            a: 'Existing subscribers get notice before a price change takes effect. The public pricing page always reflects what new customers pay today.',
          },
        ]}
      />

      <CtaBand
        title="Read the prices. Read the practices."
        body="Both are written to be understood, not survived."
        secondary={{ href: '/privacy', label: 'Privacy policy' }}
      />
    </>
  );
}
