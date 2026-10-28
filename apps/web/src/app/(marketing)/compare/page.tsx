import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import Image from 'next/image';
import { Building2, Check, Compass, Hand, Minus, Scale, Smartphone } from 'lucide-react';
import Reveal from '@/components/anim/Reveal';
import { FaqList } from '@/components/site/PageBlocks';
import { CtaCard, Hero, IconGrid, Section, SectionHead, type IconItem } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('compare');
  return seo({
    path: '/compare',
    title: meta?.metaTitle ?? 'Compare social media schedulers',
    description: meta?.metaDescription ?? 'How Sosial compares with all-in-one social suites, single-network schedulers and posting by hand: what each costs you and where each approach wins.',
    kicker: 'Compare',
    cardTitle: meta?.title ?? 'Where Sosial fits.',
  });
}

type Cell = string | boolean;

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: 'Ten networks in one composer', cells: [true, false, false, false] },
  { label: 'Publishes with the app closed', cells: [true, true, false, false] },
  { label: 'Live character limits before you schedule', cells: [true, false, true, false] },
  { label: 'AI writer with linked sources', cells: [true, false, false, false] },
  { label: 'Approvals and roles', cells: [true, false, true, false] },
  { label: 'Free plan that stays free', cells: [true, false, true, true] },
  { label: 'No per-channel paywall', cells: [true, false, true, false] },
  { label: 'Works on iOS, Android and web', cells: [true, true, false, true] },
];

const HEADERS = ['Sosial', 'Suites', 'Single-network apps', 'By hand'] as const;

function mark(cell: Cell) {
  return cell === true ? (
    <Check className="mx-auto h-[18px] w-[18px] text-ink" strokeWidth={2.4} aria-label="Yes" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-ink/25" strokeWidth={2} aria-label="No" />
  );
}

const FITS: IconItem[] = [
  {
    icon: Building2,
    title: 'All-in-one suites',
    body: 'Right if you need listening, ad buying and enterprise reporting. You pay for all of it, even the parts you never open.',
  },
  {
    icon: Smartphone,
    title: 'Single-network apps',
    body: 'Great for one lane. The cost appears when one idea has to become posts for several networks: retyping, re-checking, remembering.',
  },
  {
    icon: Hand,
    title: 'Posting by hand',
    body: 'Free and flexible until the week gets busy. Then the queue is the first thing to slip.',
  },
];

export default async function ComparePage() {
  const meta = await sitePageMeta('compare');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare' }]} />
      <Hero
        icon={Scale}
        kicker="Compare"
        title={meta?.title ?? 'Where Sosial fits.'}
        lede="Suites do a lot and charge for the lot. Single-network apps are light and stay in one lane. Posting by hand is free until it is 11pm. Here is the honest shape of each."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />

      <PageCms slug="compare" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <Reveal y={24}>
          <div className="overflow-x-auto rounded-[24px] border border-line">
            <table className="w-full min-w-[680px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="w-[38%] px-6 py-5 text-left text-sm font-medium text-ink/55">
                    Capability
                  </th>
                  {HEADERS.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-5 text-center font-display text-[15px] font-[700] tracking-[-0.01em] ${
                        i === 0 ? 'bg-surface' : 'text-ink/70'
                      }`}
                    >
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <Image src="/bolt.png" alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                          {h}
                        </span>
                      ) : (
                        h
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-6 py-4 text-left font-normal text-ink/80">
                      {r.label}
                    </th>
                    {r.cells.map((c, i) => (
                      <td key={i} className={`px-4 py-4 text-center ${i === 0 ? 'bg-surface' : ''}`}>
                        {mark(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink/50">
            Categories, not a takedown: &quot;suites&quot; means the big all-in-one tools, and &quot;single-network apps&quot;
            means schedulers built around one platform. Features across that group change often, so check current plans
            before you buy anything, ours included.
          </p>
        </Reveal>
      </Section>

      <Section tone="surface">
        <SectionHead
          icon={Compass}
          kicker="Honest fit"
          title="Each approach wins somewhere."
          lede="Pick the tool for the job you actually do every day, not the longest feature list."
        />
        <IconGrid items={FITS} />
      </Section>

      <FaqList
        items={[
          {
            q: 'Why not just use a big suite?',
            a: 'If you need listening, ads and enterprise reporting, a suite may serve you better. If your job is writing posts and getting them out on ten networks on time, the suite tax buys a lot of surface you never open.',
          },
          {
            q: 'Why not a free single-network app?',
            a: 'They are great for one lane. The cost shows up when one idea has to become ten posts: retyping, re-previewing, re-counting characters, and remembering which draft went where.',
          },
          {
            q: 'Why not post by hand?',
            a: 'You can. Hand posting works until the week gets busy, and then the queue is the first thing to slip. A calendar you fill once beats five apps you remember at midnight.',
          },
          {
            q: 'What does Sosial not do?',
            a: 'Social listening and ad buying. Those live in the suites. Sosial does compose, preview, schedule, approve and publish across your networks, with an AI writer, analytics and one inbox for comments and messages.',
          },
        ]}
      />

      <CtaCard
        title="Writing and shipping posts is the whole job here."
        body="Compose once, preview every network, schedule the week and let the queue publish it. Start on the free plan, no card needed."
      />
    </>
  );
}
