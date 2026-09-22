import { monthMatrix, dayKey } from '@/lib/format';
import { PROVIDER_META } from '@/lib/providers';
import type { ProviderKey } from '@/lib/types';

/**
 * Static product previews for the marketing page. These render the same
 * layout language as the real app surfaces (calendar chips, composer rows,
 * approval card) with illustrative sample content — non-interactive.
 */

interface SamplePost {
  day: number;
  time: string;
  providers: ProviderKey[];
  text: string;
}

const SAMPLE: SamplePost[] = [
  { day: 2, time: '9:00', providers: ['instagram', 'tiktok'], text: 'Launch day teaser' },
  { day: 4, time: '12:30', providers: ['linkedin'], text: 'Hiring post goes out' },
  { day: 7, time: '18:00', providers: ['youtube', 'x'], text: 'Weekly roundup video' },
  { day: 11, time: '8:15', providers: ['threads', 'bluesky', 'mastodon'], text: 'Morning thread' },
  { day: 14, time: '19:00', providers: ['tiktok', 'instagram'], text: 'Behind the scenes cut' },
  { day: 18, time: '10:00', providers: ['facebook', 'pinterest'], text: 'Autumn drop is live' },
  { day: 18, time: '15:45', providers: ['x'], text: 'Flash sale reminder' },
  { day: 25, time: '11:00', providers: ['instagram', 'youtube', 'tiktok'], text: 'Founder story part two' },
];

function Dots({ providers }: { providers: ProviderKey[] }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {providers.map((p) => (
        <span
          key={p}
          title={PROVIDER_META[p].label}
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: PROVIDER_META[p].color }}
        />
      ))}
    </span>
  );
}

export function CalendarPreview() {
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = dayKey(now);
  const weeks = monthMatrix(now);
  const byDay = new Map<string, SamplePost[]>();
  for (const s of SAMPLE) {
    const date = weeks.flat().find((d) => d.getMonth() === now.getMonth() && d.getDate() === s.day);
    if (!date) continue;
    const k = dayKey(date);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const scheduled = [...byDay.values()].reduce((n, items) => n + items.length, 0);

  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-2.5">
        <p className="font-display text-sm font-extrabold tracking-tight">{monthLabel}</p>
        <span className="pill bg-paper-dim text-ink">{scheduled} scheduled</span>
      </div>
      <div className="grid grid-cols-7 gap-px bg-line-soft">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="bg-card px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-faint"
          >
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const key = dayKey(day);
          const inMonth = day.getMonth() === now.getMonth();
          const items = inMonth ? (byDay.get(key) ?? []) : [];
          const isToday = key === today;
          return (
            <div key={key} className={`min-h-[84px] bg-card p-1.5 ${inMonth ? '' : 'bg-bone/40'}`}>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  isToday ? 'bg-accent text-white' : inMonth ? 'text-soft' : 'text-faint'
                }`}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 2).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 truncate rounded-md bg-bone px-1.5 py-1"
                  >
                    <Dots providers={p.providers.slice(0, 3)} />
                    <span className="truncate text-[10px] font-semibold leading-none text-soft">
                      {p.text}
                    </span>
                  </div>
                ))}
                {items.length > 2 && (
                  <span className="block text-[10px] font-bold text-faint">
                    +{items.length - 2} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComposerPreview() {
  const rows: { provider: ProviderKey; sub: string }[] = [
    { provider: 'instagram', sub: '@studio' },
    { provider: 'tiktok', sub: '@studio' },
    { provider: 'youtube', sub: 'Studio channel' },
  ];
  return (
    <div className="card p-4" aria-hidden="true">
      <p className="font-display text-sm font-bold">Autumn drop is live</p>
      <p className="mt-1 text-xs leading-relaxed text-soft">
        New colors, same favorite fit. Link in bio for early access before Friday.
      </p>
      <div className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.provider}
            className="flex items-center gap-2.5 rounded-xl border border-accent bg-accent-soft px-3 py-2"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ background: PROVIDER_META[r.provider].color }}
            >
              {PROVIDER_META[r.provider].glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {PROVIDER_META[r.provider].label}
              </span>
              <span className="block truncate text-[11px] text-muted">{r.sub}</span>
            </span>
            <span className="text-xs font-bold text-ink">✓</span>
          </div>
        ))}
      </div>
      <span className="btn btn-bolt mt-3 w-full text-xs">Schedule</span>
    </div>
  );
}

export function WriterPreview() {
  return (
    <div className="card p-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold">Write with AI</p>
        <span className="pill bg-paper-dim text-ink">GPT-5.6 Luna</span>
      </div>
      <p className="mt-2 rounded-xl bg-bone px-3 py-2 text-xs leading-relaxed text-soft">
        why I stopped chasing viral hacks and started posting one honest update a day…
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {['Breaking', 'Thread', 'Listicle', 'Teardown'].map((s, i) => (
          <span
            key={s}
            className={`pill ring-1 ring-line ${i === 1 ? 'bg-ink text-white' : 'bg-paper text-soft'}`}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="mt-2.5 rounded-xl border border-line bg-paper p-3">
        <p className="text-xs leading-relaxed text-ink">
          I wasted 2 years overthinking content. Here is the system that actually works:
        </p>
        <p className="mt-1.5 text-xs font-semibold text-ink">#contenttips #buildinpublic</p>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="pill bg-paper text-soft ring-1 ring-line">Auto · Melayu</span>
        <span className="text-[11px] font-bold text-muted">232/280</span>
      </div>
    </div>
  );
}

export function ApprovalPreview() {
  return (
    <div className="card p-4" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-paper-dim text-ink">Needs approval</span>
        <Dots providers={['instagram', 'tiktok']} />
      </div>
      <p className="mt-2 text-sm text-ink">Launch day teaser is ready for review.</p>
      <p className="mt-1 text-xs text-muted">Sent for review by a teammate.</p>
      <div className="mt-3 flex gap-2">
        <span className="btn btn-bolt flex-1 text-xs">Approve</span>
        <span className="btn btn-ghost flex-1 text-xs">Request changes</span>
      </div>
    </div>
  );
}
