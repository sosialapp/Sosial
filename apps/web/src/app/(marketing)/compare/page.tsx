import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, Check, Compass, Hand, Minus, Scale, Smartphone } from 'lucide-react';
import { COMPETITORS, competitorHref } from '@/content/competitors';
import Reveal from '@/components/anim/Reveal';
import { FaqList } from '@/components/site/PageBlocks';
import { Hero, IconGrid, Section, SectionHead } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import { compareCopy } from '@/content/pages/compare';
import { fill } from '@/lib/i18n/locales';
import { getLocale, siteI18n } from '@/lib/i18n/server';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = compareCopy[locale];
  // CMS overrides are written in English; other locales keep the translations.
  const cms = locale === 'en' ? await sitePageMeta('compare') : null;
  return seo({
    path: '/compare',
    locale,
    title: cms?.metaTitle ?? c.metaTitle,
    description: cms?.metaDescription ?? c.metaDesc,
    kicker: c.kicker,
    cardTitle: cms?.title ?? c.title,
  });
}

type Cell = string | boolean;

/** One row per copy `rows` label: Sosial, suites, single-network apps, by hand. */
const CELLS: [Cell, Cell, Cell, Cell][] = [
  [true, false, false, false],
  [true, true, false, false],
  [true, false, true, false],
  [true, false, false, false],
  [true, false, true, false],
  [true, false, true, true],
  [true, false, true, false],
  [true, true, false, true],
];

function mark(cell: Cell, yes: string, no: string) {
  return cell === true ? (
    <Check className="mx-auto h-[18px] w-[18px] text-ink" strokeWidth={2.4} aria-label={yes} />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-ink/25" strokeWidth={2} aria-label={no} />
  );
}

const FIT_ICONS = [Building2, Smartphone, Hand];

export default async function ComparePage() {
  const { locale, t, href } = await siteI18n();
  const c = compareCopy[locale];
  const meta = await sitePageMeta('compare');
  const date = formatPageDate(meta?.publishedAt ?? null, locale);
  const pricing = { href: href('/pricing'), label: t('siteSeePricing') };
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: t('siteHome'), path: href('/') }, { name: c.kicker, path: href('/compare') }]} />
      <Hero
        icon={Scale}
        kicker={c.kicker}
        title={(locale === 'en' ? meta?.title : null) ?? c.title}
        lede={c.lede}
        meta={date ? fill(t('siteUpdated'), { date }) : undefined}
        secondary={pricing}
      />

      <PageCms slug="compare" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <Reveal y={24}>
          <div className="relative overflow-x-auto rounded-[24px] border border-line">
            <table className="w-full min-w-[680px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="w-[38%] px-6 py-5 text-left text-sm font-medium text-ink/55">
                    {c.capability}
                  </th>
                  {c.headers.map((h, i) => (
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
                {c.rows.map((label, r) => (
                  <tr key={label} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-6 py-4 text-left font-normal text-ink/80">
                      {label}
                    </th>
                    {CELLS[r].map((cell, i) => (
                      <td key={i} className={`px-4 py-4 text-center ${i === 0 ? 'bg-surface' : ''}`}>
                        {mark(cell, t('siteYes'), t('siteNo'))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink/50">{c.note}</p>
          <div className="mt-10">
            <h2 className="font-display text-xl font-extrabold tracking-tight">{c.headToHead}</h2>
            {/* Named comparisons are English-only, so these links skip href(). */}
            <div className="mt-4 flex flex-wrap gap-2.5">
              {COMPETITORS.map((o) => (
                <Link
                  key={o.slug}
                  href={competitorHref(o.slug)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-bold text-ink/75 transition hover:bg-surface hover:text-ink"
                >
                  Sosial vs {o.name}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </Section>

      <Section tone="surface">
        <SectionHead icon={Compass} kicker={c.fit.kicker} title={c.fit.title} lede={c.fit.lede} />
        <IconGrid items={c.fit.items.map((it, i) => ({ icon: FIT_ICONS[i], ...it }))} />
      </Section>

      <FaqList items={c.faq} />

    </>
  );
}
