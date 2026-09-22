import Link from 'next/link';
import type { ReactNode } from 'react';
import Reveal from '@/components/anim/Reveal';
import Tilt from '@/components/anim/Tilt';
import { BrandIcon } from '@/components/BrandIcon';
import ChannelComposer from '@/components/landing/ChannelComposer';
import { ApprovalPreview, ComposerPreview } from '@/components/landing/Preview';
import Hero from '@/components/landing/Hero';
import { AiWriter, Faq, Pricing } from '@/components/landing/Sections';
import { CHANNEL_GUIDES } from '@/content/channels';
import { allArticles } from '@/content/blog';
import { RESOURCES } from '@/content/resources';
import { formatPostDate, resourceHref } from '@/content/types';

/** Re-render daily so the illustrative calendar always shows the current month. */
export const revalidate = 86400;

function Shell({
  id,
  children,
  band = false,
}: {
  id?: string;
  children: ReactNode;
  band?: boolean;
}) {
  return (
    <section id={id} className={`scroll-mt-20 ${band ? 'border-y border-line bg-card/60' : ''}`}>
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:py-24">{children}</div>
    </section>
  );
}



function ChannelPlayground() {
  return (
    <section id="channels" className="scroll-mt-20 border-y border-line bg-card/60">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:py-24">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">One idea, every channel</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            The same thought, shaped for ten networks.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Type an idea and watch it lay itself out. The counter and the limit are the real
            platform numbers — the composer trims before you schedule, not after.
          </p>
        </Reveal>
        <div className="mt-10">
          <ChannelComposer />
        </div>
      </div>
    </section>
  );
}

const STEPS: { n: string; title: string; body: string; visual: ReactNode }[] = [
  {
    n: '1',
    title: 'Write it once',
    body: 'One caption, your photos or video, and the channels you picked. No retyping per network.',
    visual: <ComposerPreview />,
  },
  {
    n: '2',
    title: 'Drop it on the calendar',
    body: 'Drag posts between days. Drafts, the queue and approvals stay in sync everywhere.',
    visual: (
      <div className="card flex h-full min-h-[180px] flex-col justify-center gap-2 p-4" aria-hidden="true">
        {['Mon 9:00 · Launch teaser', 'Wed 18:00 · Roundup video', 'Fri 11:00 · Founder story'].map(
          (t) => (
            <div
              key={t}
              className="rounded-lg border border-line bg-paper px-2.5 py-2 text-xs font-semibold text-soft"
            >
              {t}
            </div>
          ),
        )}
      </div>
    ),
  },
  {
    n: '3',
    title: 'It publishes itself',
    body: 'The worker ships every channel inside a minute, even with the app closed.',
    visual: (
      <div className="card flex h-full min-h-[180px] flex-col justify-center gap-2 p-4" aria-hidden="true">
        {[
          ['Queued', 'bg-accent-soft text-accent-ink'],
          ['Publishing', 'bg-accent-soft text-accent-ink'],
          ['Sent', 'bg-[#EDF3EC] text-[#346538]'],
        ].map(([label, cls]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-2"
          >
            <span className="text-xs font-semibold text-soft">Launch teaser</span>
            <span className={`pill ${cls}`}>{label}</span>
          </div>
        ))}
      </div>
    ),
  },
];

function How() {
  return (
    <Shell id="how">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Three steps to published.
        </h2>
      </Reveal>
      <div className="mt-9 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <Tilt key={s.n} className="h-full">
            <article className="flex h-full flex-col gap-4">
              <div>{s.visual}</div>
              <div>
                <p className="font-display text-sm font-extrabold text-accent">{s.n}</p>
                <h3 className="mt-1 font-display text-xl font-extrabold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </article>
          </Tilt>
        ))}
      </div>
    </Shell>
  );
}

