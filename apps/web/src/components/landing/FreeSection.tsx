import Link from 'next/link';

/**
 * Free section (Tenner fees architecture): giant $0 left, plan mini-table
 * right. Prices are the canonical monthly prices; the table links on to
 * full pricing. Nothing invented.
 */

const ROWS: [string, string][] = [
  ['Solo', '$12'],
  ['Team', '$29'],
  ['Business', '$79'],
];

export default function FreeSection() {
  return (
    <section aria-label="Pricing" className="bg-paper">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 py-20 md:py-28 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Pricing, published</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            Start free. Pay when it earns it.
          </h2>
          <p className="font-display font-semibold leading-none tracking-tight text-bolt text-[clamp(5rem,12vw,9rem)]">
            $0
            <small className="mt-2 block font-display text-2xl text-ink">The free plan, forever. No card.</small>
          </p>
          <p className="mt-4 max-w-[52ch] text-muted">
            Three channels, ten scheduled posts per channel and 20 AI credits a month — free
            until you need more rooms, more seats or more credits.
          </p>
        </div>
        <div>
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="border-b-2 border-ink py-3 text-left font-display font-semibold">Plan</th>
                <th className="border-b-2 border-ink py-3 text-right font-display font-semibold">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([plan, price]) => (
                <tr key={plan} className="transition-colors hover:bg-ink/[0.03]">
                  <td className="border-b border-ink/10 py-3.5 font-semibold">{plan}</td>
                  <td className="border-b border-ink/10 py-3.5 text-right font-bold tabular-nums">{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted">
            Yearly billing works out cheaper per month. AI credits reset on the 1st, every plan.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-ink px-6 py-3.5 font-display text-base font-semibold text-paper transition-all hover:-translate-y-0.5"
          >
            See full pricing
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
