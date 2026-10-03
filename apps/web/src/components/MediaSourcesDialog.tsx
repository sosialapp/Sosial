'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  cloudConnected, loginCloud, getValidCloudToken,
  listDriveFiles, downloadDriveFile, type CloudDriveFile,
  listGooglePhotos, downloadGooglePhoto, type CloudPhoto,
  listDropboxFolder, searchDropbox, downloadDropboxFile, type CloudDropboxEntry,
} from '@/lib/cloudSources';

export interface StockItem {
  id: string;
  kind: 'image' | 'video';
  thumb: string;
  full: string;
  author: string;
  authorUrl: string;
  source: 'pexels' | 'unsplash';
}

type Source = 'drive' | 'gphotos' | 'dropbox' | 'pexels' | 'unsplash';

const SOURCES = [
  { id: 'drive', label: 'Google Drive', note: 'Your files + shared folders' },
  { id: 'gphotos', label: 'Google Photos', note: 'Your photo library' },
  { id: 'dropbox', label: 'Dropbox', note: 'Your Dropbox files' },
  { id: 'pexels', label: 'Pexels', note: 'Photos + videos, free to use' },
  { id: 'unsplash', label: 'Unsplash', note: 'Photos · credit auto-added' },
] as const;

const SOON = [
  { label: 'OneDrive', note: 'Coming soon' },
  { label: 'Canva', note: 'Coming soon' },
];

/**
 * Add-media dialog for the web composer (shared by composer + idea editors
 * via PostBox). Stock via edge search fns; Drive/Photos/Dropbox via popup
 * OAuth — tokens stay in sessionStorage (device-only). Downloads resolve to
 * Files for onAddFiles; Unsplash items also return a credit line.
 */
