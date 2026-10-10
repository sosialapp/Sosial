'use client';

/** Import hub: Notion | Google Sheets tabs (both keep their own state). */
import { useState } from 'react';
import ImportNotion from './ImportNotion';
import ImportSheets from './ImportSheets';
import SegmentedPills from '@/components/ui/segmented-pills';

type Tab = 'notion' | 'sheets';

export default function ImportTabs({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<Tab>('notion');
  return (
    <div className="mt-4">
      <SegmentedPills
        ariaLabel="Import source"
        role="tablist"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'notion', label: 'Notion' },
          { value: 'sheets', label: 'Google Sheets' },
        ]}
      />
      {tab === 'notion' ? <ImportNotion workspaceId={workspaceId} /> : <ImportSheets workspaceId={workspaceId} />}
    </div>
  );
}
