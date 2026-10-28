import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, CalendarDays, CheckCheck, FileInput, LayoutTemplate, MessagesSquare, PenLine, Sparkles } from 'lucide-react';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import type { DocsPage, DocsSection } from '@/lib/docs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app').replace(/\/+$/, '');

/** Connect → write → schedule, the path the starter guides walk through. */
const STEPS = [
  { n: '01', title: 'Connect your channels', body: 'Link each account once from Channels: a sign-in for most networks, a key or bot token for the rest.', slug: 'connecting-accounts', hash: '' },
  { n: '02', title: 'Write once', body: 'Pick the channels, add text, photos or a video, and check the preview for each network.', slug: 'scheduling-posts', hash: '#write-a-post' },
  { n: '03', title: 'Schedule or post now', body: 'Choose a time in your own time zone. Sosial publishes it and tells you if a network says no.', slug: 'scheduling-posts', hash: '#pick-a-time' },
];

/** What the workspace does. Links go to a docs page when one exists,
 *  otherwise to the feature page on sosial.app. */
const FEATURES: { icon: typeof PenLine; title: string; body: string; slug?: string; hash?: string; site?: string }[] = [
  { icon: PenLine, title: 'Composer', body: 'One post for every channel, with media, per-network previews and character counts as you type.', slug: 'scheduling-posts', hash: '#write-a-post' },
  { icon: CalendarDays, title: 'Calendar and queue', body: 'Every scheduled and published post by day, week or month, and the queue in posting order.', slug: 'scheduling-posts', hash: '#see-what-s-planned' },
  { icon: Sparkles, title: 'AI Assistant', body: 'Research-backed drafts and ideas in 100+ languages, written for each channel.', site: '/ai-assistant' },
  { icon: CheckCheck, title: 'Approvals and roles', body: 'Members send posts for review, owners approve in one tap, and each person sees only their channels.', site: '/features' },
  { icon: MessagesSquare, title: 'Community inbox', body: 'Comments and messages from your channels in one place, answered without opening each app.', site: '/features' },
  { icon: BarChart3, title: 'Analytics', body: 'Followers, engagement and the best time to post, across every connected account.', site: '/features' },
  { icon: LayoutTemplate, title: 'Templates and design studio', body: 'Card templates and a design studio for post images, in your own style.', site: '/features/create' },
  { icon: FileInput, title: 'Import', body: 'Bring a content plan in from Notion or Google Sheets and schedule it in one go.', site: '/features' },
];

const API_CURL = `curl -X POST https://sosial.app/api/v1/posts \\
  -H "Authorization: Bearer sos_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Hello", "channels": ["instagram", "x"]}'`;

function Band({ children, tone = 'paper' }: { children: ReactNode; tone?: 'paper' | 'surface' }) {
  return (
    <section className={`border-t border-line ${tone === 'surface' ? 'bg-surface' : 'bg-paper'}`}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-10">{children}</div>
    </section>
  );
}

function BandHead({ kicker, title, note }: { kicker: string; title: string; note?: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:gap-16">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-ink/70 dark:text-bolt">
          <span className="h-1.5 w-1.5 rounded-full bg-bolt" aria-hidden="true" />
          {kicker}
        </p>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {note ? <p className="max-w-md text-[15px] leading-relaxed text-ink/65">{note}</p> : null}
    </div>
  );
}

