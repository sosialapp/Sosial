import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { Activity, CalendarDays, ListChecks, PauseCircle, PencilLine, Ruler, Send, ShieldCheck } from 'lucide-react';
import { FaqList } from '@/components/site/PageBlocks';
import { Hero, IconGrid, Section, SectionHead, Split, Stats } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { publishCopy } from '@/content/pages/publish';
import { fill } from '@/lib/i18n/locales';
import { getLocale, siteI18n } from '@/lib/i18n/server';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = publishCopy[locale];
  // CMS overrides are written in English; other locales keep the translations.
  const cms = locale === 'en' ? await sitePageMeta('publish') : null;
  return seo({
    path: '/publish',
    locale,
    title: cms?.metaTitle ?? c.metaTitle,
    description: cms?.metaDescription ?? c.metaDesc,
    kicker: c.kicker,
    cardTitle: cms?.title ?? c.title,
  });
}

const CONTROL_ICONS = [Ruler, PencilLine, PauseCircle, Activity];

export default async function PublishPage() {
  const { locale, t, href } = await siteI18n();
  const c = publishCopy[locale];
  const meta = await sitePageMeta('publish');
  const date = formatPageDate(meta?.publishedAt ?? null, locale);
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t('siteHome'), path: href('/') },
          { name: c.crumbFeatures, path: href('/features') },
          { name: c.kicker, path: href('/publish') },
        ]}
      />
      <Hero
        icon={Send}
        kicker={c.kicker}
        title={(locale === 'en' ? meta?.title : null) ?? c.title}
        lede={c.lede}
        meta={date ? fill(t('siteUpdated'), { date }) : undefined}
        secondary={{ href: href('/integrations'), label: c.seeChannels }}
        visual={<AppPreview screen="calendar-month" caption={c.heroCaption} />}
      />

      <PageCms slug="publish" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <Stats items={c.stats} />
      </Section>

      <Section>
        <Split
          icon={CalendarDays}
          kicker={c.calendar.kicker}
          title={c.calendar.title}
          body={c.calendar.body}
          points={c.calendar.points}
          visual={<AppPreview screen="calendar-list" caption={c.calendar.caption} />}
        />
      </Section>

      <Section tone="surface">
        <Split
          flip
          icon={ListChecks}
          kicker={c.queue.kicker}
          title={c.queue.title}
          body={c.queue.body}
          points={c.queue.points}
          visual={<AppPreview screen="week" caption={c.queue.caption} />}
        />
      </Section>

      <Section>
        <SectionHead icon={ShieldCheck} kicker={c.control.kicker} title={c.control.title} lede={c.control.lede} />
        <IconGrid items={c.control.items.map((it, i) => ({ icon: CONTROL_ICONS[i], ...it }))} cols={4} />
      </Section>

      <FaqList items={c.faq} />

    </>
  );
}
