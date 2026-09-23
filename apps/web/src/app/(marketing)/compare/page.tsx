import type { Metadata } from 'next';
import { CtaBand, FaqList, PageHero } from '@/components/site/PageBlocks';

export const metadata: Metadata = {
  title: 'Compare',
  description:
    'How Sosial compares with all-in-one social suites, single-network scheduling apps, and posting by hand. A fair look at where each approach wins.',
  alternates: { canonical: '/compare' },
};

type Cell = string | boolean;

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: 'Ten networks in one composer', cells: [true, false, false, false] },
  { label: 'Publishes with the app closed', cells: [true, true, false, false] },
  { label: 'Live character limits before you schedule', cells: [true, false, true, false] },
  { label: 'AI writer with linked sources', cells: [true, false, false, false] },
  { label: 'Approvals and roles', cells: [true, false, true, false] },
  { label: 'Free plan that stays free', cells: [true, false, true, true] },
  { label: 'No per-channel paywall', cells: [true, false, true, false] },
  { label: 'Works on iOS, Android and web', cells: [true, true, false, true] },
];

const HEADERS = ['Sosial', 'Suites', 'Single-network apps', 'By hand'] as const;

function mark(cell: Cell) {
  if (cell === true) {
    return (
      <span className="text-ink" aria-label="Yes">
        ✓
      </span>
    );
  }
  return (
    <span className="text-faint" aria-label="No">
      ×
    </span>
  );
}

export default function ComparePage() {
  return (
    <>
      <PageHero
        eyebrow="Compare"
        title="Where Sosial fits."
        lede="Suites do a lot and charge for the lot. Single-network apps are light and stay in one lane. Posting by hand is free until it is 11pm. Here is the honest shape of each."
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />

      <section aria-label="Comparison" className="border-b border-line bg-card/60">
        <div className="mx-auto max-w-[1440px] px-4 py-14 md:py-20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-2/5 border-b border-line px-4 py-3 text-left">
                    <span className="eyebrow">Capability</span>
                  </th>
                  {HEADERS.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`border-b border-line px-4 py-3 text-center font-display text-sm font-extrabold tracking-tight ${
                        i === 0 ? 'bg-accent-soft text-accent-ink' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-semibold text-soft">
                      {r.label}
                    </th>
                    {r.cells.map((c, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 text-center text-base ${
                          i === 0 ? 'bg-accent-soft/60' : ''
                        }`}
                      >
                        {mark(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-faint">
            Categories, not a takedown: &quot;suites&quot; means the big all-in-one tools, and
            &quot;single-network apps&quot; means schedulers built around one platform. Features
            across that group change often, so check current plans before you buy anything,
            ours included.
          </p>
        </div>
      </section>

      <FaqList
        items={[
          {
            q: 'Why not just use a big suite?',
            a: 'If you need listening, ads and enterprise reporting, a suite may serve you better. If your job is writing posts and getting them out on ten networks on time, the suite tax buys a lot of surface you never open.',
          },
          {
            q: 'Why not a free single-network app?',
            a: 'They are great for one lane. The cost shows up when one idea has to become ten posts: retyping, re-previewing, re-counting characters, and remembering which draft went where.',
          },
          {
            q: 'Why not post by hand?',
            a: 'You can. Hand posting works until the week gets busy, and then the queue is the first thing to slip. A calendar you fill once beats five apps you remember at midnight.',
          },
          {
            q: 'What does Sosial not do?',
            a: 'Social listening, ad buying and inbox replacement. Those live in the suites. Sosial does compose, preview, schedule, approve and publish across ten networks, with an AI writer and analytics.',
          },
        ]}
      />

      <CtaBand
        title="Pick the lane that matches the work."
        body="Ten channels, one calendar, priced in the open."
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />
    </>
  );
}
