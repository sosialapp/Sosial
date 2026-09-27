/**
 * Proof strip (Tenner architecture): ink band, four true stats with bolt
 * numerals. Every figure is verifiable in the product — no invented numbers.
 */
const STATS: [string, string][] = [
  ['$0', 'Free plan, forever'],
  ['10', 'Networks with native previews'],
  ['100+', 'AI writing languages'],
  ['1', 'Shared calendar and queue'],
];

export default function ProofStrip() {
  return (
    <section aria-label="Sosial at a glance" className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-9 lg:grid-cols-4">
        {STATS.map(([n, label]) => (
          <div key={label} className="flex flex-col gap-1 border-l-[1.5px] border-paper/20 pl-4">
            <b className="font-display text-3xl font-semibold text-bolt">{n}</b>
            <span className="text-sm text-paper/80">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
