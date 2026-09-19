import Link from 'next/link';
import type { ReactNode } from 'react';
import { PROVIDER_META } from '@/lib/providers';
import { ApprovalPreview, CalendarPreview, ComposerPreview } from '@/components/landing/Preview';

/** Re-render daily so the illustrative calendar always shows the current month. */
export const revalidate = 86400;

const CHANNELS = Object.entries(PROVIDER_META);

function LogoMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-lg font-extrabold text-white">
      S
    </span>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bone/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-lg font-extrabold tracking-tight">Sosial</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-semibold text-soft md:flex">
          <a href="#product" className="hover:text-ink">
            Product
          </a>
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#teams" className="hover:text-ink">
            For teams
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/login" className="btn btn-primary">
            Start scheduling
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center md:pt-20">
      <Link
        href="#teams"
        className="pill bg-card text-soft ring-1 ring-line transition hover:bg-paper"
      >
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />
        New: team approvals
      </Link>
      <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold leading-none tracking-tight md:text-6xl">
        Every channel. One calendar.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
        Write once, schedule everywhere. Sosial publishes to ten channels while you get on with
        your day.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Link href="/login" className="btn btn-primary">
          Start scheduling
        </Link>
        <a href="#how" className="btn btn-ghost">
          See how it works
        </a>
      </div>
    </section>
  );
}

