import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import {
  Activity, Bot, CheckCircle2, Eye, ListChecks, Loader2, Lock, Receipt, XCircle, type LucideIcon,
} from 'lucide-react';
import Reveal from '@/components/anim/Reveal';
import { BRAND_NAMES, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { FaqList } from '@/components/site/PageBlocks';
import { Hero, IconGrid, Section, SectionHead } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import { docsUrl } from '@/lib/site';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

import { transparencyCopy } from '@/content/pages/transparency';
import { fill } from '@/lib/i18n/locales';
import { getLocale, siteI18n } from '@/lib/i18n/server';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = transparencyCopy[locale];
  // CMS overrides are written in English; other locales keep the translations.
  const cms = locale === 'en' ? await sitePageMeta('transparency') : null;
  return seo({
    path: '/transparency',
    locale,
    title: cms?.metaTitle ?? c.metaTitle,
    description: cms?.metaDescription ?? c.metaDesc,
    kicker: c.kicker,
    cardTitle: cms?.title ?? c.title,
  });
}

/** Status text comes from the copy, in this order. */
const RESULTS: { provider: BrandProvider; icon: LucideIcon }[] = [
  { provider: 'instagram', icon: CheckCircle2 },
  { provider: 'x', icon: CheckCircle2 },
  { provider: 'linkedin', icon: Loader2 },
  { provider: 'tiktok', icon: XCircle },
];
const PILLAR_ICONS = [Receipt, Lock, Bot, Activity];

export default async function TransparencyPage() {
  const { locale, t, href } = await siteI18n();
  const c = transparencyCopy[locale];
  const meta = await sitePageMeta('transparency');
  const date = formatPageDate(meta?.publishedAt ?? null, locale);
  const prices = { href: href('/pricing'), label: c.publishedPrices };
  // The privacy policy lives on the docs site and stays English.
  const pillarHrefs = [href('/pricing'), `${docsUrl()}/privacy`, href('/ai-assistant'), href('/publish')];
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: t('siteHome'), path: href('/') }, { name: c.kicker, path: href('/transparency') }]} />
      <Hero
        icon={Eye}
        kicker={c.kicker}
        title={(locale === 'en' ? meta?.title : null) ?? c.title}
        lede={c.lede}
        meta={date ? fill(t('siteUpdated'), { date }) : undefined}
        secondary={prices}
      />

      <PageCms slug="transparency" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <IconGrid
          cols={2}
          items={c.pillars.map((it, i) => ({ icon: PILLAR_ICONS[i], href: pillarHrefs[i], ...it }))}
        />
      </Section>

      <Section tone="surface">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHead icon={ListChecks} kicker={c.publishing.kicker} title={c.publishing.title} />
            <p className="mt-5 text-base leading-relaxed text-ink/60 sm:text-[17px]">{c.publishing.body}</p>
          </div>
          <Reveal y={28} className="lg:col-span-7">
            <div className="rounded-[24px] border border-line bg-paper p-3 shadow-[0_24px_48px_-32px_rgba(28,26,20,0.35)] sm:p-4" aria-hidden="true">
              <div className="flex items-center justify-between px-3 pb-3 pt-2">
                <p className="font-display text-[15px] font-[700]">{c.demo.post}</p>
                <p className="text-xs text-ink/50">{c.demo.when}</p>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {RESULTS.map((r, i) => (
                  <div key={r.provider} className="flex items-center gap-3 bg-paper px-4 py-3.5">
                    <BrandIcon provider={r.provider} className="h-6 w-6" />
                    <span className="flex-1 text-sm font-medium">{BRAND_NAMES[r.provider]}</span>
                    <span className="flex items-center gap-1.5 text-sm text-ink/70">
                      <r.icon className="h-4 w-4" strokeWidth={2} />
                      {c.demo.statuses[i]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="px-3 pb-1 pt-3 text-xs text-ink/50">{c.demo.note}</p>
            </div>
          </Reveal>
        </div>
      </Section>

      <FaqList items={c.faq} />

    </>
  );
}
