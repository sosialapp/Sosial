import { PLANS } from '@/lib/billing/plans';
import { FEATURE_MATRIX, FEATURE_PLAN_ORDER } from '@/lib/billing/features';

/**
 * Full plan comparison. Rows are generated from the canonical PLANS config
 * via FEATURE_MATRIX, so limits shown here are exactly what the server
 * enforces. Qualitative capabilities are marked per plan.
 */
function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="text-ink" aria-label="Included">
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-faint" aria-label="Not included">
        —
      </span>
    );
  }
  return <span className="text-soft">{value}</span>;
}

export default function PlanComparison() {
  return (
    <section aria-label="Plan comparison" className="border-b border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Compare plans</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Every limit, side by side.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Scheduled posts are counted per connected channel and free up the moment a post
            publishes. AI credits reset on the 1st of every month, on every plan.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-2/5 pb-4 pr-4" />
                {FEATURE_PLAN_ORDER.map((key) => {
                  const p = PLANS[key];
                  return (
                    <th key={key} scope="col" className="pb-4 pl-4 align-bottom">
                      <span className="eyebrow block">{p.label}</span>
                      {p.featured ? (
                        <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
                          Most popular
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {FEATURE_MATRIX.map((cat) => (
              <tbody key={cat.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={1 + FEATURE_PLAN_ORDER.length}
                    className="pt-7 pb-2 text-left"
                  >
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                      {cat.title}
                    </span>
                  </th>
                </tr>
                {cat.rows.map((row) => (
                  <tr key={row.label} className="border-b border-line/70">
                    <th scope="row" className="py-3 pr-4 text-sm font-medium text-soft">
                      {row.label}
                    </th>
                    {FEATURE_PLAN_ORDER.map((key) => (
                      <td key={key} className="py-3 pl-4 text-sm">
                        <Cell value={row.value(key)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}
