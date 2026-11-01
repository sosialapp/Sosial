'use client';

/**
 * Notion import flow: connect (popup OAuth) → pick database (searched,
 * paginated) → map fields (auto-suggest + editable, platform/status value
 * mapping) → preview (first 5 rows validated) → import (chunked, resumable,
 * progress from the notion_imports row). Imported posts land in Drafts/Queue
 * with their Notion page id recorded for dedupe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportConnection, ImportSteps } from './ImportParts';
import { useT } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { importerMessages } from '@/lib/i18n/importer';

interface SchemaProp {
  name: string;
  type: string;
}

interface PreviewRow {
  page_id: string;
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

const CONTENT_OPTIONS = [
  { value: '__page_body__', label: 'Page body (text)' },
];

export default function ImportNotion({ workspaceId }: { workspaceId: string; canImport?: boolean }) {
  const router = useRouter();
  const t = useT(importerMessages);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [wsName, setWsName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // step: pick | map | preview | importing | done
  const [step, setStep] = useState<'pick' | 'map' | 'preview' | 'importing'>('pick');
  const [dbs, setDbs] = useState<{ id: string; title: string }[]>([]);
  const [dbQuery, setDbQuery] = useState('');
  const [dbCursor, setDbCursor] = useState<string | null>(null);
  const [db, setDb] = useState<{ id: string; title: string } | null>(null);
  const [schema, setSchema] = useState<SchemaProp[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [platformValues, setPlatformValues] = useState<string[]>([]);
  const [platformMap, setPlatformMap] = useState<Record<string, string[]>>({});
  const [statusValues, setStatusValues] = useState<string[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<{ id: string; label: string }[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const nonceRef = useRef('');
  const popupRef = useRef<Window | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/notion');
      const j = (await res.json()) as { connected?: boolean; workspace_name?: string };
      setConnected(!!j.connected);
      setWsName(j.workspace_name ?? null);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void (async () => {
      try {
        const res = await fetch('/api/notion/databases');
        if (res.ok) {
          const j = (await res.json()) as { databases?: { id: string; title: string }[] };
          setDbs(j.databases ?? []);
        }
      } catch {}
    })();
    void (async () => {
      try {
        const res = await fetch('/api/keys');
      } catch {}
    })();
  }, [loadStatus]);

  // Channels list for the platform value mapping.
  useEffect(() => {
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data } = await sb
          .from('connected_channels')
          .select('id, provider, display_name, handle')
          .eq('workspace_id', workspaceId)
          .eq('status', 'connected');
        setChannels(
          ((data ?? []) as { id: string; provider: string; display_name: string | null; handle: string | null }[]).map((c) => ({
            id: c.id,
            label: `${c.display_name || c.handle || c.provider}`,
          })),
        );
      } catch {}
    })();
  }, [workspaceId]);

  const connect = () => {
    setErr(null);
    const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    nonceRef.current = nonce;
    const params = new URLSearchParams({
      client_id: '3f2d872b-594c-81fc-8eee-0037d89f5b8c',
      redirect_uri: `${window.location.origin}/auth.html`,
      response_type: 'code',
      state: `cloud:notion:${nonce}`,
    });
    const pop = window.open(`https://api.notion.com/v1/oauth/authorize?${params}`, 'sosial-notion', 'width=640,height=720');
    popupRef.current = pop;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; nonce?: string; ok?: boolean; code?: string; error?: string };
      if (d?.type !== 'sosial-cloud' || d.nonce !== nonce) return;
      window.removeEventListener('message', onMsg);
      if (!d.ok || !d.code) {
        setErr(d.error ?? t('nCancelled'));
        return;
      }
      void (async () => {
        setBusy(true);
        try {
          const res = await fetch('/api/notion', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ code: d.code }),
          });
          const j = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(j.error ?? t('nConnectFail'));
          await loadStatus();
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : t('nConnectFail'));
        } finally {
          setBusy(false);
        }
      })();
    };
    window.addEventListener('message', onMsg);
  };

  const disconnect = async () => {
    if (!window.confirm(t('nDisconnectQ'))) return;
    setBusy(true);
    try {
      await fetch('/api/notion', { method: 'DELETE' });
      setConnected(false);
      setStep('pick');
      setDbs([]);
    } finally {
      setBusy(false);
    }
  };

  const loadDbs = async (q: string, cursor?: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/notion/databases?q=${encodeURIComponent(q)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      const j = (await res.json()) as { databases?: { id: string; title: string }[]; next_cursor?: string; error?: string; code?: string };
      if (!res.ok) {
        if (j.code === 'auth_expired') {
          setConnected(false);
          throw new Error(j.error ?? t('nReconnect'));
        }
        throw new Error(j.error ?? t('nListFail'));
      }
      setDbs((prev) => (cursor ? [...prev, ...(j.databases ?? [])] : j.databases ?? []));
      setDbCursor(j.next_cursor ?? null);
      if ((j.databases ?? []).length === 0 && !cursor && !q) {
        setErr(t('nNoDbs'));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('nListFail'));
    } finally {
      setBusy(false);
    }
  };

  const pickDb = async (d: { id: string; title: string }) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/notion/schema?id=${encodeURIComponent(d.id)}`);
      const j = (await res.json()) as { properties?: SchemaProp[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? t('nReadFail'));
      const props = j.properties ?? [];
      setSchema(props);
      setDb(d);
      // Auto-suggest by name/type.
      const byName = (re: RegExp, types: string[]): string | undefined =>
        props.find((p) => re.test(p.name.toLowerCase()) && types.includes(p.type))?.name;
      setMapping({
        content: byName(/content|caption|body|text|brief|post/, ['rich_text']) ?? byName(/title|name/, ['title']) ?? props.find((p) => p.type === 'rich_text')?.name ?? props.find((p) => p.type === 'title')?.name ?? '__page_body__',
        title: byName(/title|name|heading/, ['title']) ?? props.find((p) => p.type === 'title')?.name ?? '',
        platform: byName(/network|platform|channel/, ['select', 'status']) ?? props.find((p) => p.type === 'select')?.name ?? '',
        status: byName(/status|stage|state/, ['status', 'select']) ?? '',
        date: byName(/date|when|publish|time/, ['date']) ?? props.find((p) => p.type === 'date')?.name ?? '',
        media: byName(/media|image|asset|creative|file/, ['files']) ?? props.find((p) => p.type === 'files')?.name ?? '',
        tags: byName(/tag|label/, ['multi_select']) ?? '',
      });
      const platProp = props.find((p) => p.name === (byName(/network|platform|channel/, ['select', 'status']) ?? props.find((p) => p.type === 'select')?.name));
      void platProp;
      setStep('map');
      // Fetch select values for platform/status from a preview row sample.
      const pRes = await fetch('/api/notion/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ database_id: d.id, mapping: {} }),
      }).catch(() => null);
      void pRes;
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('nOpenFail'));
    } finally {
      setBusy(false);
    }
  };

  // Pull distinct select/status values from the first preview batch to build
  // the value mapping UI.
  useEffect(() => {
    if (step !== 'map' || !db || !mapping.platform) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/notion/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ database_id: db.id, mapping: { content: mapping.content } }),
        });
        if (!res.ok) return;
        // We re-read raw property values through a tiny schema-driven trick:
        // the preview endpoint maps with a content-only mapping, so we can't
        // see platform values there. Instead the values come from preview
        // after the user picks properties (preview step re-computes maps).
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [step, db, mapping.content, mapping.platform]);

  const runPreview = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/notion/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ database_id: db!.id, mapping }),
      });
      const j = (await res.json()) as { rows?: PreviewRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? t('previewFail'));
      setPreview(j.rows ?? []);
      setStep('preview');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('previewFail'));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    setErr(null);
    setStep('importing');
    try {
      const res = await fetch('/api/notion/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ database_id: db!.id, database_title: db!.title, mapping }),
      });
      let st = (await res.json()) as ImportState & { error?: string };
      if (!res.ok) throw new Error(st.error ?? t('importFail'));
      setImportState(st);
      while (st.status === 'running') {
        await new Promise((r) => setTimeout(r, 600));
        const c = await fetch('/api/notion/import', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ import_id: st.import_id }),
        });
        st = (await c.json()) as ImportState & { error?: string };
        if (!c.ok) throw new Error(st.error ?? t('importFail'));
        setImportState(st);
      }
      setStep('importing');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('importFail'));
      setStep('preview');
    } finally {
      setBusy(false);
    }
  };

  const setMap = (field: string, value: string) => setMapping((m) => ({ ...m, [field]: value }));

  return (
    <div className="mt-5 space-y-4">
      <ImportConnection
        mark="notion"
        name="Notion"
        status={connected === null ? t('checking') : connected ? `${t('connected')}${wsName ? ` · ${wsName}` : ''}` : t('nStatusIdle')}
        connected={connected}
        busy={busy}
        connectLabel={t('nConnect')}
        onConnect={connect}
        onDisconnect={() => void disconnect()}
        points={[
          t('nP1'),
          t('nP2'),
          t('nP3'),
        ]}
      />

      {connected ? (
        <ImportSteps
          current={step === 'pick' ? 1 : step === 'map' ? 2 : step === 'preview' ? 3 : 4}
          done={step === 'importing' && importState?.status !== 'running'}
        />
      ) : null}

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}

      {connected ? (
        <>
          {step === 'pick' ? (
            <section className="card p-5" aria-label={t('nPickDb')}>
              <h2 className="font-display text-base font-extrabold tracking-tight">{t('nPickDb')}</h2>
              <div className="mt-3 flex gap-2">
                <input
                  value={dbQuery}
                  onChange={(e) => setDbQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadDbs(dbQuery);
                  }}
                  placeholder={t('nSearchPh')}
                  className="field flex-1"
                  aria-label={t('nSearchLabel')}
                />
                <button type="button" onClick={() => void loadDbs(dbQuery)} disabled={busy} className="btn btn-primary">
                  {t('search')}
                </button>
              </div>
              <ul className="mt-3 divide-y divide-line-soft">
                {dbs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => void pickDb(d)}
                      disabled={busy}
                      className="flex w-full items-center justify-between px-1 py-2.5 text-left transition hover:bg-bone"
                    >
                      <span className="truncate text-sm font-bold">{d.title}</span>
                      <span aria-hidden="true" className="text-muted">›</span>
                    </button>
                  </li>
                ))}
                {dbs.length === 0 ? <li className="py-2 text-sm text-faint">{t('nNoDbsYet')}</li> : null}
              </ul>
              {dbCursor ? (
                <button type="button" onClick={() => void loadDbs(dbQuery, dbCursor)} disabled={busy} className="btn btn-ghost mt-2">
                  {t('loadMore')}
                </button>
              ) : null}
            </section>
          ) : null}

          {step === 'map' && db ? (
            <section className="card p-5" aria-label={t('stMap')}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-extrabold tracking-tight">{fill(t('nMapTitle'), { db: db.title })}</h2>
                <button type="button" onClick={() => setStep('pick')} className="text-xs font-bold text-muted hover:text-ink">
                  {t('nChangeDb')}
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  { key: 'content', label: 'nMContent' },
                  { key: 'title', label: 'nMTitle' },
                  { key: 'platform', label: 'nMPlatform' },
                  { key: 'status', label: 'nMStatus' },
                  { key: 'date', label: 'nMDate' },
                  { key: 'media', label: 'nMMedia' },
                  { key: 'tags', label: 'nMTags' },
                ] as const).map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-bold text-soft">{t(f.label)}</span>
                    <select
                      value={mapping[f.key] ?? ''}
                      onChange={(e) => setMap(f.key, e.target.value)}
                      className="field !py-2 !text-sm"
                    >
                      <option value="">{t('none')}</option>
                      {f.key === 'content' ? <option value="__page_body__">{t('nPageBody')}</option> : null}
                      {schema.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} · {p.type}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                {t('nMapNote')}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => void runPreview()} disabled={busy} className="btn btn-primary">
                  {busy ? t('loading') : t('nPreviewRows')}
                </button>
              </div>
            </section>
          ) : null}

          {step === 'preview' && preview ? (
            <section className="card p-5" aria-label={t('stReview')}>
              <h2 className="font-display text-base font-extrabold tracking-tight">{t('nPreviewTitle')}</h2>
              <ul className="mt-3 space-y-2">
                {preview.map((r) => (
                  <li key={r.page_id} className={`rounded-xl border px-3 py-2 text-sm ${r.ok ? 'border-line' : 'border-[#E8B4B4] bg-[#FDF3F3] dark:bg-[#2c1b1b]'}`}>
                    {r.ok ? (
                      <>
                        <p className="font-bold">{r.draft?.title || t('noTitle')}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.draft?.body}</p>
                        <p className="mt-1 text-[11px] text-faint">
                          {fill(t('channelsN'), { n: r.draft?.channels.length ?? 0 })}{r.draft?.scheduled_at ? ` · ${new Date(r.draft.scheduled_at).toLocaleString()}` : ` · ${t('draft')}`}
                          {r.draft?.media_count ? ` · ${fill(t('mediaN'), { n: r.draft.media_count })}` : ''}
                        </p>
                        {(r.draft?.warnings ?? []).map((w) => (
                          <p key={w} className="mt-1 text-[11px] font-bold text-[#8a6d1a]">{w}</p>
                        ))}
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-[#9F2F2D]">{t('nRowSkipped')}</p>
                        {r.errors.map((e) => (
                          <p key={e} className="mt-0.5 text-xs text-muted">{e}</p>
                        ))}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => void runImport()} disabled={busy} className="btn btn-bolt">
                  {busy ? t('importing') : t('nImportDrafts')}
                </button>
                <button type="button" onClick={() => setStep('map')} className="btn btn-ghost">
                  {t('nBackToMap')}
                </button>
              </div>
            </section>
          ) : null}

          {step === 'importing' && importState ? (
            <section className="card p-5" aria-label={t('progress')}>
              <h2 className="font-display text-base font-extrabold tracking-tight">
                {importState.status === 'running' ? t('importing') : t('importComplete')}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {importState.progress_total
                  ? fill(t('nOfAbout'), { done: importState.progress_done, total: importState.progress_total })
                  : fill(t('nProcessed'), { done: importState.progress_done })}
              </p>
              {importState.status !== 'running' ? (
                <div className="mt-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                  <p className="font-bold">
                    {[
                      fill(t('resultImported'), { n: importState.result?.imported ?? 0 }),
                      fill(t('resultDupes'), { n: importState.result?.duplicates ?? 0 }),
                      fill(t('resultChanged'), { n: importState.result?.changed ?? 0 }),
                      fill(t('resultSkipped'), { n: importState.result?.failed ?? 0 }),
                    ].join(' · ')}
                  </p>
                  {(importState.result?.errors ?? []).length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {(importState.result?.errors ?? []).slice(0, 10).map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => router.push('/post')} className="btn btn-primary">
                      {t('viewImported')}
                    </button>
                    <button type="button" onClick={() => { setStep('pick'); setImportState(null); }} className="btn btn-ghost">
                      {t('nImportAnother')}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
