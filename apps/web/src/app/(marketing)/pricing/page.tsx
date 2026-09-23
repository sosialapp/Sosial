import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBand, FaqList, PageHero } from '@/components/site/PageBlocks';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'A free plan that stays free, Pro for unlimited publishing across all ten channels, and Team for approvals. No per-channel fees, cancel any time.',
  alternates: { canonical: '/pricing' },
};

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    blurb: 'Enough to replace posting by hand.',
    cta: { href: '/login', label: 'Start free' },
    featured: false,
    points: [
      '3 connected channels',
      '30 scheduled posts a month',
      'One calendar and queue',
      'Per-channel previews and live limits',
      'iOS, Android and web',
    ],
  },
  {
    name: 'Pro',
    price: '$12',
    period: 'per month',
    blurb: 'Publish everywhere, every day.',
    cta: { href: '/login', label: 'Start scheduling' },
    featured: true,
    points: [
      'All 10 channels connected',
      'Unlimited scheduled posts',
      'AI writer with live research',
      'Templates and AI media',
      'Analytics across every channel',
    ],
  },
  {
    name: 'Team',
    price: '$29',
    period: 'per month',
    blurb: 'Draft together, approve in one tap.',
    cta: { href: '/login', label: 'Start as a team' },
    featured: false,
    points: [
      'Everything in Pro',
      'Approvals and review notes',
      'Member, admin and owner roles',
      'Shared calendar for the whole team',
      'Priority support',
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple plans, published prices."
        lede="Start free and stay free if that is enough. Upgrade when you want all ten channels, the AI writer or approvals. No per-channel fees, no annual lock-in."
        secondary={{ href: '/compare', label: 'Compare with alternatives' }}
      />

      <section aria-label="Plans" className="border-b border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-14 md:py-20">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`card flex flex-col p-6 ${
                  p.featured ? 'border-2 border-accent shadow-[0_24px_60px_-30px_rgba(28,26,20,0.45)]' : ''
                }`}
              >
                <p className="eyebrow">{p.name}</p>
                <p className="mt-3 font-display text-4xl font-extrabold tracking-tight">
                  {p.price}
                  <span className="ml-1.5 align-middle text-sm font-semibold text-faint">
                    {p.period}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.blurb}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-sm leading-relaxed text-soft">
                      <span className="mt-0.5 text-ink" aria-hidden="true">
                        ✓
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.cta.href}
                  className={`btn mt-6 w-full ${p.featured ? 'btn-bolt' : 'btn-ghost'}`}
                >
                  {p.cta.label}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-faint">
            Prices in USD. Annual billing knocks two months off. Cancel any time, keep your data.
          </p>
        </div>
      </section>

      <FaqList
        items={[
          {
            q: 'What counts against the free plan limit?',
            a: 'Scheduled and sent posts. Drafts do not count, and neither do edits to a post before it ships.',
          },
          {
            q: 'Are there per-channel fees?',
            a: 'No. Connecting Instagram costs the same as connecting X. Every plan that includes a channel includes all of its features.',
          },
          {
            q: 'What happens if I hit the free limit mid-month?',
            a: 'New scheduling pauses; nothing already queued is lost. Upgrade and the queue picks up where it left off, or wait for the reset next month.',
          },
          {
            q: 'Can I switch plans or cancel?',
            a: 'Any time, from billing settings. Upgrades apply immediately; downgrades and cancellations apply at the end of the current period.',
          },
          {
            q: 'Is the AI writer included?',
            a: 'On Pro and Team. Free plans get the composer, previews and queue without AI generation.',
          },
          {
            q: 'Do you charge for team seats on Team?',
            a: 'No. Team is a flat monthly price for the workspace, whether it is two people or ten.',
          },
        ]}
      />

      <CtaBand
        title="Start on free. Upgrade when it earns it."
        body="No credit card for the free plan, and the prices above are the prices you pay."
        secondary={{ href: '/compare', label: 'See the comparison' }}
      />
    </>
  );
}
