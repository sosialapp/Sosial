import Link from 'next/link';
import { WriterPreview } from './Preview';
import { StepMarker } from '@/components/ui';

/** Shared section shell: centered max width, forgiving vertical rhythm. */
function Shell({
  id,
  children,
  band = false,
}: {
  id?: string;
  children: React.ReactNode;
  band?: boolean;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 ${band ? 'border-y border-line bg-card/60' : ''}`}
    >
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:py-24">{children}</div>
    </section>
  );
}

export function AiWriter() {
  const points = [
    ['GPT-5.6 Luna engine', 'Live web research with linked sources on news topics.'],
    ['Styles with live samples', 'Breaking, threads, teardowns — every post substantial, never padded.'],
    ['100+ languages', 'Mirrors your idea, from English and Melayu to Tamil and beyond.'],
  ] as const;
  return (
    <Shell id="ai">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div className="reveal order-2 md:order-1">
          <WriterPreview />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            A writer that sounds like you.
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
            Rough thought in, post-ready caption out. Threads, research with sources, and 100+
            languages — adapted per channel.
          </p>
          <ul className="mt-6 space-y-4">
            {points.map(([title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dusk text-[11px] font-bold text-white"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span>
                  <span className="block text-[15px] font-bold text-ink">{title}</span>
                  <span className="block text-sm leading-relaxed text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Shell>
  );
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    per: 'free forever',
    cta: 'Start scheduling',
    featured: false,
    bullets: ['Up to 2 channels', 'Composer, calendar & queue', '1 seat'],
  },
  {
    name: 'Pro',
    price: '$5',
    per: 'per month, $48 yearly',
    cta: 'Start scheduling',
    featured: true,
    bullets: [
      'Everything in Free',
      'All ten channels, unlimited scheduled posts',
      'AI writer · 500 generations a month',
      'Approval workflow',
    ],
  },
  {
    name: 'Team',
    price: '$10',
    per: 'per month, $96 yearly',
    cta: 'Start scheduling',
    featured: false,
    bullets: [
      'Everything in Pro',
      'Unlimited seats, roles & approvals',
      'Per-channel member assignment',
      'AI writer · 1,000 generations a month',
    ],
  },
];

/** Every cell mirrors the plan cards above — no invented limits. */
const COMPARE_ROWS: { label: string; values: (string | boolean)[] }[] = [
  { label: 'Price', values: ['$0 forever', '$5/mo · $48/yr', '$10/mo · $96/yr'] },
  { label: 'Channels', values: ['Up to 2', 'All ten', 'All ten'] },
  { label: 'Scheduled posts', values: ['Included', 'Unlimited', 'Unlimited'] },
  { label: 'Seats', values: ['1', '1', 'Unlimited'] },
  { label: 'AI writer generations', values: [false, '500 / month', '1,000 / month'] },
  { label: 'Approval workflow', values: [false, true, true] },
  { label: 'Roles & per-channel assignment', values: [false, false, true] },
  { label: 'iOS & Android apps, same workspace', values: [true, true, true] },
];

export function Pricing() {
  return (
    <Shell id="pricing">
      <h2 className="mx-auto max-w-xl text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Flat pricing, no per-channel math.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-muted">
        Every plan schedules to all ten channels. Pay for volume, AI and seats — nothing else.
      </p>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <article
            key={p.name}
            className={`card flex flex-col p-6 ${
              p.featured ? 'border-2 border-bolt bg-paper shadow-[0_24px_60px_-30px_rgba(255,198,46,0.45)]' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-extrabold">{p.name}</p>
              {p.featured ? <span className="pill bg-bolt text-ink">Most popular</span> : null}
            </div>
            <p className="mt-2 font-display text-5xl font-extrabold tracking-tight">{p.price}</p>
            <p className="mt-1 text-sm text-muted">{p.per}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-soft">
                  <span className="mt-0.5 text-accent" aria-hidden="true">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className={`btn mt-6 w-full ${p.featured ? 'btn-bolt' : 'btn-ghost'}`}
            >
              {p.cta}
            </Link>
          </article>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-5xl overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">Plan comparison: Free, Pro and Team</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-4 text-left font-display text-xs uppercase tracking-widest text-faint">
                <span className="sr-only">Feature</span>
              </th>
              {['Free', 'Pro', 'Team'].map((n) => (
                <th key={n} scope="col" className="px-4 py-3 text-center font-display font-extrabold">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-line-soft last:border-0">
                <th scope="row" className="py-3 pr-4 text-left font-semibold text-soft">
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center text-soft">
                    {v === true ? (
                      <span className="text-ink" aria-label="Included" role="img">
                        ✓
                      </span>
                    ) : v === false ? (
                      <span className="text-faint" aria-label="Not included" role="img">
                        —
                      </span>
                    ) : (
                      v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mx-auto mt-5 max-w-lg text-center text-xs leading-relaxed text-faint">
        Prices in USD — yearly saves 20%. AI writing, threads and 100+ languages live in the iOS
        &amp; Android app, on the same workspace and calendar.
      </p>
    </Shell>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Which platforms can I publish to?',
    a: 'X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest — ten channels from one composer and one calendar.',
  },
  {
    q: 'How does publishing work?',
    a: 'Schedule a post and the cloud worker ships every channel inside a minute — even with the app closed. Per-channel results land in the queue.',
  },
  {
    q: 'Is there really a free plan?',
    a: 'Yes — free forever, with up to 2 channels, the composer, calendar and queue. No credit card, no trial clock.',
  },
  {
    q: 'How do teams and approvals work?',
    a: 'On the Team plan, members draft instead of publishing. Owners and admins approve in one tap or send a note back, and each member can be limited to specific channels.',
  },
  {
    q: 'What can the AI writer do?',
    a: 'It turns a rough thought into post-ready copy: styles with live samples, substantial threads, live research with sources, per-post images — in 100+ languages, adapted per channel.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Yes — the iOS and Android app shares your workspace and calendar with the web dashboard, so drafts and the queue follow you.',
  },
];

export function Faq() {
  return (
    <Shell id="faq">
      <h2 className="mx-auto max-w-xl text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Questions, answered.
      </h2>
      <div className="mx-auto mt-8 max-w-3xl">
        {FAQS.map((f) => (
          <details key={f.q} className="group border-t border-line py-4 last:border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-sm text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Shell>
  );
}
