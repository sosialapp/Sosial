'use client';

/** Pieces of the Notion import flow. */
import { Check } from 'lucide-react';
import { SourceMark } from './SourceMarks';
import { useT } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { importerMessages } from '@/lib/i18n/importer';

const STEPS = ['stConnect', 'stChoose', 'stMap', 'stReview', 'stImport'];

/** Shared progress rail for both import flows; `current` is a STEPS index. */
export function ImportSteps({ current, done }: { current: number; done?: boolean }) {
  const t = useT(importerMessages);
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold" aria-label={t('progress')}>
      {STEPS.map((label, i) => {
        const complete = i < current || (done && i === current);
        const here = i === current && !done;
        return (
          <li key={label} className="flex shrink-0 items-center gap-1.5" aria-current={here ? 'step' : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold transition ${
                complete ? 'bg-ink text-paper' : here ? 'bg-accent text-on-accent' : 'bg-surface text-muted'
              }`}
            >
              {complete ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={here || complete ? 'text-ink' : 'text-muted'}>{t(label)}</span>
            {i < STEPS.length - 1 ? <span className="mx-1 h-px w-5 bg-line sm:w-8" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The connection header both flows share: real brand mark, status, action. */
export function ImportConnection({
  mark,
  name,
  status,
  connected,
  busy,
  connectLabel,
  onConnect,
  onDisconnect,
  points,
}: {
  mark: string;
  name: string;
  status: string;
  connected: boolean | null;
  busy: boolean;
  connectLabel: string;
  onConnect: () => void;
  onDisconnect: () => void;
  points: string[];
}) {
  const t = useT(importerMessages);
  return (
    <section className="card p-5" aria-label={fill(t('connection'), { name })}>
      <div className="flex flex-wrap items-center gap-3">
        <SourceMark
          id={mark}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
        />
        <span className="min-w-0 flex-1 basis-40">
          <span className="block text-sm font-bold">{name}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            {connected ? <span className="h-1.5 w-1.5 rounded-full bg-[#4caf50]" aria-hidden="true" /> : null}
            {status}
          </span>
        </span>
        {connected ? (
          <button type="button" onClick={onDisconnect} disabled={busy} className="btn btn-ghost">
            {t('disconnect')}
          </button>
        ) : (
          <button type="button" onClick={onConnect} disabled={busy || connected === null} className="btn btn-primary w-full justify-center sm:w-auto">
            <SourceMark id={mark} className="flex h-4 w-4 items-center justify-center rounded bg-white p-px [&_svg]:h-full [&_svg]:w-full" />
            {busy ? t('connecting') : connectLabel}
          </button>
        )}
      </div>
      {connected === false ? (
        <ul className="mt-4 grid gap-2 border-t border-line-soft pt-4 sm:grid-cols-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-xs text-muted">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#346538] dark:text-[#8fd0a0]" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
