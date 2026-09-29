import type { Metadata } from 'next';
import ChartIslands from '@/components/site/ChartIslands';
import Prose from '@/components/site/Prose';
import type { Block } from '@/content/types';
import { formatPageDate, sitePageHtml, sitePageMeta } from '@/lib/sitePages';

/** CMS edits go live within minutes. */
export const revalidate = 300;

const LEDE =
  'Sosial exists because publishing daily across every network had become a second job: ten tabs, five drafts, and an alarm for the 11pm post. We are a small team building the workspace we wanted ourselves.';

const SECTIONS: { title: string; blocks: Block[] }[] = [
  {
    title: 'The job is the writing, not the routing.',
    blocks: [
      {
        t: 'p',
        c: 'Social work is ideas, hooks and edits. The routing, the character counts and the midnight scheduling are overhead. Sosial takes the overhead: one composer with honest previews, one calendar, and a queue that ships while you sleep.',
      },
      {
        t: 'ul',
        c: [
          'Compose once, publish to all ten channels',
          'Approvals so nothing ships unreviewed',
          'A worker that publishes on time, app closed',
        ],
      },
    ],
  },
  {
    title: 'Small team, long horizon.',
    blocks: [
      {
        t: 'p',
        c: 'We ship in the open, publish our prices, and keep the free plan genuinely usable. No growth hacks in the composer, no selling your drafts, no dark patterns in billing. The product succeeds when daily posting stops feeling like a chore.',
      },
      {
        t: 'ul',
        c: [
          'Published pricing, plain-language policies',
          'Free plan with no expiry clock',
          'Features earn their place or they leave',
        ],
      },
    ],
  },
  {
    title: 'Deeper where it counts.',
    blocks: [
      {
        t: 'p',
        c: 'More channels when the networks earn them, smarter drafting that stays under your approval, and analytics that answer what to write next instead of flooding you with charts. The calendar and queue stay the centre of gravity.',
      },
    ],
  },
  {
    title: 'Operated by EGATE WORLDWIDE (KT0582667-V).',
    blocks: [
      {
        t: 'p',
        c: 'Sosial is built and run by EGATE WORLDWIDE (KT0582667-V), registered in Malaysia.',
      },
      {
        t: 'ul',
        c: [
          'Address: 30, Jalan BM 5/10 Seksyen 5, Bandar Bukit Mahkota Bangi, 43000 Kajang, Selangor, Malaysia',
          'Email: support@sosial.app',
          'Phone: +601111343000',
        ],
      },
    ],
  },
  {
    title: 'What we hold to.',
    blocks: [
      {
        t: 'ul',
        c: [
          '**Honest limits.** The character count you see is the platform’s real limit, enforced before scheduling, not discovered after publishing. [Read transparency](/transparency)',
          '**Human approval.** AI drafts, teammates review, you decide. Nothing reaches a network without a person pressing the button. [Meet the writer](/ai-assistant)',
          '**Fair access.** A free plan without a trial date, 100+ languages from the first draft, and the same app on every device. [Made for everyone](/made-for-everyone)',
        ],
      },
    ],
  },
  {
    title: 'Questions, answered.',
    blocks: [
      {
        t: 'p',
        c: '**What is Sosial, in one sentence?** One workspace where a team composes, approves and schedules posts for ten social networks, and a cloud queue publishes them on time.',
      },
      {
        t: 'p',
        c: '**Who is it built for?** Solo creators, in-house teams and agencies. Anyone whose week includes more than one network and more than zero deadlines.',
      },
      {
        t: 'p',
        c: '**Which channels are supported?** Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon and Pinterest, each with its own guide and real limits.',
      },
      {
        t: 'p',
        c: '**How do I get in touch?** Email support@sosial.app — help, billing, feedback, anything. Support inside the app reaches the same team. Security and privacy matters are documented under [Transparency](/transparency) and [Privacy](/privacy).',
      },
    ],
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('about');
  return {
    title: meta?.metaTitle ?? meta?.title ?? 'About',
    description:
      meta?.metaDescription ??
      'Sosial is a small team building one calendar for ten social networks: compose once, approve as a team, and let a cloud queue ship every channel on time.',
    alternates: { canonical: '/about' },
  };
}

/** Terms-style text article: CMS body replaces the sections when set. */
export default async function AboutPage() {
  const meta = await sitePageMeta('about');
  const cmsHtml = await sitePageHtml('about');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="eyebrow">About</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
        {meta?.title ?? 'One calendar for ten networks.'}
      </h1>
      {date ? <p className="mt-3 text-sm font-bold text-faint">Updated {date}</p> : null}
      <p className="mt-5 text-lg leading-relaxed text-muted">{meta?.metaDescription ?? LEDE}</p>

      <hr className="my-10 border-line" />

      {cmsHtml ? (
        <>
          <div className="prose-sosial blog-rich" dangerouslySetInnerHTML={{ __html: cmsHtml }} />
          <ChartIslands />
        </>
      ) : (
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-xl font-extrabold tracking-tight">{s.title}</h2>
              <Prose blocks={s.blocks} className="mt-3" />
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
