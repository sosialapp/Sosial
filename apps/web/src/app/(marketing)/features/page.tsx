import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import Link from 'next/link';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import { featuresCopy } from '@/content/pages/features';
import { getLocale, siteI18n } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = featuresCopy[locale];
  return seo({
    path: '/features',
    locale,
    title: c.metaTitle,
    description: c.metaDesc,
    kicker: c.eyebrow,
    cardTitle: c.title,
  });
}

const SCREENS = ['week', 'composer', 'ai-writer'] as const;
const LINKS = ['/publish', '/features/create', '/ai-assistant', '/integrations', '/made-for-everyone', '/pricing'];

export default async function FeaturesPage() {
  const { locale, href } = await siteI18n();
  const c = featuresCopy[locale];
  return (
    <>
      <PageHero
        eyebrow={c.eyebrow}
        title={c.title}
        lede={c.lede}
        secondary={{ href: href('/integrations'), label: c.seeChannels }}
        visual={<AppPreview screen="calendar-month" caption={c.heroCaption} />}
      />

      <FeatureBlocks
        items={c.blocks.map((b, i) => ({
          eyebrow: b.eyebrow,
          title: b.title,
          body: b.body,
          points: b.points,
          visual: <AppPreview screen={SCREENS[i]} caption={b.caption} />,
        }))}
      />

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-10 px-4 py-14 md:grid-cols-3 md:py-20">
          {c.links.map((l, i) => (
            <Link key={LINKS[i]} href={href(LINKS[i])} className="group border-t border-line py-5">
              <span className="flex items-center justify-between gap-3 font-display text-lg font-extrabold tracking-tight">
                {l.title}
                <span aria-hidden="true" className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink">
                  →
                </span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{l.body}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