function Teams() {
  return (
    <section id="teams" className="scroll-mt-20 border-y border-line bg-card/60">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
        <Reveal>
          <p className="eyebrow">Teams</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Teammates draft. You approve.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">
            Members send posts for review instead of publishing. Approve in one tap or send a note
            back — and limit each person to the channels they actually run.
          </p>
        </Reveal>
        <div className="reveal mx-auto mt-9 max-w-xl text-left">
          <ApprovalPreview />
        </div>
      </div>
    </section>
  );
}

function IntegrationsTeaser() {
  return (
    <Shell id="integrations">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Reveal className="max-w-xl">
          <p className="eyebrow">Integrations</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Ten channels, one workspace.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Real API publishing to every network — with the limits, formats and etiquette of each
            one handled for you.
          </p>
        </Reveal>
        <Link href="/integrations" className="btn btn-ghost">
          Browse all integrations
        </Link>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNEL_GUIDES.map((c) => (
          <Tilt key={c.key} className="h-full">
            <Link href={`/integrations/${c.key}`} className="card flex h-full flex-col p-5 transition hover:border-accent">
              <span className="flex items-center gap-2.5">
                <BrandIcon provider={c.key} className="h-5 w-5 shrink-0" />
                <span className="font-display text-lg font-extrabold tracking-tight">{c.name}</span>
              </span>
              <span className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.tagline}</span>
              <span className="mt-4 text-xs font-bold text-faint">
                {c.limit.toLocaleString()}-character limit
              </span>
            </Link>
          </Tilt>
        ))}
      </div>
    </Shell>
  );
}

function FromTheBlog() {
  const posts = allArticles().slice(0, 3);
  return (
    <Shell id="blog" band>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Reveal className="max-w-xl">
          <p className="eyebrow">From the blog</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Practical guides, no fluff.
          </h2>
        </Reveal>
        <Link href="/blog" className="btn btn-ghost">
          Read the blog
        </Link>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3">
        {posts.map((a) => (
          <Link key={a.slug} href={`/blog/${a.slug}`} className="card flex h-full flex-col p-5 transition hover:border-accent">
            <span className="pill w-fit bg-accent-soft text-accent-ink">{a.tag}</span>
            <h3 className="mt-3 font-display text-lg font-extrabold leading-snug tracking-tight">
              {a.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.description}</p>
            <p className="mt-4 text-xs font-bold text-faint">
              {formatPostDate(a.date)} · {a.minutes} min read
            </p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

function ResourcesTeaser() {
  const items = RESOURCES.slice(0, 4);
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Reveal className="max-w-xl">
          <p className="eyebrow">Free resources</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Templates and playbooks to steal.
          </h2>
        </Reveal>
        <Link href="/resources" className="btn btn-ghost">
          Open the library
        </Link>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((r) => (
          <Link key={r.slug} href={resourceHref(r.slug)} className="card flex h-full flex-col p-5 transition hover:border-accent">
            <span className="pill w-fit bg-paper text-soft ring-1 ring-line">{r.kind}</span>
            <h3 className="mt-3 font-display text-base font-extrabold leading-snug tracking-tight">
              {r.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{r.description}</p>
            <p className="mt-4 text-xs font-bold text-faint">{r.minutes} min</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

function FinalCta() {
  return (
    <Shell>
      <div className="reveal rounded-3xl bg-accent px-6 py-14 text-center md:py-20">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Never miss a post again.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-white/85">
          One caption is all it takes to fill your week.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/login" className="btn bg-white font-bold text-accent hover:bg-bone">
            Start scheduling free
          </Link>
          <Link href="/integrations" className="btn border-white/40 text-white hover:bg-white/10">
            See every channel
          </Link>
        </div>
      </div>
    </Shell>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ChannelPlayground />
      <AiWriter />
      <How />
      <Teams />
      <IntegrationsTeaser />
      <Pricing />
      <Faq />
      <FromTheBlog />
      <ResourcesTeaser />
      <FinalCta />
    </>
  );
}
