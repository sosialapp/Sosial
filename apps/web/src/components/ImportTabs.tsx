'use client';

/** Import hub: Notion | Google Sheets source cards (both keep their own state). */
import { useState } from 'react';
import { Check } from 'lucide-react';
import ImportNotion from './ImportNotion';
import ImportSheets from './ImportSheets';
import { SourceMark } from './SourceMarks';
import { useT } from '@/lib/i18n/client';
import { importerMessages } from '@/lib/i18n/importer';

type Tab = 'notion' | 'sheets';

/** blurb and fields are dictionary keys; names are brands. */
const SOURCES: { value: Tab; mark: string; name: string; blurb: string; fields: string[] }[] = [
  {
    value: 'notion',
    mark: 'notion',
    name: 'Notion',
    blurb: 'notionBlurb',
    fields: ['fTitle', 'fPageBody', 'fDate', 'fPlatform', 'fFiles'],
  },
  {
    value: 'sheets',
    mark: 'sheets',
    name: 'Google Sheets',
    blurb: 'sheetsBlurb',
    fields: ['fContent', 'fDate', 'fPlatforms', 'fMediaUrls', 'fTags'],
  },
];

export default function ImportTabs({ workspaceId }: { workspaceId: string }) {
  const t = useT(importerMessages);
  const [tab, setTab] = useState<Tab>('notion');
  return (
    <div className="mt-5">
      <div role="radiogroup" aria-label={t('sourceLabel')} className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const active = tab === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTab(s.value)}
              className={`group relative flex items-start gap-4 rounded-3xl border bg-card p-5 text-left transition ${
                active ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]' : 'border-line hover:border-ink/40'
              }`}
            >
              <SourceMark
                id={s.mark}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-white p-2.5 [&_svg]:h-full [&_svg]:w-full"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-extrabold tracking-tight">{s.name}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t(s.blurb)}</span>
                <span className="mt-3 flex flex-wrap gap-1">
                  {s.fields.map((f) => (
                    <span key={f} className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-soft">
                      {t(f)}
                    </span>
                  ))}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                  active ? 'border-ink bg-ink text-paper' : 'border-line'
                }`}
              >
                {active ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {tab === 'notion' ? <ImportNotion workspaceId={workspaceId} /> : <ImportSheets workspaceId={workspaceId} />}
    </div>
  );
}
