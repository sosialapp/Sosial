import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import {
  Accessibility, Briefcase, Check, Globe2, HeartHandshake, Languages, MonitorSmartphone, User, Users, UsersRound, Wallet,
} from 'lucide-react';
import Reveal from '@/components/anim/Reveal';
import { FaqList } from '@/components/site/PageBlocks';
import { CheckList, CtaCard, Hero, IconGrid, Section, SectionHead, Stats } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

import { madeForEveryoneCopy } from '@/content/pages/madeForEveryone';
import { fill } from '@/lib/i18n/locales';
import { getLocale, siteI18n } from '@/lib/i18n/server';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = madeForEveryoneCopy[locale];
  // CMS overrides are written in English; other locales keep the translations.
  const cms = locale === 'en' ? await sitePageMeta('made-for-everyone') : null;
  return seo({
    path: '/made-for-everyone',
    locale,
    title: cms?.metaTitle ?? c.metaTitle,
    description: cms?.metaDescription ?? c.metaDesc,
    kicker: c.kicker,
    cardTitle: cms?.title ?? c.title,
  });
}

const WHO = [
  { icon: User, href: '/features/create' },
  { icon: UsersRound, href: '/ai-assistant' },
  { icon: Briefcase, href: '/publish' },
];
const ACCESS_ICONS = [Languages, MonitorSmartphone, Accessibility, Wallet];

export default async function MadeForEveryonePage() {
  const { locale, t, href } = await siteI18n();
  const c = madeForEveryoneCopy[locale];
  const meta = await sitePageMeta('made-for-everyone');
  const date = formatPageDate(meta?.publishedAt ?? null, locale);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: t('siteHome'), path: href('/') }, { name: c.kicker, path: href('/made-for-everyone') }]} />
      <Hero
        icon={Globe2}
        kicker={c.kicker}
        title={(locale === 'en' ? meta?.title : null) ?? c.title}
        lede={c.lede}
        meta={date ? fill(t('siteUpdated'), { date }) : undefined}
        secondary={{ href: href('/pricing'), label: t('siteSeePricing') }}
      />

      <PageCms slug="made-for-everyone" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section flush>
        <Stats items={c.stats} />
      </Section>

      <Section>
        <SectionHead icon={Users} kicker={c.who.kicker} title={c.who.title} lede={c.who.lede} />
        <IconGrid items={c.who.items.map((it, i) => ({ icon: WHO[i].icon, href: href(WHO[i].href), ...it }))} />
      </Section>

      <Section tone="surface">
        <SectionHead icon={HeartHandshake} kicker={c.access.kicker} title={c.access.title} lede={c.access.lede} />
        <IconGrid cols={2} items={c.access.items.map((it, i) => ({ icon: ACCESS_ICONS[i], ...it }))} />
      </Section>

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHead icon={Check} kicker={c.basics.kicker} title={c.basics.title} />
          <Reveal>
            <div className="rounded-[24px] border border-line bg-surface p-7 sm:p-9">
              <CheckList items={c.basics.items} />
            </div>
          </Reveal>
        </div>
      </Section>

      <FaqList items={c.faq} />

      <CtaCard title={c.ctaTitle} body={c.ctaBody} />
    </>
  );
}
