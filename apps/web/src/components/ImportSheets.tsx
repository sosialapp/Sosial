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
import { ImportConnection, ImportSteps } from './ImportParts';
import { useT } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { importerMessages } from '@/lib/i18n/importer';

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
/** label is a dictionary key. */
const FIELDS: { key: keyof SheetsMapping | 'statusMap'; label: string; required?: boolean }[] = [
  { key: 'contentCol', label: 'sfContent', required: true },
  { key: 'dateCol', label: 'sfDate' },
  { key: 'platformCol', label: 'sfPlatform' },
  { key: 'titleCol', label: 'sfTitle' },
  { key: 'mediaCol', label: 'sfMedia' },
  { key: 'statusCol', label: 'sfStatus' },
  { key: 'tagsCol', label: 'sfTags' },
];

function extractSpreadsheetId(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(input.trim())) return input.trim();
  return null;
}

export default function ImportSheets({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const t = useT(importerMessages);
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
    // Client id comes from oauth-config (public ids served by the edge fn -
    // the same source the media pickers use); no client secret client-side.
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: config } = await sb.functions.invoke('oauth-config', { method: 'GET' });
        const clientId =
          (config as { youtube?: { client_id?: string } } | null)?.youtube?.client_id ?? '';
        if (!clientId) {
          setErr(t('sNotConfigured'));
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
        setErr(t('sStartFail'));
        return;
      }
    })();
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; nonce?: string; ok?: boolean; code?: string; error?: string };
      if (d?.type !== 'sosial-cloud' || d.nonce !== nonce) return;
      window.removeEventListener('message', onMsg);
      if (!d.ok || !d.code) {
        setErr(d.error ?? t('sCancelled'));
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
          if (!res.ok) throw new Error(j.error ?? t('sConnectFail'));
          await loadStatus();
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : t('sConnectFail'));
        } finally {
          setBusy(false);
        }
      })();
    };
    window.addEventListener('message', onMsg);
  };

  const disconnect = async () => {
    if (!window.confirm(t('sDisconnectQ'))) return;
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
      setErr(t('sBadLink'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sheets/meta?id=${encodeURIComponent(id)}`);
      const j = (await res.json()) as SheetMeta & { error?: string; code?: string };
      if (!res.ok) {
        if (j.code === 'auth_expired') setConnected(false);
        throw new Error(j.error ?? t('sOpenFail'));
      }
      setMeta(j);
      setSheetTitle(j.sheets[0]?.title ?? 'Sheet1');
      setPreview(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('sOpenFail'));
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
        throw new Error(j.error ?? t('previewFail'));
      }
      setHeader(j.header ?? []);
      setMapping(m ?? j.suggested ?? null);
      setPreview(j.rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('previewFail'));
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
      if (!res.ok) throw new Error(st.error ?? t('importFail'));
      setImportState(st);
      while (st.status === 'running') {
        await new Promise((r) => setTimeout(r, 500));
        const c = await fetch('/api/sheets/import', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ import_id: st.import_id }),
        });
        st = (await c.json()) as ImportState & { error?: string };
        if (!c.ok) throw new Error(st.error ?? t('importFail'));
        setImportState(st);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('importFail'));
    } finally {
      setBusy(false);
    }
  };

  const setCol = (field: keyof SheetsMapping, col: number | null) =>
    setMapping((m) => (m ? { ...m, [field]: col } : m));

  const validCount = preview?.filter((r) => r.ok).length ?? 0;
  const invalidCount = preview ? preview.length - validCount : 0;

  return (
    <div className="mt-5 space-y-4">
      <ImportConnection
        mark="sheets"
        name="Google Sheets"
        status={connected === null ? t('checking') : connected ? t('connected') : t('sStatusIdle')}
        connected={connected}
        busy={busy}
        connectLabel={t('sConnect')}
        onConnect={connect}
        onDisconnect={() => void disconnect()}
        points={[
          t('sP1'),
          t('sP2'),
          t('sP3'),
        ]}
      />

      {connected ? (
        <ImportSteps
          current={!meta ? 1 : importState ? 4 : preview ? 3 : 2}
          done={!!importState && importState.status !== 'running'}
        />
      ) : null}

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}

      {connected ? (
        <>
          <section className="card p-5" aria-label={t('sPasteTitle')}>
            <h2 className="font-display text-base font-extrabold tracking-tight">{t('sPasteTitle')}</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="field flex-1"
                aria-label={t('sUrlLabel')}
                inputMode="url"
              />
              <button type="button" onClick={() => void openSheet()} disabled={busy} className="btn btn-primary">
                {busy ? t('sOpening') : t('sOpen')}
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
            <section className="card p-5" aria-label={t('sOptionsLabel')}>
              <h2 className="font-display text-base font-extrabold tracking-tight">{t('sOptions')}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-soft">{t('sTz')}</span>
                  <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="field !py-2 !text-sm" aria-label={t('sTzLabel')} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-soft">{t('sAmbig')}</span>
                  <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'auto' | 'dmy' | 'mdy')} className="field !py-2 !text-sm" aria-label={t('sDateOrder')}>
                    <option value="auto">{t('sDayFirst')}</option>
                    <option value="dmy">{t('sDmy')}</option>
                    <option value="mdy">{t('sMdy')}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-soft">{t('sHeaderRow')}</span>
                  <input type="number" min={1} defaultValue={1} disabled className="field !py-2 !text-sm" aria-label={t('sHeaderRowFixed')} />
                </label>
              </div>

              {header.length > 0 ? (
                <>
                  <h3 className="mt-5 font-display text-sm font-extrabold">{t('sColMapping')}</h3>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    {FIELDS.map((f) => (
                      <label key={String(f.key)} className="block">
                        <span className="mb-1 block text-xs font-bold text-soft">
                          {t(f.label)}
                          {f.required ? ` ${t('sRequired')}` : ''}
                        </span>
                        <select
                          value={mapping && f.key !== 'statusMap' ? String(mapping[f.key as keyof SheetsMapping] ?? '') : ''}
                          onChange={(e) => setCol(f.key as keyof SheetsMapping, e.target.value === '' ? null : Number(e.target.value))}
                          className="field !py-2 !text-sm"
                        >
                          <option value="">{t('none')}</option>
                          {header.map((h, i) => (
                            <option key={i} value={i}>
                              {COLS[i] ?? `col${i}`} · {h || t('sUntitled')}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={() => void loadPreview(mapping ?? undefined)} disabled={busy} className="btn btn-primary mt-4">
                    {busy ? t('sValidating') : t('sValidate')}
                  </button>
                </>
              ) : null}
            </section>
          ) : null}

          {preview ? (
            <section className="card p-5" aria-label={t('sReport')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-extrabold tracking-tight">
                  {fill(t('sSummary'), { valid: validCount, invalid: invalidCount })}
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void revalidate()} disabled={busy} className="btn btn-ghost">
                    {t('sRevalidate')}
                  </button>
                  {validCount > 0 ? (
                    <button type="button" onClick={() => void runImport()} disabled={busy} className="btn btn-bolt">
                      {busy ? t('importing') : validCount === 1 ? t('sImportOne') : fill(t('sImportN'), { n: validCount })}
                    </button>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
                {preview.map((r) => (
                  <li key={r.row} className={`rounded-xl border px-3 py-2 text-sm ${r.ok ? 'border-line' : 'border-[#E8B4B4] bg-[#FDF3F3] dark:bg-[#2c1b1b]'}`}>
                    <span className="text-xs font-bold text-faint">{fill(t('sRow'), { n: r.row })}</span>
                    {r.ok ? (
                      <>
                        <p className="truncate font-bold">{r.draft?.title || t('noTitle')}</p>
                        <p className="text-[11px] text-faint">
                          {fill(t('channelsN'), { n: r.draft?.channels.length ?? 0 })}{r.draft?.scheduled_at ? ` · ${new Date(r.draft.scheduled_at).toLocaleString()}` : ` · ${t('draft')}`}
                          {r.draft?.media_count ? ` · ${fill(t('mediaN'), { n: r.draft.media_count })}` : ''}
                        </p>
                        {(r.draft?.warnings ?? []).map((w) => (
                          <p key={w} className="text-[11px] font-bold text-[#8a6d1a]">{w}</p>
                        ))}
                      </>
                    ) : (
                      r.errors.map((e) => (
                        <p key={e} className="text-xs font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{e}</p>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {importState && importState.status !== 'running' ? (
            <section className="card p-5" aria-label={t('sResults')}>
              <h2 className="font-display text-base font-extrabold tracking-tight">{t('importComplete')}</h2>
              <p className="mt-1 text-sm">
                <span className="font-bold">{fill(t('resultImported'), { n: importState.result?.imported ?? 0 })}</span> ·{' '}
                {[
                  fill(t('resultDupes'), { n: importState.result?.duplicates ?? 0 }),
                  fill(t('resultChanged'), { n: importState.result?.changed ?? 0 }),
                  fill(t('resultAttention'), { n: importState.result?.failed ?? 0 }),
                ].join(' · ')}
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
                  {t('viewImported')}
                </button>
                <button type="button" onClick={() => { setImportState(null); setPreview(null); }} className="btn btn-ghost">
                  {t('sImportAnother')}
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