/** A docs page link when the page is published, else a sosial.app link. */
function Target({ href, external, children, className }: { href: string; external: boolean; children: ReactNode; className: string }) {
  return external ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** docs.sosial.app landing, built around how Sosial is used: the three-step
 *  path, the workspace's features, its channels, automation, and every guide.
 *  Links point only at published pages. */
export default function DocsHome({ sections, pages }: { sections: DocsSection[]; pages: DocsPage[] }) {
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const has = (slug?: string) => !!slug && bySlug.has(slug);
  const dev = sections.find((s) => s.slug === 'developers');
  const appPages = pages.filter((p) => p.sectionId !== dev?.id);
  const first = bySlug.get('introduction') ?? appPages[0] ?? pages[0];

  const steps = STEPS.filter((s) => has(s.slug));
  const apiPage = bySlug.get('api');
  const mcpPage = bySlug.get('mcp');
  const groups = sections
    .map((s) => ({ section: s, pages: pages.filter((p) => p.sectionId === s.id) }))
    .filter((g) => g.pages.length);

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-bolt), transparent 65%)' }}
        />
        <div className="relative mx-auto w-full max-w-[1200px] px-4 pb-16 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-10">
          <h1 className="max-w-4xl font-display text-[2.1rem] font-medium leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.12] lg:text-[3.6rem]">
            Everything you need to post everywhere with Sosial.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink/65">
            Guides for connecting channels, writing once and scheduling everywhere, plus the REST API and MCP server for
            automating it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {first ? (
              <Link href={`/${first.slug}`} className="btn btn-bolt !px-5 !py-2.5">
                Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
            <a href={`${SITE}/login`} className="rounded-xl border border-line px-5 py-2.5 text-[15px] font-medium hover:bg-surface">
              Open Sosial
            </a>
          </div>
          <p className="mt-8 text-sm text-ink/50">
            Press <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs">Ctrl K</kbd> to search every page.
          </p>
        </div>
      </section>

      {/* Three steps */}
      {steps.length ? (
        <Band tone="surface">
          <BandHead
            kicker="First post in three steps"
            title="Connect, write once, and let Sosial publish it."
            note="The same three steps work on the web and in the mobile app, on one account and one calendar."
          />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n}>
                <Link
                  href={`/${s.slug}${s.hash}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-paper p-6 transition hover:border-bolt"
                >
                  <span className="font-display text-sm font-medium text-ink/50 dark:text-bolt">{s.n}</span>
                  <span className="mt-6 font-display text-xl font-medium">{s.title}</span>
                  <span className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/65">{s.body}</span>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium">
                    Read the guide
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Band>
      ) : null}

      {/* Features */}
      <Band>
        <BandHead
          kicker="One workspace"
          title="Everything a daily poster needs, in one place."
          note="Compose, queue, write with AI and approve without bolting anything on. Each card opens its guide or feature page."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const docs = has(f.slug);
            const href = docs ? `/${f.slug}${f.hash ?? ''}` : `${SITE}${f.site ?? '/features'}`;
            const Icon = f.icon;
            return (
              <Target key={f.title} href={href} external={!docs} className="group flex flex-col bg-paper p-6 transition hover:bg-surface">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-ink transition group-hover:bg-bolt group-hover:text-on-accent dark:text-bolt">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-5 font-medium">{f.title}</span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-ink/65">{f.body}</span>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-ink/55 group-hover:text-ink">
                  {docs ? 'Guide' : 'On sosial.app'}
                  {docs ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
              </Target>
            );
          })}
        </div>
      </Band>

      {/* Channels */}
      <Band tone="surface">
        <BandHead
          kicker="Channels"
          title={`${CHANNEL_GUIDES.length} channels, one composer.`}
          note="Social networks, messaging and blogs. The composer checks each post against every channel's limits before it goes out."
        />
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CHANNEL_GUIDES.map((c) => (
            <li key={c.key}>
              <Target
                href={has(c.key) ? `/${c.key}` : `${SITE}/integrations/${c.key}`}
                external={!has(c.key)}
                className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-paper p-4 transition hover:border-bolt"
              >
                {/* Ring: black-disc brands (X, TikTok, Threads, Dev.to, Ghost) vanish on black. */}
                <BrandIcon provider={c.key as BrandProvider} className="h-8 w-8 rounded-full dark:ring-1 dark:ring-white/25" />
                <span>
                  <span className="block text-sm font-medium">{c.name}</span>
                  <span className="mt-0.5 block text-xs text-ink/55">{c.facts[0]?.value}</span>
                </span>
              </Target>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-6">
          {has('channels') ? (
            <Link href="/channels" className="group inline-flex items-center gap-1.5 text-sm font-medium hover:underline underline-offset-4">
              Limits for every channel <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : null}
          {has('connecting-accounts') ? (
            <Link href="/connecting-accounts" className="group inline-flex items-center gap-1.5 text-sm font-medium hover:underline underline-offset-4">
              How to connect them <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </Band>

      {/* Automate */}
      {apiPage || mcpPage ? (
        <Band>
          <BandHead
            kicker="Automate"
            title="Post from your own tools, or hand it to an AI agent."
            note="API posts use the same queue, limits and plan as the app, so nothing behaves differently."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            {apiPage ? (
              <Link href={`/${apiPage.slug}`} className="group flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-6 transition hover:border-bolt">
                <span className="font-display text-xl font-medium">REST API</span>
                <span className="mt-2 text-[15px] leading-relaxed text-ink/65">One POST schedules to every connected channel.</span>
                <span className="docs-code mt-5 block">
                  <pre>
                    <code>{API_CURL}</code>
                  </pre>
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                  API reference <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ) : null}
            {apiPage ? (
              <Link href={`/${apiPage.slug}#zapier`} className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:border-bolt">
                <span className="font-display text-xl font-medium">Zapier and Make</span>
                <span className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/65">
                  Post from any trigger with a webhook step, and poll published posts to start your next automation. Retries
                  never post twice.
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                  Automation guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ) : null}
            {mcpPage ? (
              <Link href={`/${mcpPage.slug}`} className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:border-bolt">
                <span className="font-display text-xl font-medium">MCP server</span>
                <span className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/65">
                  Claude, Cursor and other MCP clients draft and schedule posts with scoped keys, and ask you before anything
                  goes public.
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                  MCP guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ) : null}
          </div>
        </Band>
      ) : null}

      {/* Every guide, by section */}
      {groups.length ? (
        <Band tone="surface">
          <BandHead kicker="Browse" title="Every guide, by section." />
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <div key={g.section.id}>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink/50">{g.section.title}</p>
                <ul className="mt-3 border-t border-line">
                  {g.pages.map((p) => (
                    <li key={p.id} className="border-b border-line">
                      <Link href={`/${p.slug}`} className="group flex items-center justify-between gap-3 py-3 text-[15px]">
                        <span className="font-medium">{p.title}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink/40 transition group-hover:translate-x-0.5 group-hover:text-bolt" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Help */}
      <Band>
        <div className="flex flex-col gap-8 rounded-3xl border border-line bg-surface p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">Can&apos;t find it?</h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink/65">
              Email <a href="mailto:support@sosial.app" className="font-medium text-ink underline decoration-bolt decoration-2 underline-offset-4">support@sosial.app</a>{' '}
              with what you were trying to do, or check the{' '}
              <a href="https://status.sosial.app/status/sosial" className="font-medium text-ink underline decoration-bolt decoration-2 underline-offset-4">
                status page
              </a>{' '}
              if posts aren&apos;t going out.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <a href={`${SITE}/login`} className="btn btn-bolt !px-5 !py-2.5">
              Start free
            </a>
            <a href={`${SITE}/pricing`} className="rounded-xl border border-line px-5 py-2.5 text-[15px] font-medium hover:bg-paper">
              See pricing
            </a>
          </div>
        </div>
      </Band>
    </div>
  );
}
