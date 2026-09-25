import type { Metadata } from 'next';
import { WriterPreview } from '@/components/landing/Preview';
import { CtaBand, FaqList, FeatureBlocks, PageHero } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'AI Assistant',
  description:
    'Research-backed social copy in 100+ languages. Live sources, styles with samples, substantial threads, rewrites and per-channel adaptation. You approve everything.',
  alternates: { canonical: '/ai-assistant' },
};

export default function AiAssistantPage() {
  return (
    <>
      <PageHero
        eyebrow="AI Assistant"
        title="A writer that checks its facts."
        lede="Rough thought in, post-ready caption out. Grounded by live research with linked sources, written in your style, in 100+ languages. Nothing publishes without you."
        secondary={{ href: '/features/create', label: 'See the composer' }}
        visual={
          <div className="card p-3 md:p-4">
            <WriterPreview />
          </div>
        }
      />

      <PageCms slug="ai-assistant" className="mx-auto max-w-3xl px-4 py-12 md:py-16" />

      <FeatureBlocks
        items={[
          {
            eyebrow: 'Research',
            title: 'Grounded, not guessed.',
            body: 'Turn on research and the writer searches the live web before drafting, then hands you the copy alongside the sources it used and flags anything uncertain. News-driven posts finally have receipts.',
            points: [
              'Live web research before drafting',
              'Sources returned with every draft',
              'Uncertainties flagged instead of smoothed over',
            ],
          },
          {
            eyebrow: 'Languages',
            title: 'Your language first.',
            body: 'Language comes before everything else in the writer. Pick from 100+ and the draft mirrors your idea natively, from English and Melayu to Tamil and beyond. No English-first awkwardness.',
          },
          {
            eyebrow: 'Styles & threads',
            title: 'Sound like you on a good day.',
            body: 'Pick a style card: breaking news, threads, teardowns, each with a live sample of what it produces. Long ideas become substantial multi-post threads, split for readability, never padded for length.',
            points: [
              'Style cards with real output samples',
              'Threads split where a reader would pause',
              'Per-post images, topical or AI-generated',
            ],
          },
          {
            eyebrow: 'Rewrite',
            title: 'Second drafts on demand.',
            body: 'Paste anything (a rough note, a published post, a competitor you admire structurally) and get a rewrite in your voice, adapted per channel with limits respected. Your drafts stay yours; the assistant just sharpens them.',
          },
        ]}
      />

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

      <CtaBand
        title="Bring a rough thought."
        body="Leave with a week of post-ready copy."
        secondary={{ href: '/publish', label: 'See publishing' }}
      />
    </>
  );
}
