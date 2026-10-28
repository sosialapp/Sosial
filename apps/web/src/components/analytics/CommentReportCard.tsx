'use client';

import { Download } from 'lucide-react';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { appMessages } from '@/lib/i18n/app';
import { useT } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { providerMeta } from '@/lib/providers';

/**
 * Comment report, read-only. Counts what the comment sync already stored:
 * replied vs waiting vs moderated, per connected account, for the same date
 * range and channel filter as the rest of Analytics. No platform API calls,
 * no write path, so it needs no extra permissions.
 */

export interface CommentReportRow {
  id: string;
  channel_id: string;
  platform: string;
  author_name: string | null;
  body: string;
  created_at: string;
  status: string;
  is_own: boolean;
}

interface ChannelGroup {
  id: string;
  provider: string;
  total: number;
  replied: number;
  handled: number;
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
}: {
  rows: CommentReportRow[];
  rangeLabel: string;
  channelLabel: (channelId: string, provider: string) => string;
}) {
  const t = useT(appMessages);

  const replied = rows.filter((r) => r.status === 'replied').length;
  const handled = rows.filter((r) => r.status === 'resolved' || r.status === 'ignored').length;
  const waiting = rows.filter((r) => r.status === 'new').length;
  const moderated = rows.filter((r) => r.status === 'hidden' || r.status === 'deleted').length;

  const groups = new Map<string, ChannelGroup>();
  for (const r of rows) {
    const g = groups.get(r.channel_id) ?? {
      id: r.channel_id,
      provider: r.platform,
      total: 0,
      replied: 0,
      handled: 0,
      waiting: 0,
    };
    g.total += 1;
    if (r.status === 'replied') g.replied += 1;
    if (r.status === 'resolved' || r.status === 'ignored') g.handled += 1;
    if (r.status === 'new') g.waiting += 1;
    groups.set(r.channel_id, g);
  }
  const groupRows = [...groups.values()].sort((a, b) => b.total - a.total);

  const exportCsv = (): void => {
    const head = ['Date', 'Platform', 'Account', 'Author', 'Status', 'Comment'];
    const lines = rows.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.platform,
        channelLabel(r.channel_id, r.platform),
        r.author_name,
        r.status,
        r.body,
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
    { key: 'crHandled', value: String(handled) },
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
            onClick={exportCsv}
            disabled={rows.length === 0}
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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-line-soft text-left text-[11px] font-bold uppercase tracking-wide text-faint">
                  <th scope="col" className="pb-2 pr-3 font-bold">
                    {t('crAccount')}
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-right font-bold">
                    {t('crTotal')}
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-right font-bold">
                    {t('crReplied')}
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-right font-bold">
                    {t('crHandled')}
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-right font-bold">
                    {t('crWaiting')}
                  </th>
                  <th scope="col" className="pb-2 text-right font-bold">
                    {t('crRate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((g) => (
                  <tr key={g.id} className="border-b border-line-soft/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <BrandIcon provider={g.provider as BrandProvider} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {channelLabel(g.id, g.provider)}
                          </span>
                          <span className="block text-[11px] text-faint">
                            {providerMeta(g.provider).label}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{g.total}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{g.replied}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{g.handled}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{g.waiting}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{pct(g.replied, g.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-faint">{t('crNote')}</p>
      </CardContent>
    </Card>
  );
}
