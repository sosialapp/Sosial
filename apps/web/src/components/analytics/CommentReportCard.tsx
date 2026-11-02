'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMessages } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { providerMeta } from '@/lib/providers';
import { createClient } from '@/lib/supabase/client';

/**
 * Comment report, read-only. Counts what the comment sync already stored:
 * replied vs waiting vs moderated, per connected account, for the same date
 * range and channel filter as the rest of Analytics. No platform API calls,
 * no write path, so it needs no extra permissions.
 */

/** Counting fields only; the CSV export fetches author and text itself. */
export interface CommentReportRow {
  id: string;
  channel_id: string;
  platform: string;
  created_at: string;
  status: string;
  is_own: boolean;
}

/** Author and text for the exported rows, read under RLS in id batches. */
async function fetchCommentText(ids: string[]): Promise<Map<string, { author: string | null; body: string }>> {
  const sb = createClient();
  const out = new Map<string, { author: string | null; body: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from('comments')
      .select('id, author_name, body')
      .in('id', ids.slice(i, i + 200));
    if (error) throw error;
    for (const r of (data ?? []) as { id: string; author_name: string | null; body: string }[]) {
      out.set(r.id, { author: r.author_name, body: r.body });
    }
  }
  return out;
}

interface ChannelGroup {
  id: string;
  provider: string;
  total: number;
  replied: number;
  waiting: number;
}

const csvCell = (v: string | number | null): string => {
  let s = v === null ? '' : String(v);
  // Stop spreadsheet formula injection from platform comment text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '-';

export default function CommentReportCard({
  rows,
  rangeLabel,
  channelLabel,
  channelAvatar,
}: {
  rows: CommentReportRow[];
  rangeLabel: string;
  channelLabel: (channelId: string, provider: string) => string;
  channelAvatar: (channelId: string) => string | undefined;
}) {
  const t = useMessages();

  const replied = rows.filter((r) => r.status === 'replied').length;
  const waiting = rows.filter((r) => r.status === 'new').length;
  const moderated = rows.filter((r) => r.status === 'hidden' || r.status === 'deleted').length;

  const groups = new Map<string, ChannelGroup>();
  for (const r of rows) {
    const g = groups.get(r.channel_id) ?? {
      id: r.channel_id,
      provider: r.platform,
      total: 0,
      replied: 0,
      waiting: 0,
    };
    g.total += 1;
    if (r.status === 'replied') g.replied += 1;
    if (r.status === 'new') g.waiting += 1;
    groups.set(r.channel_id, g);
  }
  const groupRows = [...groups.values()].sort((a, b) => b.total - a.total);

  const [exporting, setExporting] = useState(false);
  const exportCsv = async (): Promise<void> => {
    setExporting(true);
    let text: Awaited<ReturnType<typeof fetchCommentText>>;
    try {
      text = await fetchCommentText(rows.map((r) => r.id));
    } catch {
      return;
    } finally {
      setExporting(false);
    }
    const head = ['Date', 'Platform', 'Account', 'Author', 'Status', 'Comment'];
    const lines = rows.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.platform,
        channelLabel(r.channel_id, r.platform),
        text.get(r.id)?.author ?? null,
        r.status,
        text.get(r.id)?.body ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`sosial-comments-${stamp}.csv`, `\uFEFF${[head.join(','), ...lines].join('\r\n')}`);
  };

  const tiles = [
    { key: 'crTotal', value: String(rows.length) },
    { key: 'crReplied', value: String(replied) },
    { key: 'crWaiting', value: String(waiting) },
    { key: 'crModerated', value: String(moderated) },
    { key: 'crRate', value: pct(replied, rows.length) },
  ];

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{t('crTitle')}</CardTitle>
            <CardDescription>{fill(t('crSub'), { range: rangeLabel.toLowerCase() })}</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={rows.length === 0 || exporting}
            aria-busy={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-bold text-soft transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t('crExport')}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <div key={tile.key} className="rounded-2xl border border-line-soft bg-paper-dim/60 px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-faint">{t(tile.key)}</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-ink">{tile.value}</p>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-paper-dim px-4 py-6 text-center text-sm text-muted">{t('crEmpty')}</p>
        ) : (
          // Per account: who, then the three numbers that matter. The full
          // breakdown (replied, waiting, moderated) is in the tiles above and
          // the CSV. Same rows as the mobile CommentReport.
          <ul className="mt-4 divide-y divide-line-soft">
            {groupRows.map((g) => (
              // Narrow cards wrap the numbers under the name instead of crushing it.
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <span className="flex min-w-[9rem] flex-1 items-center gap-3">
                  <ChannelAvatar provider={g.provider} avatar={channelAvatar(g.id)} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{channelLabel(g.id, g.provider)}</span>
                    <span className="block truncate text-[11px] text-faint">{providerMeta(g.provider).label}</span>
                  </span>
                </span>
                <span className="ml-auto flex gap-2 sm:gap-3">
                  <Num label={t('crTotal')} value={String(g.total)} />
                  <Num label={t('crWaiting')} value={String(g.waiting)} />
                  <Num label={t('crRate')} value={pct(g.replied, g.total)} />
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-faint">{t('crNote')}</p>
      </CardContent>
    </Card>
  );
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <span className="w-[52px] shrink-0 text-right sm:w-16">
      <span className="block font-display text-base font-extrabold leading-none tabular-nums text-ink">{value}</span>
      <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-faint">{label}</span>
    </span>
  );
}
