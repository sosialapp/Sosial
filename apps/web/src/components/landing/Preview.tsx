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
  { day: 5, time: '12:30', providers: ['linkedin'], text: 'Hiring post goes out' },
  { day: 5, time: '18:00', providers: ['youtube', 'x'], text: 'Weekly roundup video' },
  { day: 9, time: '8:15', providers: ['threads', 'bluesky', 'mastodon'], text: 'Morning thread' },
  { day: 14, time: '19:00', providers: ['tiktok', 'instagram'], text: 'Behind the scenes cut' },
  { day: 16, time: '10:00', providers: ['facebook', 'pinterest'], text: 'Autumn drop is live' },
  { day: 16, time: '15:45', providers: ['x'], text: 'Flash sale reminder' },
  { day: 23, time: '11:00', providers: ['instagram', 'youtube', 'tiktok'], text: 'Founder story part two' },
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
  const weeks = monthMatrix(now);
  const byDay = new Map<string, SamplePost[]>();
  for (const s of SAMPLE) {
    const date = weeks.flat().find((d) => d.getMonth() === now.getMonth() && d.getDate() === s.day);
    if (!date) continue;
    const k = dayKey(date);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  return (
    <div aria-hidden="true">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center text-[10px] font-bold text-muted">
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const items = byDay.get(dayKey(day)) ?? [];
          const inMonth = day.getMonth() === now.getMonth();
          return (
            <div
              key={dayKey(day)}
              className={`min-h-[76px] bg-card p-1.5 ${inMonth ? '' : 'opacity-40'}`}
            >
              <span className="text-[11px] font-bold text-muted">{day.getDate()}</span>
              <div className="mt-0.5 space-y-1">
                {items.slice(0, 2).map((p, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-line bg-paper px-1.5 py-1 text-[10px] leading-tight"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-accent">{p.time}</span>
                      <Dots providers={p.providers} />
                    </div>
                    <div className="truncate text-soft">{p.text}</div>
                  </div>
                ))}
                {items.length > 2 && (
                  <span className="text-[10px] text-faint">+{items.length - 2} more</span>
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
            <span className="text-xs font-bold text-accent">✓</span>
          </div>
        ))}
      </div>
      <span className="btn btn-primary mt-3 w-full text-xs">Schedule</span>
    </div>
  );
}

export function ApprovalPreview() {
  return (
    <div className="card p-4" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-accent-soft text-accent-ink">Needs approval</span>
        <Dots providers={['instagram', 'tiktok']} />
      </div>
      <p className="mt-2 text-sm text-ink">Launch day teaser is ready for review.</p>
      <p className="mt-1 text-xs text-muted">Sent for review by a teammate.</p>
      <div className="mt-3 flex gap-2">
        <span className="btn btn-primary flex-1 text-xs">Approve</span>
        <span className="btn btn-ghost flex-1 text-xs">Request changes</span>
      </div>
    </div>
  );
}
