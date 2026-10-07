'use client';

/**
 * Google Sheets import flow: connect (incremental spreadsheets.readonly
 * consent) → paste spreadsheet URL → pick worksheet → map columns
 * (auto-suggested from the header, fully editable) → set date options
 * (timezone, ambiguous day/month order) → per-row validation preview →
 * chunked import with progress. Reuses the popup-nonce bridge and the
 * post_sources dedupe ledger.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SheetsMapping } from '@/lib/sheets';

interface SheetMeta {
  id: string;
  title: string;
  sheets: { title: string }[];
}

interface PreviewRow {
  row: number;
  ok: boolean;
  errors: string[];
  draft: {
    title: string;
    body: string;
    channels: string[];
    scheduled_at: string | null;
    warnings: string[];
    media_count: number;
  } | null;
}

interface ImportState {
  import_id: string;
  status: string;
  progress_total: number;
  progress_done: number;
  result: {
    imported?: number;
    duplicates?: number;
    changed?: number;
    failed?: number;
    errors?: string[];
  };
}

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FIELDS: { key: keyof SheetsMapping | 'statusMap'; label: string; required?: boolean }[] = [
  { key: 'contentCol', label: 'Content', required: true },
  { key: 'dateCol', label: 'Publish date' },
  { key: 'platformCol', label: 'Platform(s)' },
  { key: 'titleCol', label: 'Title' },
  { key: 'mediaCol', label: 'Media URL(s)' },
  { key: 'statusCol', label: 'Status' },
  { key: 'tagsCol', label: 'Tags' },
];

function extractSpreadsheetId(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(input.trim())) return input.trim();
  return null;
}

export default function ImportSheets({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [url, setUrl] = useState('');
  const [meta, setMeta] = useState<SheetMeta | null>(null);
  const [sheetTitle, setSheetTitle] = useState('');
  const [header, setHeader] = useState<string[]>([]);
  const [mapping, setMapping] = useState<SheetsMapping | null>(null);
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [dateOrder, setDateOrder] = useState<'auto' | 'dmy' | 'mdy'>('auto');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const nonceRef = useRef('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sheets');
      const j = (await res.json()) as { connected?: boolean };
      setConnected(!!j.connected);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const connect = () => {
    setErr(null);
    const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    nonceRef.current = nonce;
    // Client id comes from oauth-config (public ids served by the edge fn —
    // the same source the media pickers use); no client secret client-side.
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: config } = await sb.functions.invoke('oauth-config', { method: 'GET' });
        const clientId =
          (config as { youtube?: { client_id?: string } } | null)?.youtube?.client_id ?? '';
        if (!clientId) {
          setErr('Google is not configured yet — try again shortly.');
          return;
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: `${window.location.origin}/auth.html`,
          response_type: 'code',
          access_type: 'offline',
          prompt: 'consent',
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          state: `cloud:sheets:${nonce}`,
        });
        window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'sosial-sheets', 'width=640,height=720');
      } catch {
        setErr('Could not start the Google connection — try again.');
        return;
      }
    })();
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; nonce?: string; ok?: boolean; code?: string; error?: string };
      if (d?.type !== 'sosial-cloud' || d.nonce !== nonce) return;
      window.removeEventListener('message', onMsg);
      if (!d.ok || !d.code) {
        setErr(d.error ?? 'Google connection was cancelled.');
        return;
      }
      void (async () => {
        setBusy(true);
        try {
          const res = await fetch('/api/sheets', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ code: d.code }),
          });
          const j = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(j.error ?? 'Could not connect Google Sheets.');
          await loadStatus();
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : 'Could not connect Google Sheets.');
        } finally {
          setBusy(false);
        }
      })();
    };
    window.addEventListener('message', onMsg);
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Google Sheets? Imported posts are kept.')) return;
    setBusy(true);
    try {
      await fetch('/api/sheets', { method: 'DELETE' });
      setConnected(false);
      setMeta(null);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const openSheet = async () => {
    const id = extractSpreadsheetId(url);
    if (!id) {
      setErr('Paste a Google Sheets link (…/spreadsheets/d/…) or the spreadsheet ID.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sheets/meta?id=${encodeURIComponent(id)}`);
      const j = (await res.json()) as SheetMeta & { error?: string; code?: string };
      if (!res.ok) {
        if (j.code === 'auth_expired') setConnected(false);
        throw new Error(j.error ?? 'Could not open the spreadsheet.');
      }
      setMeta(j);
      setSheetTitle(j.sheets[0]?.title ?? 'Sheet1');
      setPreview(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open the spreadsheet.');
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async (m?: SheetsMapping) => {
    if (!meta) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/sheets/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_id: meta.id,
          sheet_title: sheetTitle,
          mapping: m ?? undefined,
          options: { timeZone, dateOrder, headerRow: 1 },
        }),
      });
      const j = (await res.json()) as {
        header?: string[];
        suggested?: SheetsMapping;
        rows?: PreviewRow[];
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (j.code === 'auth_expired') setConnected(false);
        throw new Error(j.error ?? 'Preview failed.');
      }
      setHeader(j.header ?? []);
      setMapping(m ?? j.suggested ?? null);
      setPreview(j.rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const revalidate = async () => {
    if (mapping) await loadPreview(mapping);
  };

  const runImport = async () => {
    if (!meta || !mapping) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/sheets/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_id: meta.id,
          spreadsheet_title: meta.title,
          sheet_title: sheetTitle,
          mapping,
          options: { timeZone, dateOrder, headerRow: 1, sheetTitle },
        }),
      });
      let st = (await res.json()) as ImportState & { error?: string };
      if (!res.ok) throw new Error(st.error ?? 'Import failed.');
      setImportState(st);
      while (st.status === 'running') {
        await new Promise((r) => setTimeout(r, 500));
        const c = await fetch('/api/sheets/import', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ import_id: st.import_id }),
        });
        st = (await c.json()) as ImportState & { error?: string };
        if (!c.ok) throw new Error(st.error ?? 'Import failed.');
        setImportState(st);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const setCol = (field: keyof SheetsMapping, col: number | null) =>
    setMapping((m) => (m ? { ...m, [field]: col } : m));

  const validCount = preview?.filter((r) => r.ok).length ?? 0;
  const invalidCount = preview ? preview.length - validCount : 0;

  return (
    <div className="mt-4 space-y-4">
      <section className="card p-5" aria-label="Google Sheets connection">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E8E3E] text-xl text-white" aria-hidden="true">▦</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Google Sheets</span>
            <span className="block text-xs text-muted">
              {connected === null ? 'Checking…' : connected ? 'Connected' : 'Bulk import posts from a spreadsheet'}
            </span>
          </span>
          {connected ? (
            <button type="button" onClick={() => void disconnect()} disabled={busy} className="btn btn-ghost">
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={connect} disabled={busy || connected === null} className="btn btn-primary">
              {busy ? 'Connecting…' : 'Connect Google'}
            </button>
          )}
        </div>
      </section>

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}

      {connected ? (
        <>
          <section className="card p-5" aria-label="Pick a spreadsheet">
            <h2 className="font-display text-base font-extrabold tracking-tight">Paste a spreadsheet link</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="field flex-1"
                aria-label="Spreadsheet URL or ID"
                inputMode="url"
              />
              <button type="button" onClick={() => void openSheet()} disabled={busy} className="btn btn-primary">
                {busy ? 'Opening…' : 'Open'}
              </button>
            </div>
            {meta ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{meta.title}</span>
                {meta.sheets.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => {
                      setSheetTitle(s.title);
                      setPreview(null);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                      sheetTitle === s.title ? 'bg-ink text-paper' : 'bg-surface text-soft hover:bg-line'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {meta ? (
            <section className="card p-5" aria-label="Date options and mapping">
              <h2 className="font-display text-base font-extrabold tracking-tight">Options</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-soft">Timezone for naive dates</span>
                  <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="field !py-2 !text-sm" aria-label="Timezone" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-soft">Ambiguous dates (01/02/2026)</span>
                  <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'auto' | 'dmy' | 'mdy')} className="field !py-2 !text-sm" aria-label="Date order">
                    <option value="auto">Day first (auto)</option>
                    <option value="dmy">Day/Month/Year</option>
                    <option value="mdy">Month/Day/Year</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-soft">Header row</span>
                  <input type="number" min={1} defaultValue={1} disabled className="field !py-2 !text-sm" aria-label="Header row (fixed at 1)" />
                </label>
              </div>

              {header.length > 0 ? (
                <>
                  <h3 className="mt-5 font-display text-sm font-extrabold">Column mapping</h3>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    {FIELDS.map((f) => (
                      <label key={String(f.key)} className="block">
                        <span className="mb-1 block text-xs font-bold text-soft">
                          {f.label}
                          {f.required ? ' (required)' : ''}
                        </span>
                        <select
                          value={mapping && f.key !== 'statusMap' ? String(mapping[f.key as keyof SheetsMapping] ?? '') : ''}
                          onChange={(e) => setCol(f.key as keyof SheetsMapping, e.target.value === '' ? null : Number(e.target.value))}
                          className="field !py-2 !text-sm"
                        >
                          <option value="">— none —</option>
                          {header.map((h, i) => (
                            <option key={i} value={i}>
                              {COLS[i] ?? `col${i}`} · {h || '(untitled)'}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={() => void loadPreview(mapping ?? undefined)} disabled={busy} className="btn btn-primary mt-4">
                    {busy ? 'Validating…' : 'Validate rows'}
                  </button>
                </>
              ) : null}
            </section>
          ) : null}

          {preview ? (
            <section className="card p-5" aria-label="Validation report">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-extrabold tracking-tight">
                  {validCount} valid · {invalidCount} need changes
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void revalidate()} disabled={busy} className="btn btn-ghost">
                    Re-validate
                  </button>
                  {validCount > 0 ? (
                    <button type="button" onClick={() => void runImport()} disabled={busy} className="btn btn-bolt">
                      {busy ? 'Importing…' : `Import ${validCount} post${validCount === 1 ? '' : 's'}`}
                    </button>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
                {preview.map((r) => (
                  <li key={r.row} className={`rounded-xl border px-3 py-2 text-sm ${r.ok ? 'border-line' : 'border-[#E8B4B4] bg-[#FDF3F3] dark:bg-[#2c1b1b]'}`}>
                    <span className="text-xs font-bold text-faint">Row {r.row}</span>
                    {r.ok ? (
                      <>
                        <p className="truncate font-bold">{r.draft?.title || '(no title)'}</p>
                        <p className="text-[11px] text-faint">
                          {r.draft?.channels.length ?? 0} channel(s){r.draft?.scheduled_at ? ` · ${new Date(r.draft.scheduled_at).toLocaleString()}` : ' · draft'}
                          {r.draft?.media_count ? ` · ${r.draft.media_count} media` : ''}
                        </p>
                        {(r.draft?.warnings ?? []).map((w) => (
                          <p key={w} className="text-[11px] font-bold text-[#8a6d1a]">{w}</p>
                        ))}
                      </>
                    ) : (
                      r.errors.map((e) => (
                        <p key={e} className="text-xs font-bold text-[#9F2F2D]">❌ {e}</p>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {importState && importState.status !== 'running' ? (
            <section className="card p-5" aria-label="Import results">
              <h2 className="font-display text-base font-extrabold tracking-tight">Import complete</h2>
              <p className="mt-1 text-sm">
                <span className="font-bold">{importState.result?.imported ?? 0} imported</span> ·{' '}
                {importState.result?.duplicates ?? 0} already imported · {importState.result?.changed ?? 0} changed upstream ·{' '}
                {importState.result?.failed ?? 0} need attention
              </p>
              {(importState.result?.errors ?? []).length > 0 ? (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-muted">
                  {(importState.result?.errors ?? []).slice(0, 20).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => router.push('/post')} className="btn btn-primary">
                  View imported posts
                </button>
                <button type="button" onClick={() => { setImportState(null); setPreview(null); }} className="btn btn-ghost">
                  Import another sheet
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
