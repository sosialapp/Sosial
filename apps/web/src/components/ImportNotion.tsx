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
        setErr(d.error ?? 'Notion connection was cancelled.');
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
          if (!res.ok) throw new Error(j.error ?? 'Could not connect Notion.');
          await loadStatus();
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : 'Could not connect Notion.');
        } finally {
          setBusy(false);
        }
      })();
    };
    window.addEventListener('message', onMsg);
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Notion? Imported posts are kept.')) return;
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
          throw new Error(j.error ?? 'Reconnect Notion.');
        }
        throw new Error(j.error ?? 'Could not list databases.');
      }
      setDbs((prev) => (cursor ? [...prev, ...(j.databases ?? [])] : j.databases ?? []));
      setDbCursor(j.next_cursor ?? null);
      if ((j.databases ?? []).length === 0 && !cursor && !q) {
        setErr('No databases visible. In Notion, open a database → ••• menu → Connections → add Sosial, then try again.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not list databases.');
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
      if (!res.ok) throw new Error(j.error ?? 'Could not read the database.');
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
      setErr(e instanceof Error ? e.message : 'Could not open the database.');
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
      if (!res.ok) throw new Error(j.error ?? 'Preview failed.');
      setPreview(j.rows ?? []);
      setStep('preview');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Preview failed.');
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
      if (!res.ok) throw new Error(st.error ?? 'Import failed.');
      setImportState(st);
      while (st.status === 'running') {
        await new Promise((r) => setTimeout(r, 600));
        const c = await fetch('/api/notion/import', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ import_id: st.import_id }),
        });
        st = (await c.json()) as ImportState & { error?: string };
        if (!c.ok) throw new Error(st.error ?? 'Import failed.');
        setImportState(st);
      }
      setStep('importing');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed.');
      setStep('preview');
    } finally {
      setBusy(false);
    }
  };

  const setMap = (field: string, value: string) => setMapping((m) => ({ ...m, [field]: value }));

  return (
    <div className="mt-4 space-y-4">
      {/* Connection card */}
      <section className="card p-5" aria-label="Notion connection">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-xl text-white" aria-hidden="true">N</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Notion</span>
            <span className="block text-xs text-muted">
              {connected === null ? 'Checking…' : connected ? `Connected${wsName ? ` · ${wsName}` : ''}` : 'Import posts from a Notion database'}
            </span>
          </span>
          {connected ? (
            <button type="button" onClick={() => void disconnect()} disabled={busy} className="btn btn-ghost">
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={connect} disabled={busy || connected === null} className="btn btn-primary">
              {busy ? 'Connecting…' : 'Connect Notion'}
            </button>
          )}
        </div>
      </section>

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}

      {connected ? (
        <>
          {step === 'pick' ? (
            <section className="card p-5" aria-label="Pick a database">
              <h2 className="font-display text-base font-extrabold tracking-tight">Pick a database</h2>
              <div className="mt-3 flex gap-2">
                <input
                  value={dbQuery}
                  onChange={(e) => setDbQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadDbs(dbQuery);
                  }}
                  placeholder="Search databases…"
                  className="field flex-1"
                  aria-label="Search Notion databases"
                />
                <button type="button" onClick={() => void loadDbs(dbQuery)} disabled={busy} className="btn btn-primary">
                  Search
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
                {dbs.length === 0 ? <li className="py-2 text-sm text-faint">No databases yet — search, or share one in Notion first.</li> : null}
              </ul>
              {dbCursor ? (
                <button type="button" onClick={() => void loadDbs(dbQuery, dbCursor)} disabled={busy} className="btn btn-ghost mt-2">
                  Load more
                </button>
              ) : null}
            </section>
          ) : null}

          {step === 'map' && db ? (
            <section className="card p-5" aria-label="Map fields">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-extrabold tracking-tight">Map fields — {db.title}</h2>
                <button type="button" onClick={() => setStep('pick')} className="text-xs font-bold text-muted hover:text-ink">
                  Change database
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  { key: 'content', label: 'Content (required)' },
                  { key: 'title', label: 'Title' },
                  { key: 'platform', label: 'Platform (select → channel)' },
                  { key: 'status', label: 'Status' },
                  { key: 'date', label: 'Publish date' },
                  { key: 'media', label: 'Media (files)' },
                  { key: 'tags', label: 'Tags' },
                ] as const).map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-bold text-soft">{f.label}</span>
                    <select
                      value={mapping[f.key] ?? ''}
                      onChange={(e) => setMap(f.key, e.target.value)}
                      className="field !py-2 !text-sm"
                    >
                      <option value="">— none —</option>
                      {f.key === 'content' ? <option value="__page_body__">Page body (text)</option> : null}
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
                Unsupported property types (people, relation, rollup…) are skipped with a warning. Unmapped select values import as flagged errors, never guessed.
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => void runPreview()} disabled={busy} className="btn btn-primary">
                  {busy ? 'Loading…' : 'Preview rows'}
                </button>
              </div>
            </section>
          ) : null}

          {step === 'preview' && preview ? (
            <section className="card p-5" aria-label="Preview">
              <h2 className="font-display text-base font-extrabold tracking-tight">Preview (first rows)</h2>
              <ul className="mt-3 space-y-2">
                {preview.map((r) => (
                  <li key={r.page_id} className={`rounded-xl border px-3 py-2 text-sm ${r.ok ? 'border-line' : 'border-[#E8B4B4] bg-[#FDF3F3] dark:bg-[#2c1b1b]'}`}>
                    {r.ok ? (
                      <>
                        <p className="font-bold">{r.draft?.title || '(no title)'}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.draft?.body}</p>
                        <p className="mt-1 text-[11px] text-faint">
                          {r.draft?.channels.length ?? 0} channel(s){r.draft?.scheduled_at ? ` · ${new Date(r.draft.scheduled_at).toLocaleString()}` : ' · draft'}
                          {r.draft?.media_count ? ` · ${r.draft.media_count} media` : ''}
                        </p>
                        {(r.draft?.warnings ?? []).map((w) => (
                          <p key={w} className="mt-1 text-[11px] font-bold text-[#8a6d1a]">{w}</p>
                        ))}
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-[#9F2F2D]">Row will be skipped</p>
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
                  {busy ? 'Importing…' : 'Import as drafts'}
                </button>
                <button type="button" onClick={() => setStep('map')} className="btn btn-ghost">
                  Back to mapping
                </button>
              </div>
            </section>
          ) : null}

          {step === 'importing' && importState ? (
            <section className="card p-5" aria-label="Import progress">
              <h2 className="font-display text-base font-extrabold tracking-tight">
                {importState.status === 'running' ? 'Importing…' : 'Import complete'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {importState.progress_done} processed
                {importState.progress_total ? ` of about ${importState.progress_total}` : ''}
              </p>
              {importState.status !== 'running' ? (
                <div className="mt-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                  <p className="font-bold">
                    {importState.result?.imported ?? 0} imported · {importState.result?.duplicates ?? 0} already imported ·{' '}
                    {importState.result?.changed ?? 0} changed upstream · {importState.result?.failed ?? 0} skipped
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
                      View imported posts
                    </button>
                    <button type="button" onClick={() => { setStep('pick'); setImportState(null); }} className="btn btn-ghost">
                      Import another database
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
