/**
 * Safety (Tenner safety architecture): six plain-spoken fact cards with
 * color icon discs, then a details-row FAQ. Every fact is verifiable in
 * the product, terms or privacy policy.
 */

function Stroke({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      {children}
    </svg>
  );
}

const FACTS: { title: string; body: string; bg: string; fg?: string; icon: React.ReactNode }[] = [
  {
    title: 'Official APIs only',
    body: 'Every publish goes through each network\u2019s official API. No scraping, no grey-area automation, no bans.',
    bg: '#FFC62E',
    icon: <Stroke><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M9 12l2 2 4-4" /></Stroke>,
  },
  {
    title: 'A human presses post',
    body: 'AI drafts, teammates review, you decide. Nothing reaches a network without a person approving it.',
    bg: '#D7E8F2',
    icon: <Stroke><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Stroke>,
  },
  {
    title: 'Drafts never sold',
    body: 'We do not sell your data, show ads, or train models on your content. Your drafts are yours.',
    bg: '#FDF3D7',
    icon: <Stroke><path d="M2 12s3.5-6 10-6c2 0 3.7.6 5.2 1.4M22 12s-3.5 6-10 6c-2 0-3.7-.6-5.2-1.4" /><path d="m4 4 16 16" /></Stroke>,
  },
  {
    title: 'Published pricing',
    body: 'The prices on the pricing page are the prices you pay. No quotes, no calls, no surprises.',
    bg: '#FFC62E',
    icon: <Stroke><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></Stroke>,
  },
  {
    title: 'Tokens encrypted',
    body: 'Channel tokens and content are encrypted in transit and at rest, and access is restricted to the systems that publish.',
    bg: '#D7E8F2',
    icon: <Stroke><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Stroke>,
  },
  {
    title: 'Leave with your data',
    body: 'Cancel anytime from billing settings. Your plan runs to the end of the period, and your content stays exportable.',
    bg: '#FDF3D7',
    icon: <Stroke><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Stroke>,
  },
];

const FAQ: [string, string][] = [
  [
    'Which channels can I connect?',
    'Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon and Pinterest. Free connects 3, Solo 6, Team 25 and Business 100 — connecting one costs the same as any other.',
  ],
  [
    'How do AI credits work?',
    'Every plan gets credits that reset on the 1st: 20 on Free, then 500, 1,500 and 5,000. A rewrite costs 1, a caption or adaptation 2, a thread or repurpose 3, a long-form draft 5.',
  ],
  [
    'What counts against the scheduled-post limit?',
    'Posts that are scheduled or waiting on a channel and not yet published. The limit is per connected channel, a slot frees the moment a post publishes, and drafts never count.',
  ],
  [
    'Can I switch plans or cancel?',
    'Anytime, from billing settings. Changes apply immediately and are prorated; cancelling keeps your plan until the end of the current period.',
  ],
];

export default function SafetySection() {
  return (
    <section aria-label="Trust and questions" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="max-w-[34ch]">
          <p className="eyebrow">Straight answers</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            The boring bits, said plainly.
          </h2>
          <p className="mt-3 text-muted">
            Scheduling is trust work. Here is how yours is kept.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACTS.map((f) => (
            <div key={f.title} className="rounded-[28px] border border-line bg-white p-6">
              <span className="grid h-[46px] w-[46px] place-items-center rounded-[14px]" style={{ background: f.bg, color: f.fg ?? '#1C1A14' }}>
                {f.icon}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 max-w-3xl">
          <h3 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Questions creators ask
          </h3>
          <div className="mt-5">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="border-t-[1.5px] border-ink last:border-b-[1.5px]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[18px] font-display text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full border-[1.5px] border-ink text-xl leading-none transition-transform [[open]_&]:rotate-45 [[open]_&]:bg-bolt">
                    +
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