export default function MediaSourcesDialog({
  open,
  onClose,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  onAttach: (files: File[], credit?: string) => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'photo' | 'video'>('photo');
  const [items, setItems] = useState<StockItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Cloud
  const [authed, setAuthed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [driveFiles, setDriveFiles] = useState<CloudDriveFile[]>([]);
  const [photos, setPhotos] = useState<CloudPhoto[]>([]);
  const [dbxFolders, setDbxFolders] = useState<CloudDropboxEntry[]>([]);
  const [dbxStack, setDbxStack] = useState<{ name: string; path: string }[]>([]);
  const [dbxFiles, setDbxFiles] = useState<CloudDropboxEntry[]>([]);

  if (!open) return null;

  const reset = () => {
    setItems([]);
    setQuery('');
    setErr(null);
    setDriveFiles([]);
    setPhotos([]);
    setFolders([]);
    setFolderStack([]);
    setDbxFolders([]);
    setDbxFiles([]);
    setDbxStack([]);
    setAuthed(false);
  };

  const openSource = async (id: Source) => {
    reset();
    setSource(id);
    if (id === 'unsplash') setType('photo');
    if (id === 'drive' || id === 'gphotos' || id === 'dropbox') {
      const provider = id === 'dropbox' ? 'dropbox' : 'google';
      if (!cloudConnected(provider)) return;
      setAuthed(true);
      await loadCloud(id);
    }
  };

  const loadCloud = async (id: Source, q?: string) => {
    setBusy(true);
    setErr(null);
    try {
      if (id === 'drive') {
        const r = await listDriveFiles(
          folderStack.length ? folderStack[folderStack.length - 1].id : undefined,
          q,
        );
        setDriveFiles(r.files);
        if (!q) setFolders(r.folders);
      } else if (id === 'gphotos') {
        setPhotos(await listGooglePhotos(q));
      } else if (id === 'dropbox') {
        if (q) {
          setDbxFiles(await searchDropbox(q));
          setDbxFolders([]);
        } else {
          const r = await listDropboxFolder(dbxStack.length ? dbxStack[dbxStack.length - 1].path : undefined);
          setDbxFolders(r.folders);
          setDbxFiles(r.files);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That source refused — try again.');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!source || connecting) return;
    const provider = source === 'dropbox' ? 'dropbox' : 'google';
    setConnecting(true);
    setErr(null);
    try {
      // Touch the token once so a stale refresh surfaces here, not on list.
      const ok = await loginCloud(provider);
      if (!ok) {
        setErr('Sign-in was cancelled.');
        return;
      }
      await getValidCloudToken(provider);
      setAuthed(true);
      await loadCloud(source);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setConnecting(false);
    }
  };

  const search = async () => {
    if (!source || busy) return;
    if (source === 'drive' || source === 'gphotos' || source === 'dropbox') {
      if (!query.trim()) {
        // Empty search = reload the current folder.
        if (source === 'drive') await loadCloud(source);
        else if (source === 'gphotos') await loadCloud(source);
        else await loadCloud(source);
        return;
      }
      await loadCloud(source, query.trim());
      return;
    }
    if (!query.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = await createClient();
      const fn = source === 'pexels' ? 'pexels-search' : 'unsplash-search';
      const { data, error } = await sb.functions.invoke(fn, {
        body: { query: query.trim(), type: source === 'pexels' ? type : 'photo', per_page: 12 },
      });
      if (error) throw new Error(error.message);
      const list = (Array.isArray((data as any)?.items) ? (data as any).items : []) as StockItem[];
      setItems(list.map((x) => ({ ...x, source })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const pickStock = async (item: StockItem) => {
    setDownloading(item.id);
    try {
      const r = await fetch(item.full);
      if (!r.ok) throw new Error('Download failed — try another one.');
      const blob = await r.blob();
      const ext = item.kind === 'video' ? 'mp4' : 'jpg';
      const file = new File([blob], `stock-${item.source}-${item.id}.${ext}`, {
        type: item.kind === 'video' ? 'video/mp4' : 'image/jpeg',
      });
      const credit =
        item.source === 'unsplash' ? `📷 ${item.author} on Unsplash (${item.authorUrl})` : undefined;
      onAttach([file], credit);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not attach.');
    } finally {
      setDownloading(null);
    }
  };

  const pickDrive = async (f: CloudDriveFile) => {
    setDownloading(f.id);
    try {
      onAttach([await downloadDriveFile(f)]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not attach.');
    } finally {
      setDownloading(null);
    }
  };

  const pickPhoto = async (p: CloudPhoto) => {
    setDownloading(p.id);
    try {
      onAttach([await downloadGooglePhoto(p)]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not attach.');
    } finally {
      setDownloading(null);
    }
  };

  const pickDropbox = async (f: CloudDropboxEntry) => {
    setDownloading(f.path);
    try {
      onAttach([await downloadDropboxFile(f)]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not attach.');
    } finally {
      setDownloading(null);
    }
  };

  const isCloud = source === 'drive' || source === 'gphotos' || source === 'dropbox';
  const label = SOURCES.find((s) => s.id === source)?.label ?? '';
  const placeholder =
    source === 'drive' ? 'Search Drive…' : source === 'gphotos' ? 'Search Photos…' : source === 'dropbox' ? 'Search Dropbox…' : 'Search stock…';

  const cellFor = (cellId: string, thumb: string | undefined, name: string, kind: 'image' | 'video', onPick: () => void) => (
    <button
      key={cellId}
      type="button"
      onClick={onPick}
      className="group relative overflow-hidden rounded-xl border border-line bg-paper-dim text-left"
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={name} loading="lazy" className="aspect-square w-full object-cover" />
      ) : (
        <span className="flex aspect-square w-full items-center justify-center text-2xl text-faint">
          {kind === 'video' ? '▶' : '🖼'}
        </span>
      )}
      {kind === 'video' ? (
        <span className="absolute top-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">▶</span>
      ) : null}
      {downloading === cellId ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">…</span>
      ) : null}
      <span className="block truncate px-1.5 py-1 text-[10px] text-muted">{name}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Add media"
    >
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div className="relative mx-auto my-8 w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-extrabold">Add media</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted hover:text-ink">
            ✕
          </button>
        </div>

        {!source ? (
          <div className="mt-4 space-y-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void openSource(s.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left transition hover:border-ink"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{s.label}</span>
                  <span className="block text-xs text-muted">{s.note}</span>
                </span>
                <span aria-hidden="true" className="text-faint">›</span>
              </button>
            ))}
            {SOON.map((s) => (
              <div
                key={s.label}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 opacity-55"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{s.label}</span>
                  <span className="block text-xs text-muted">{s.note}</span>
                </span>
                <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-faint">Soon</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => { setSource(null); reset(); }}
              className="text-xs font-bold text-accent-ink"
            >
              ‹ {label}
            </button>

            {isCloud && !authed ? (
              <div className="py-7 text-center">
                <p className="text-sm font-bold">
                  {source === 'drive'
                    ? 'Connect Google Drive to browse your files.'
                    : source === 'dropbox'
                      ? 'Connect Dropbox to browse your files.'
                      : 'Connect Google Photos to browse your library.'}
                </p>
                <p className="mt-1 text-xs text-muted">Read-only access · tokens stay in this browser.</p>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={connecting}
                  className="btn btn-primary mx-auto mt-4 !text-sm"
                >
                  {connecting ? 'Connecting…' : source === 'dropbox' ? 'Connect Dropbox' : 'Connect Google'}
                </button>
                {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
              </div>
            ) : (
              <>
                <div className="mt-2 flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    className="field min-w-0 flex-1 !text-sm"
                  />
                  <button type="button" onClick={() => void search()} disabled={busy} className="btn btn-primary !py-2 !text-sm">
                    {busy ? '…' : 'Go'}
                  </button>
                </div>
                {source === 'pexels' ? (
                  <div className="mt-2 flex gap-1.5">
                    {(['photo', 'video'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                          type === t ? 'border-ink bg-ink text-paper' : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {t === 'photo' ? 'Photos' : 'Videos'}
                      </button>
                    ))}
                  </div>
                ) : null}
                {source === 'unsplash' ? (
                  <p className="mt-2 text-[11px] text-muted">Photographer credit is added to your caption automatically.</p>
                ) : null}
                {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

                {source === 'drive' && folders.length > 0 && !query.trim() ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {folderStack.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = folderStack.slice(0, -1);
                          setFolderStack(next);
                          setQuery('');
                          void (async () => {
                            const r = await listDriveFiles(next.length ? next[next.length - 1].id : undefined);
                            setDriveFiles(r.files);
                            setFolders(r.folders);
                          })();
                        }}
                        className="rounded-full border border-line px-3 py-1.5 text-xs font-bold"
                      >
                        ↑ Up
                      </button>
                    ) : null}
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setFolderStack([...folderStack, f]);
                          setQuery('');
                          void (async () => {
                            const r = await listDriveFiles(f.id);
                            setDriveFiles(r.files);
                            setFolders(r.folders);
                          })();
                        }}
                        className="max-w-[180px] truncate rounded-full border border-line px-3 py-1.5 text-xs font-bold"
                      >
                        📁 {f.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {source === 'dropbox' && dbxFolders.length > 0 && !query.trim() ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dbxStack.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = dbxStack.slice(0, -1);
                          setDbxStack(next);
                          setQuery('');
                          void (async () => {
                            const r = await listDropboxFolder(next.length ? next[next.length - 1].path : undefined);
                            setDbxFolders(r.folders);
                            setDbxFiles(r.files);
                          })();
                        }}
                        className="rounded-full border border-line px-3 py-1.5 text-xs font-bold"
                      >
                        ↑ Up
                      </button>
                    ) : null}
                    {dbxFolders.map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => {
                          setDbxStack([...dbxStack, { name: f.name, path: f.path }]);
                          setQuery('');
                          void (async () => {
                            const r = await listDropboxFolder(f.path);
                            setDbxFolders(r.folders);
                            setDbxFiles(r.files);
                          })();
                        }}
                        className="max-w-[180px] truncate rounded-full border border-line px-3 py-1.5 text-xs font-bold"
                      >
                        📁 {f.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {source === 'drive'
                    ? driveFiles.map((f) => cellFor(f.id, f.thumb, f.name, f.kind, () => void pickDrive(f)))
                    : source === 'gphotos'
                      ? photos.map((p) => cellFor(p.id, p.thumb, p.kind === 'video' ? 'Video' : 'Photo', p.kind, () => void pickPhoto(p)))
                      : source === 'dropbox'
                        ? dbxFiles.map((f) => cellFor(f.path, f.thumb, f.name, f.kind === 'folder' ? 'image' : f.kind, () => void pickDropbox(f)))
                        : items.map((item) => cellFor(item.id, item.thumb, item.author, item.kind, () => void pickStock(item)))}
                </div>
                {!busy && source === 'drive' && driveFiles.length === 0 ? (
                  <p className="mt-3 text-center text-xs text-faint">{query ? 'No matches in this folder.' : 'No images or videos here yet.'}</p>
                ) : null}
                {!busy && source === 'gphotos' && photos.length === 0 ? (
                  <p className="mt-3 text-center text-xs text-faint">{query ? 'No matches.' : 'Your newest photos will appear here.'}</p>
                ) : null}
                {!busy && source === 'dropbox' && dbxFiles.length === 0 ? (
                  <p className="mt-3 text-center text-xs text-faint">{query ? 'No matches in your Dropbox.' : 'No images or videos in this folder.'}</p>
                ) : null}
                {!busy && !isCloud && items.length === 0 ? (
                  <p className="mt-3 text-center text-xs text-faint">Search above to browse stock.</p>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
