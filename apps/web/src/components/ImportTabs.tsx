'use client';

/** Import hub: Notion | Google Sheets tabs (both keep their own state). */
import { useState } from 'react';
import ImportNotion from './ImportNotion';
import ImportSheets from './ImportSheets';

type Tab = 'notion' | 'sheets';

export default function ImportTabs({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<Tab>('notion');
  return (
    <div className="mt-4">
      <div className="flex gap-1.5" role="tablist" aria-label="Import source">
        {(
          [
            { id: 'notion', label: 'Notion' },
            { id: 'sheets', label: 'Google Sheets' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === t.id ? 'bg-ink text-paper' : 'bg-surface text-soft hover:bg-line'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'notion' ? <ImportNotion workspaceId={workspaceId} /> : <ImportSheets workspaceId={workspaceId} />}
    </div>
  );
}
