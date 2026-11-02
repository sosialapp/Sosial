'use client';

/** Import hub: the Notion source card above its import flow. */
import ImportNotion from './ImportNotion';
import { SourceMark } from './SourceMarks';
import { useT } from '@/lib/i18n/client';
import { importerMessages } from '@/lib/i18n/importer';

/** Dictionary keys for the columns a Notion database maps onto. */
const FIELDS = ['fTitle', 'fPageBody', 'fDate', 'fPlatform', 'fFiles'];

export default function ImportTabs({ workspaceId }: { workspaceId: string }) {
  const t = useT(importerMessages);
  return (
    <div className="mt-5">
      <div className="flex items-start gap-4 rounded-3xl border border-line bg-card p-5">
        <SourceMark
          id="notion"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-white p-2.5 [&_svg]:h-full [&_svg]:w-full"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-extrabold tracking-tight">Notion</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t('notionBlurb')}</span>
          <span className="mt-3 flex flex-wrap gap-1">
            {FIELDS.map((f) => (
              <span key={f} className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-soft">
                {t(f)}
              </span>
            ))}
          </span>
        </span>
      </div>
      <ImportNotion workspaceId={workspaceId} />
    </div>
  );
}
