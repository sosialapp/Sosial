import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { Camera, Copy, Eye, Image as ImageIcon, Layers, LayoutTemplate, PenLine, Ruler, Sparkles } from 'lucide-react';
import { FaqList } from '@/components/site/PageBlocks';
import { CtaCard, Hero, IconGrid, Section, SectionHead, Split } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { createCopy } from '@/content/pages/create';
import { fill } from '@/lib/i18n/locales';
import { getLocale, siteI18n } from '@/lib/i18n/server';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = createCopy[locale];
  // CMS overrides are written in English; other locales keep the translations.
  const cms = locale === 'en' ? await sitePageMeta('features/create') : null;
  return seo({
    path: '/features/create',
    locale,
    title: cms?.metaTitle ?? c.metaTitle,
    description: cms?.metaDescription ?? c.metaDesc,
    kicker: c.kicker,
    cardTitle: cms?.title ?? c.title,
  });
}

const KIT_ICONS = [LayoutTemplate, Copy, ImageIcon, Camera, Sparkles, Ruler];

export default async function CreatePage() {
  const { locale, t, href } = await siteI18n();
  const c = createCopy[locale];
  const meta = await sitePageMeta('features/create');
  const date = formatPageDate(meta?.publishedAt ?? null, locale);
  const ai = { href: href('/ai-assistant'), label: c.meetAi };
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t('siteHome'), path: href('/') },
          { name: c.crumbFeatures, path: href('/features') },
          { name: c.kicker, path: href('/features/create') },
        ]}
      />
      <Hero
        icon={PenLine}
        kicker={c.kicker}
        title={(locale === 'en' ? meta?.title : null) ?? c.title}
        lede={c.lede}
        meta={date ? fill(t('siteUpdated'), { date }) : undefined}
        secondary={ai}
        visual={<AppPreview screen="composer" caption={c.heroCaption} />}
      />

      <PageCms slug="features/create" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section>
        <Split
          icon={Eye}
          kicker={c.composer.kicker}
          title={c.composer.title}
          body={c.composer.body}
          points={c.composer.points}
          visual={<AppPreview screen="quick-post" caption={c.composer.caption} />}
        />
      </Section>

      <Section tone="surface">
        <SectionHead icon={Layers} kicker={c.kit.kicker} title={c.kit.title} lede={c.kit.lede} />
        <IconGrid items={c.kit.items.map((it, i) => ({ icon: KIT_ICONS[i], ...it }))} />
      </Section>

      <FaqList items={c.faq} />

      <CtaCard title={c.ctaTitle} body={c.ctaBody} secondary={ai} />
    </>
  );
}
