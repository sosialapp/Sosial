import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import {
  CheckCircle2, Languages, Layers, Lightbulb, ListOrdered, Palette, PenLine, RefreshCw, Search, ShieldCheck, Sparkles, Wand2, Workflow,
} from 'lucide-react';
import { FaqList } from '@/components/site/PageBlocks';
import { Hero, IconGrid, Section, SectionHead, Split, Steps } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { aiAssistantCopy } from '@/content/pages/aiAssistant';
import { fill } from '@/lib/i18n/locales';
import { getLocale, siteI18n } from '@/lib/i18n/server';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = aiAssistantCopy[locale];
  // CMS overrides are written in English; other locales keep the translations.
  const cms = locale === 'en' ? await sitePageMeta('ai-assistant') : null;
  return seo({
    path: '/ai-assistant',
    locale,
    title: cms?.metaTitle ?? c.metaTitle,
    description: cms?.metaDescription ?? c.metaDesc,
    kicker: c.kicker,
    cardTitle: cms?.title ?? c.title,
  });
}

const STEP_ICONS = [Lightbulb, Search, PenLine, CheckCircle2];
const WRITING_ICONS = [Languages, Palette, ListOrdered, RefreshCw, Layers, ShieldCheck];

export default async function AiAssistantPage() {
  const { locale, t, href } = await siteI18n();
  const c = aiAssistantCopy[locale];
  const meta = await sitePageMeta('ai-assistant');
  const date = formatPageDate(meta?.publishedAt ?? null, locale);
  const composer = { href: href('/features/create'), label: c.seeComposer };
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t('siteHome'), path: href('/') },
          { name: c.crumbFeatures, path: href('/features') },
          { name: c.kicker, path: href('/ai-assistant') },
        ]}
      />
      <Hero
        icon={Sparkles}
        kicker={c.kicker}
        title={(locale === 'en' ? meta?.title : null) ?? c.title}
        lede={c.lede}
        meta={date ? fill(t('siteUpdated'), { date }) : undefined}
        secondary={composer}
        visual={<AppPreview screen="composer" caption={c.heroCaption} />}
      />

      <PageCms slug="ai-assistant" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section>
        <SectionHead icon={Workflow} kicker={c.how.kicker} title={c.how.title} lede={c.how.lede} />
        <Steps items={c.how.steps.map((s, i) => ({ icon: STEP_ICONS[i], ...s }))} />
      </Section>

      <Section tone="surface">
        <Split
          icon={Search}
          kicker={c.research.kicker}
          title={c.research.title}
          body={c.research.body}
          points={c.research.points}
          visual={<AppPreview screen="ai-writer" caption={c.research.caption} />}
        />
      </Section>

      <Section>
        <SectionHead icon={Wand2} kicker={c.writing.kicker} title={c.writing.title} lede={c.writing.lede} />
        <IconGrid items={c.writing.items.map((it, i) => ({ icon: WRITING_ICONS[i], ...it }))} />
      </Section>

      <FaqList items={c.faq} />

    </>
  );
}
