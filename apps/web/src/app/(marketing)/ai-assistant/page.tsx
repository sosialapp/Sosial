import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import {
  CheckCircle2, Languages, Layers, Lightbulb, ListOrdered, Palette, PenLine, RefreshCw, Search, ShieldCheck, Sparkles, Wand2, Workflow,
} from 'lucide-react';
import { FaqList } from '@/components/site/PageBlocks';
import { CtaCard, Hero, IconGrid, Section, SectionHead, Split, Steps } from '@/components/site/Marketing';
import PageCms from '@/components/site/PageCms';
import AppPreview from '@/components/site/app-preview/AppPreview';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('ai-assistant');
  return seo({
    path: '/ai-assistant',
    title: meta?.metaTitle ?? 'AI social media post writer with live research',
    description: meta?.metaDescription ?? 'Draft captions and threads in 100+ languages, grounded by live web research with linked sources. Rewrites in your voice. Nothing publishes without you.',
    kicker: 'AI Assistant',
    cardTitle: meta?.title ?? 'A writer that checks its facts.',
  });
}

export default async function AiAssistantPage() {
  const meta = await sitePageMeta('ai-assistant');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }, { name: 'AI Assistant', path: '/ai-assistant' }]} />
      <Hero
        icon={Sparkles}
        kicker="AI Assistant"
        title={meta?.title ?? 'A writer that checks its facts.'}
        lede="Rough thought in, post-ready caption out. Grounded by live research with linked sources, written in your style, in 100+ languages. Nothing publishes without you."
        meta={date ? `Updated ${date}` : undefined}
        secondary={{ href: '/features/create', label: 'See the composer' }}
        visual={<AppPreview screen="composer" caption="The AI writer sits beside the composer: idea in, draft out, nothing posts without you." />}
      />

      <PageCms slug="ai-assistant" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <Section>
        <SectionHead
          icon={Workflow}
          kicker="How it works"
          title="From a rough idea to a post you approve."
          lede="The assistant drafts. You decide. Every step stays visible, and nothing reaches a network until you schedule it yourself."
        />
        <Steps
          items={[
            { icon: Lightbulb, title: 'Start with an idea', body: 'A sentence, a link or a messy note. Pick the language first, then the tone and style.' },
            { icon: Search, title: 'It researches', body: 'With research on, it reads the live web before writing and keeps the sources it used.' },
            { icon: PenLine, title: 'It drafts', body: 'A caption or a full thread, shaped for each channel you picked, with uncertain claims flagged.' },
            { icon: CheckCircle2, title: 'You approve', body: 'Edit anything, then schedule it. The assistant can draft, but it can never publish.' },
          ]}
        />
      </Section>

      <Section tone="surface">
        <Split
          icon={Search}
          kicker="Research"
          title="Grounded, not guessed."
          body="Turn on research and the writer searches the live web before drafting, then hands you the copy alongside the sources it used and flags anything uncertain. News-driven posts finally have receipts."
          points={[
            'Live web research before drafting',
            'Sources returned with every draft',
            'Uncertainties flagged instead of smoothed over',
          ]}
          visual={<AppPreview screen="ai-writer" caption="Language, tone, style, format and structure, all before you generate." />}
        />
      </Section>

      <Section>
        <SectionHead
          icon={Wand2}
          kicker="Writing"
          title="Sound like you on a good day."
          lede="Styles with real samples, threads that read naturally, and rewrites that keep your voice."
        />
        <IconGrid
          items={[
            {
              icon: Languages,
              title: 'Your language first',
              body: 'Pick from 100+ languages before anything is generated, so the draft is native, not translated from English.',
            },
            {
              icon: Palette,
              title: 'Style cards',
              body: 'Breaking news, threads, teardowns and more, each with a live sample of what it produces.',
            },
            {
              icon: ListOrdered,
              title: 'Real threads',
              body: 'Long ideas become multi-post threads, split where a reader would pause and never padded for length.',
            },
            {
              icon: RefreshCw,
              title: 'Rewrites on demand',
              body: 'Paste a rough note or a published post and get a second draft in your voice.',
            },
            {
              icon: Layers,
              title: 'Adapted per channel',
              body: 'Generate once, then adapt for each network with its limits and conventions respected.',
            },
            {
              icon: ShieldCheck,
              title: 'Never trained on you',
              body: 'Your briefs and drafts are not used to train AI models. They serve your workspace and nothing else.',
            },
          ]}
        />
      </Section>

      <FaqList
        items={[
          {
            q: 'Does the AI publish automatically?',
            a: 'Never. It drafts; you approve. Every word passes through you before it can be scheduled, let alone published.',
          },
          {
            q: 'Is my content used to train AI models?',
            a: 'No. Your briefs and drafts are not used to train models. See the privacy policy for the full statement.',
          },
          {
            q: 'Which languages are supported?',
            a: 'More than a hundred, chosen first before anything else is generated, so the draft is native, not translated.',
          },
          {
            q: 'What happens when facts are uncertain?',
            a: 'The writer says so: uncertainties are flagged and sources are linked, so you can verify before posting.',
          },
          {
            q: 'Can it adapt one idea to all ten channels?',
            a: 'Yes. Generate once, then adapt per channel with each network\u2019s limits and conventions respected.',
          },
        ]}
      />

      <CtaCard
        title="Your ideas, written up and fact-checked."
        body="Bring the rough thought. The assistant does the first draft and the research; you keep the final say on every word."
        secondary={{ href: '/features/create', label: 'See the composer' }}
      />
    </>
  );
}