function LogoWall() {
  return (
    <section className="border-y border-line bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
          Publishes to ten channels
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {CHANNELS.map(([key, meta]) => (
            <li key={key} className="flex items-center gap-2" title={meta.label}>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ background: meta.color }}
                aria-hidden="true"
              >
                {meta.glyph}
              </span>
              <span className="text-sm font-semibold text-soft">{meta.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_60px_-30px_rgba(28,25,23,0.35)]">
      <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-full bg-line" />
          <i className="h-2.5 w-2.5 rounded-full bg-line" />
          <i className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span className="mx-auto w-full max-w-xs truncate rounded-full bg-bone px-3 py-1 text-center text-xs text-muted">
          {url}
        </span>
        <span className="w-10" aria-hidden="true" />
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}

function Product() {
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-24">
      <h2 className="mx-auto max-w-xl text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        See the whole month at a glance.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-muted">
        Drag any post to a new day. Times stay put, and the queue follows.
      </p>
      <div className="mx-auto mt-8 max-w-5xl">
        <BrowserFrame url="sosial.app/calendar">
          <CalendarPreview />
        </BrowserFrame>
      </div>
    </section>
  );
}

const STATS: { value: string; label: string }[] = [
  { value: '10', label: 'channels you can publish to' },
  { value: '1', label: 'shared calendar for the team' },
  { value: '60', label: 'seconds from queue to published' },
  { value: '3', label: 'ways to ship: draft, schedule, now' },
];

function Stats() {
  return (
    <section className="border-y border-line bg-card/60">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <dt className="order-2 mt-1 block text-sm text-muted">{s.label}</dt>
            <dd className="order-1 font-display text-5xl font-extrabold tracking-tight text-ink">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const STEPS: { n: string; title: string; body: string; visual: ReactNode }[] = [
  {
    n: '1',
    title: 'Write it once',
    body: 'One caption, your photos or video, and the channels. No retyping per network.',
    visual: <ComposerPreview />,
  },
  {
    n: '2',
    title: 'Drop it on the calendar',
    body: 'Drag posts between days. Drafts, the queue and approvals stay in sync.',
    visual: (
      <div className="card flex h-full min-h-[180px] flex-col justify-center gap-2 p-4" aria-hidden="true">
        {['Mon 9:00 Launch teaser', 'Wed 18:00 Roundup video', 'Fri 11:00 Founder story'].map(
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
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-24">
      <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Three steps to published.
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <article key={s.n} className="flex flex-col gap-4">
            <div>{s.visual}</div>
            <div>
              <p className="font-display text-sm font-extrabold text-accent">{s.n}</p>
              <h3 className="mt-1 font-display text-xl font-extrabold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Teams() {
  return (
    <section id="teams" className="border-y border-line bg-card/60 scroll-mt-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Teammates draft. You approve.
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
            Members send posts for review instead of publishing. Approve in one tap or send a
            note back. Nothing goes out before you say so.
          </p>
          <Link
            href="/queue"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline"
          >
            See it in the queue <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ApprovalPreview />
      </div>
    </section>
  );
}

function Bento() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-24">
      <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        One workspace, every surface.
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/composer"
          className="card group p-5 transition hover:bg-paper md:col-span-2"
        >
          <p className="font-display text-lg font-extrabold">Composer</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Caption, media and channels in one place. Save a draft, schedule it, or send it now.
          </p>
          <div className="mt-4 rounded-xl bg-bone p-3" aria-hidden="true">
            <div className="h-2.5 w-2/5 rounded-full bg-line" />
            <div className="mt-2 h-2.5 w-11/12 rounded-full bg-line-soft" />
            <div className="mt-2 h-2.5 w-3/5 rounded-full bg-line-soft" />
            <span className="btn btn-primary mt-3 text-xs">Schedule</span>
          </div>
        </Link>
        <Link href="/calendar" className="card group bg-surface p-5 transition hover:bg-paper">
          <p className="font-display text-lg font-extrabold">Calendar</p>
          <p className="mt-1 text-sm text-muted">The month, with every post on it.</p>
          <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">
            {Array.from({ length: 21 }).map((_, i) => (
              <span
                key={i}
                className={`h-6 rounded-md ${[3, 8, 9, 15].includes(i) ? 'bg-accent' : 'bg-paper'}`}
              />
            ))}
          </div>
        </Link>
        <Link href="/queue" className="card group bg-paper p-5 transition hover:bg-card">
          <p className="font-display text-lg font-extrabold">Queue</p>
          <p className="mt-1 text-sm text-muted">Publish now, retry failures, prune drafts.</p>
          <div className="mt-4 space-y-1.5" aria-hidden="true">
            {[
              ['Queued', 'bg-accent-soft text-accent-ink'],
              ['Needs approval', 'bg-accent-soft text-accent-ink'],
              ['Sent', 'bg-[#EDF3EC] text-[#346538]'],
            ].map(([label, cls]) => (
              <span key={label} className={`pill ${cls}`}>
                {label}
              </span>
            ))}
          </div>
        </Link>
        <Link
          href="/channels"
          className="card group bg-accent-soft p-5 transition hover:bg-paper md:col-span-2"
        >
          <p className="font-display text-lg font-extrabold">Channels</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Ten networks, one connection screen. Expired tokens flag themselves.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
            {CHANNELS.slice(0, 6).map(([key, meta]) => (
              <span key={key} className="pill bg-paper text-soft ring-1 ring-line">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full"
                  style={{ background: meta.color }}
                />
                {meta.label}
              </span>
            ))}
          </div>
        </Link>
      </div>
    </section>
  );
}

const CHECKLIST = [
  'Drag posts between days, times stay put',
  'Drafts, queue, approvals and sent in one list',
  'Members draft, owners approve, nothing slips out',
  'Photos and video ride along on every post',
  'Publishing runs while the app is closed',
  'Channel connections stay fresh on their own',
];

function Checklist() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
      <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Everything you need to post every day.
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
        {CHECKLIST.map((item) => (
          <li key={item} className="flex items-start gap-3 border-t border-line pt-4">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white"
              aria-hidden="true"
            >
              ✓
            </span>
            <span className="text-[15px] font-medium text-soft">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
      <div className="rounded-3xl bg-accent px-6 py-14 text-center md:py-20">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Never miss a post again.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-white/85">
          One caption is all it takes to fill your week.
        </p>
        <Link
          href="/login"
          className="btn mt-7 bg-white font-bold text-accent hover:bg-bone"
        >
          Start scheduling
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-card/60">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <span className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-lg font-extrabold tracking-tight">Sosial</span>
          </span>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Compose, schedule and publish across every channel.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">Product</p>
          <ul className="mt-3 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/calendar" className="hover:text-ink">
                Calendar
              </Link>
            </li>
            <li>
              <Link href="/composer" className="hover:text-ink">
                Composer
              </Link>
            </li>
            <li>
              <Link href="/queue" className="hover:text-ink">
                Queue
              </Link>
            </li>
            <li>
              <Link href="/channels" className="hover:text-ink">
                Channels
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">Account</p>
          <ul className="mt-3 space-y-2.5 text-sm font-semibold text-soft">
            <li>
              <Link href="/login" className="hover:text-ink">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-ink">
                Start scheduling
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-faint">© 2026 Sosial</p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Hero />
        <LogoWall />
        <Product />
        <Stats />
        <How />
        <Teams />
        <Bento />
        <Checklist />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
