import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { Camera, Copy, Eye, Image as ImageIcon, Layers, LayoutTemplate, PenLine, Ruler, Sparkles } from 'lucide-react';
import { FaqList } from '@/components/site/PageBlocks';
import { CtaCard, Hero, IconGrid, Section, SectionHead, Split } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('features/create');
  return seo({
    path: '/features/create',
    title: meta?.metaTitle ?? 'Social media post composer with live previews',
    description: meta?.metaDescription ?? 'Write one post for every network with per-channel previews, real character limits, templates, photos, video and AI cover images.',
    kicker: 'Create',
    cardTitle: meta?.title ?? 'Start from a blank page less.',
  });
}

export default async function CreatePage() {
  const meta = await sitePageMeta('features/create');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }, { name: 'Create', path: '/features/create' }]} />
      <Hero
        icon={PenLine}
        kicker="Create"
        title={meta?.title ?? 'Start from a blank page less.'}
        lede="One composer writes for every network at once, with live previews, honest character counts, reusable templates and media that fits everywhere."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/ai-assistant', label: 'Meet the AI writer' }}
        visual={<AppPreview screen="composer" caption="Create post: pick channels, write once, post now or schedule." />}
      />

      <PageCms slug="features/create" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section>
        <Split
          icon={Eye}
          kicker="Composer"
          title="Write once, preview everywhere."
          body="Pick your channels and the composer shows each one the way it will actually appear, with a live counter against its real limit. No surprises after you hit schedule."
          points={[
            'Per-channel preview cards before anything ships',
            'Live counters against true platform limits',
            'Over-long captions trim before scheduling, not after',
          ]}
          visual={<AppPreview screen="quick-post" caption="Quick post on the dashboard, for text that ships right now." />}
        />
      </Section>

      <Section tone="surface">
        <SectionHead
          icon={Layers}
          kicker="Everything in the composer"
          title="Templates, media and covers, without leaving the post."
          lede="The pieces you reach for every day sit inside the composer, so a post goes from idea to scheduled in one place."
        />
        <IconGrid
          items={[
            {
              icon: LayoutTemplate,
              title: 'Templates',
              body: 'Save any post as a template and reuse the structure next time. Your best formats become the starting point.',
            },
            {
              icon: Copy,
              title: 'Reuse what worked',
              body: 'Saved captions and full designs are there when you start the next post, so you never build the same one twice.',
            },
            {
              icon: ImageIcon,
              title: 'Photos and video',
              body: 'Attach up to four images or a video to any post. Each channel gets media in the shape it expects.',
            },
            {
              icon: Camera,
              title: 'Topical photos',
              body: 'Pull a real photo matched to your topic when the camera roll has nothing that fits.',
            },
            {
              icon: Sparkles,
              title: 'AI cover images',
              body: 'Describe the cover you want and generate it from a prompt, right beside the caption.',
            },
            {
              icon: Ruler,
              title: 'Honest counters',
              body: 'Every channel counts against its own real limit, and over-long captions trim before they ship.',
            },
          ]}
        />
      </Section>

      <FaqList
        items={[
          {
            q: 'Do I have to rewrite my caption for each channel?',
            a: 'No. You write once; the composer adapts with per-channel previews and counters, and trims where a limit demands it.',
          },
          {
            q: 'Which media types can I attach?',
            a: 'Up to four images or a video per post, plus topical photos and AI-generated covers. Each channel page lists exactly what its network accepts.',
          },
          {
            q: 'Can I edit a post after scheduling it?',
            a: 'Yes. Edit the caption, swap media or move the slot any time before it ships.',
          },
          {
            q: 'What templates are included?',
            a: 'Save any caption or full design as a template and reuse it any time. Your own saved templates from posts that performed are always there.',
          },
        ]}
      />

      <CtaCard
        title="One idea in. Every channel covered."
        body="Write the post once, check every preview, and schedule it to all your networks from the same screen."
        secondary={{ href: '/ai-assistant', label: 'Meet the AI writer' }}
      />
    </>
  );
}
