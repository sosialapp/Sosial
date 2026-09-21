import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PROVIDER_META } from '@/lib/providers';
import { ApprovalPreview, CalendarPreview, ComposerPreview } from '@/components/landing/Preview';
import { AiWriter, Faq, Pricing } from '@/components/landing/Sections';

/** Re-render daily so the illustrative calendar always shows the current month. */
export const revalidate = 86400;

const CHANNELS = Object.entries(PROVIDER_META);

function LogoMark() {
  return (
    <Image
      src="/bolt.png"
      alt="Sosial"
      width={26}
      height={26}
      className="h-7 w-7 object-contain"
      priority
    />
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
          <a href="#ai" className="hover:text-ink">
            AI writer
          </a>
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#pricing" className="hover:text-ink">
            Pricing
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
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 md:pt-16">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div>
          <Link
            href="#teams"
            className="pill animate-rise bg-card text-soft ring-1 ring-line transition hover:bg-paper"
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />
            New: team approvals
          </Link>
          <h1 className="animate-rise-1 mt-5 font-display text-4xl font-extrabold leading-none tracking-tight md:text-6xl">
            Every channel. One calendar.
          </h1>
          <p className="animate-rise-1 mt-4 max-w-md text-base leading-relaxed text-muted">
            Write once, schedule everywhere. Ten channels, one shared calendar, publishing that
            runs itself.
          </p>
          <div className="animate-rise-2 mt-6 flex flex-wrap items-center gap-2.5">
            <Link href="/login" className="btn btn-primary">
              Start scheduling
            </Link>
            <a href="#how" className="btn btn-ghost">
              See how it works
            </a>
          </div>
        </div>
        <div className="animate-rise-2">
          <BrowserFrame url="sosial.app/calendar">
            <CalendarPreview />
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}

function LogoWall() {
  return (
    <section className="reveal border-y border-line bg-card/60">
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
      <h2 className="reveal font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Three steps to published.
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <article key={s.n} className="reveal flex flex-col gap-4">
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
    <section id="teams" className="scroll-mt-20 border-y border-line bg-card/60">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
        <h2 className="reveal font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Teammates draft. You approve.
        </h2>
        <p className="reveal mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">
          Members send posts for review instead of publishing. Approve in one tap or send a note
          back. Nothing goes out before you say so.
        </p>
        <Link
          href="/queue"
          className="reveal mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline"
        >
          See it in the queue <span aria-hidden="true">→</span>
        </Link>
        <div className="reveal mx-auto mt-8 max-w-xl text-left">
          <ApprovalPreview />
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
      <div className="reveal rounded-3xl bg-accent px-6 py-14 text-center md:py-20">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Never miss a post again.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-white/85">
          One caption is all it takes to fill your week.
        </p>
        <Link href="/login" className="btn mt-7 bg-white font-bold text-accent hover:bg-bone">
          Start scheduling
        </Link>
      </div>
    </section>
  );
}

const FOOT_CHANNELS = ['instagram', 'tiktok', 'x', 'threads', 'youtube', 'linkedin'] as const;

function Footer() {
  return (
    <footer className="border-t border-line bg-card/60">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
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
        <nav aria-label="Channels">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">Channels</p>
          <ul className="mt-3 space-y-2.5 text-sm font-semibold text-soft">
            {FOOT_CHANNELS.map((c) => (
              <li key={c}>
                <Link href="/channels" className="hover:text-ink">
                  {PROVIDER_META[c].label}
                </Link>
              </li>
            ))}
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
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-faint">
          © 2026 Sosial · Terms of Use &amp; Privacy Policy live inside the app.
        </p>
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
        <AiWriter />
        <How />
        <Teams />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
