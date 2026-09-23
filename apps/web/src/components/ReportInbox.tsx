'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EmojiTextarea } from '@/components/Emoji';

export interface AdminReport {
  id: string;
  email: string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

const STATUSES = ['open', 'triaged', 'resolved', 'closed'] as const;
const FILTERS = ['open', 'all', 'triaged', 'resolved', 'closed'] as const;

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ReportCard({ report }: { report: AdminReport }) {
  const router = useRouter();
  const [status, setStatus] = useState(report.status);
  const [note, setNote] = useState(report.admin_note ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = status !== report.status || note !== (report.admin_note ?? '');

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb
        .from('reports')
        .update({ status, admin_note: note, updated_at: new Date().toISOString() })
        .eq('id', report.id);
      if (error) throw new Error(error.message);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-line bg-paper px-2.5 py-1 font-bold text-soft">
          {report.kind}
        </span>
        <span className="rounded-full border border-line bg-paper px-2.5 py-1 font-bold text-soft">
          {report.status}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted">{report.email || 'no email'}</span>
        <span className="text-muted">{fmt(report.created_at)}</span>
      </div>
      {report.subject ? (
        <h3 className="mt-2 font-display text-base font-extrabold">{report.subject}</h3>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-soft">{report.body}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-bold text-muted">
          Admin note (private)
          <EmojiTextarea
            value={note}
            onChange={setNote}
            rows={2}
            placeholder="Context, decision, follow-up…"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-normal text-ink placeholder:text-faint"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-normal text-ink"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone transition disabled:cursor-default disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {err ? <p className="mt-2 text-xs font-bold text-red-600">{err}</p> : null}
    </article>
  );
}

/** Triage list with a status filter. Server-fetched, client-updated. */
export default function ReportInbox({ initial }: { initial: AdminReport[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const shown =
    filter === 'all' ? initial : initial.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filter === f
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:border-faint'
            }`}
          >
            {f}
            {f !== 'all'
              ? ` (${initial.filter((r) => r.status === f).length})`
              : ` (${initial.length})`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
          Nothing here. The inbox is clear.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {shown.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
