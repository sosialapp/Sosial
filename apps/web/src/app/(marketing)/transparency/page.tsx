import type { Metadata } from 'next';
import {
  Activity, Bot, CheckCircle2, Eye, ListChecks, Loader2, Lock, Receipt, XCircle, type LucideIcon,
} from 'lucide-react';
import Reveal from '@/components/anim/Reveal';
import { BRAND_NAMES, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { FaqList } from '@/components/site/PageBlocks';
import { CtaCard, Hero, IconGrid, Section, SectionHead } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import { docsUrl } from '@/lib/site';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('transparency');
  return {
    title: meta?.metaTitle ?? meta?.title ?? 'Transparency',
    description:
      meta?.metaDescription ??
      'Published prices, plain data practices, AI that does not train on your work, real platform limits, and per-channel publish results. How Sosial stays open with the people who use it.',
    alternates: { canonical: '/transparency' },
  };
}

const RESULTS: { provider: BrandProvider; status: string; icon: LucideIcon }[] = [
  { provider: 'instagram', status: 'Sent', icon: CheckCircle2 },
  { provider: 'x', status: 'Sent', icon: CheckCircle2 },
  { provider: 'linkedin', status: 'Publishing', icon: Loader2 },
  { provider: 'tiktok', status: 'Failed, retry available', icon: XCircle },
];

export default async function TransparencyPage() {
  const meta = await sitePageMeta('transparency');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <Hero
        icon={Eye}
        kicker="Transparency"
        title={meta?.title ?? 'Nothing important stays in the fine print.'}
        lede="Prices you can read before signing up, data practices in plain sentences, AI that never trains on your drafts, and publish results reported per channel. If it affects your work, you can see it."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/pricing', label: 'Published prices' }}
      />

      <PageCms slug="transparency" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <IconGrid
          cols={2}
          items={[
            {
              icon: Receipt,
              title: 'The price is on the page',
              body: 'Free, Solo, Team and Business are listed with what each includes, before you create an account. No per-channel upsells, no seat taxes, and price changes reach existing subscribers before they take effect.',
              href: '/pricing',
              linkLabel: 'See pricing',
            },
            {
              icon: Lock,
              title: 'Your data is yours',
              body: 'We do not sell your content, your audience data or your schedule. Posts and drafts power your workspace and nothing else. Export or deletion is handled from support, in writing.',
              href: `${docsUrl()}/privacy`,
              linkLabel: 'Read the privacy policy',
            },
            {
              icon: Bot,
              title: 'A drafter, never a publisher',
              body: 'The AI writer researches, drafts and flags uncertainty with linked sources. It cannot schedule or publish anything, and your drafts are never used to train models.',
              href: '/ai-assistant',
              linkLabel: 'How the AI works',
            },
            {
              icon: Activity,
              title: 'Real limits, real results',
              body: 'Character limits in the composer are the platforms’ actual limits, enforced before scheduling. After publishing, each channel reports its own result.',
              href: '/publish',
              linkLabel: 'How publishing works',
            },
          ]}
        />
      </Section>

      <Section tone="surface">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHead
              icon={ListChecks}
              kicker="Publishing"
              title="Failures are visible, not quietly retried."
            />
            <p className="mt-5 text-base leading-relaxed text-ink/60 sm:text-[17px]">
              When the worker ships a post, every channel reports back on its own: sent, publishing or failed, with the
              network’s reason. Fix the one that failed and re-queue just that channel.
            </p>
          </div>
          <Reveal y={28} className="lg:col-span-7">
            <div className="rounded-[24px] border border-line bg-paper p-3 shadow-[0_24px_48px_-32px_rgba(28,26,20,0.35)] sm:p-4" aria-hidden="true">
              <div className="flex items-center justify-between px-3 pb-3 pt-2">
                <p className="font-display text-[15px] font-[700]">Launch post</p>
                <p className="text-xs text-ink/50">Today, 09:00</p>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {RESULTS.map((r) => (
                  <div key={r.provider} className="flex items-center gap-3 bg-paper px-4 py-3.5">
                    <BrandIcon provider={r.provider} className="h-6 w-6" />
                    <span className="flex-1 text-sm font-medium">{BRAND_NAMES[r.provider]}</span>
                    <span className="flex items-center gap-1.5 text-sm text-ink/70">
                      <r.icon className="h-4 w-4" strokeWidth={2} />
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
              <p className="px-3 pb-1 pt-3 text-xs text-ink/50">Per-channel results land in the queue as they happen.</p>
            </div>
          </Reveal>
        </div>
      </Section>

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

      <CtaCard
        title="See everything before you commit to anything."
        body="Read the prices, the privacy policy and the terms first. Then start free, with no card."
        secondary={{ href: '/pricing', label: 'Published prices' }}
      />
    </>
  );
}
