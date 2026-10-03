'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { THEME_CLASS } from '@/components/ThemeScope';
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
  { id: 'drive', label: 'Google Drive', note: 'Your files + shared folders', icon: 'drive' },
  { id: 'gphotos', label: 'Google Photos', note: 'Your photo library', icon: 'gphotos' },
  { id: 'dropbox', label: 'Dropbox', note: 'Your Dropbox files', icon: 'dropbox' },
  { id: 'pexels', label: 'Pexels', note: 'Photos + videos, free to use', icon: 'pexels' },
  { id: 'unsplash', label: 'Unsplash', note: 'Photos · credit auto-added', icon: 'unsplash' },
] as const;

const SOON = [
  { label: 'OneDrive', note: 'Coming soon', icon: 'onedrive' },
  { label: 'Canva', note: 'Coming soon', icon: 'canva' },
];

/** Row icons — inline SVG, currentColor, sized for the 24px slot. */
const ROW_ICONS: Record<string, React.ReactNode> = {
  local: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="9" cy="9" r="1.7" />
      <path d="M21 15.5 16.5 11 7 20.5" />
    </svg>
  ),
  drive: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.31 2.5 15.7 15.25l2.49-4.31L10.79 2.5H8.31ZM2.5 13.17l3.65 6.33h11.19l3.66-6.33h-4.98l-1.6 2.77H7.09L5.48 13.17H2.5Z" transform="scale(0.92) translate(1,1)" />
    </svg>
  ),
  gphotos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 4.5a7.5 7.5 0 0 1 7.5 7.5" />
      <path d="M12 19.5A7.5 7.5 0 0 1 4.5 12" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
  dropbox: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 2 12 5.9 6 9.8 0 5.9 6 2Zm12 0 6 3.9-6 3.9-6-3.9L18 2ZM0 13.7l6-3.9 6 3.9-6 3.9-6-3.9Zm18-3.9 6 3.9-6 3.9-6-3.9 6-3.9ZM6 18.9l6-3.9 6 3.9-6 3.9-6-3.9Z" transform="scale(0.88) translate(1.5,1)" />
    </svg>
  ),
  pexels: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 2a8 8 0 0 0-8 8c0 .34.02.67.06 1H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2.06c.04-.33.06-.66.06-1a8 8 0 0 0-4-6.93A8 8 0 0 0 14 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" />
    </svg>
  ),
  unsplash: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.5 5.5h9V0h-9v5.5Zm9 6H24v12.5H0V11.5h7.5v5.5h9v-5.5Z" />
    </svg>
  ),
  onedrive: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.4 6.5a5.6 5.6 0 0 1 5.3 3.8A4.9 4.9 0 0 1 18 20H6.3a5.3 5.3 0 0 1-1-10.5A5.6 5.6 0 0 1 13.4 6.5Z" />
    </svg>
  ),
  canva: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18c-1.5 0-2-1.2-1.2-2.2.9-1.1.4-2.8-1.2-2.8H7.5A4.5 4.5 0 0 1 3 11.5C3 6.8 7 3 12 3Z" />
    </svg>
  ),
};

const PANEL_W = 340;
const PANEL_H = 560;

/**
 * Add-media dropdown for the web composer (shared by composer + idea editors
 * via PostBox), anchored under the media button through a portal. Stock via
 * edge search fns; Drive/Photos/Dropbox via popup OAuth — tokens stay in
 * sessionStorage (device-only). Downloads resolve to Files for onAddFiles;
 * Unsplash items also return a credit line.
 */
export default function MediaSourcesDialog({
  open,
  anchor,
  onClose,
  onAttach,
  onPickLocal,
}: {
  open: boolean;
  anchor: { left: number; top: number } | null;
  onClose: () => void;
  onAttach: (files: File[], credit?: string) => void;
  onPickLocal?: () => void;
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

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

  const loadDriveInto = async (folderId?: string, q?: string) => {
    const r = await listDriveFiles(folderId, q);
    setDriveFiles(r.files);
    if (!q) setFolders(r.folders);
  };

  const loadDropboxInto = async (path?: string, q?: string) => {
    if (q) {
      setDbxFiles(await searchDropbox(q));
      setDbxFolders([]);
      return;
    }
    const r = await listDropboxFolder(path);
    setDbxFolders(r.folders);
    setDbxFiles(r.files);
  };

  const loadCloud = async (id: Source, q?: string) => {
    setBusy(true);
    setErr(null);
    try {
      if (id === 'drive') {
        await loadDriveInto(folderStack.length ? folderStack[folderStack.length - 1].id : undefined, q);
      } else if (id === 'gphotos') {
        setPhotos(await listGooglePhotos(q));
      } else if (id === 'dropbox') {
        await loadDropboxInto(dbxStack.length ? dbxStack[dbxStack.length - 1].path : undefined, q);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That source refused — try again.');
    } finally {
      setBusy(false);
    }
  };

  const openSource = (id: Source) => {
    reset();
    setSource(id);
    if (id === 'unsplash') setType('photo');
    if (id === 'drive' || id === 'gphotos' || id === 'dropbox') {
      const provider = id === 'dropbox' ? 'dropbox' : 'google';
      if (!cloudConnected(provider)) return;
      setAuthed(true);
      void loadCloud(id);
    }
  };

  const connect = async () => {
    if (!source || connecting) return;
    const provider = source === 'dropbox' ? 'dropbox' : 'google';
    setConnecting(true);
    setErr(null);
    try {
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

  const searchStock = async () => {
    if (!source || !query.trim()) return;
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
      setItems(list.map((x) => ({ ...x, source: source as 'pexels' | 'unsplash' })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const search = () => {
    if (!source || busy) return;
    if (source === 'drive' || source === 'gphotos' || source === 'dropbox') {
      void loadCloud(source, query.trim() || undefined);
      return;
    }
    void searchStock();
  };

  const pickStock = async (item: StockItem) => {
    if (downloading) return;
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
    if (downloading) return;
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
    if (downloading) return;
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
    if (downloading) return;
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
        <span className="flex aspect-square w-full items-center justify-center text-2xl text-faint">🖼</span>
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

  const menuRow = (icon: string, title: string, note: string, onClick?: () => void, disabled?: boolean) =>
    disabled ? (
      <div className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 opacity-50">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-faint [&_svg]:h-[18px] [&_svg]:w-[18px]">{ROW_ICONS[icon] ?? null}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold">{title}</span>
          <span className="block text-[11px] text-muted">{note}</span>
        </span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold text-faint">Soon</span>
      </div>
    ) : (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-paper-dim"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-paper-dim text-ink [&_svg]:h-[18px] [&_svg]:w-[18px]">{ROW_ICONS[icon] ?? null}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold">{title}</span>
          <span className="block text-[11px] text-muted">{note}</span>
        </span>
        <span aria-hidden="true" className="text-faint">›</span>
      </button>
    );

  // Anchored dropdown through a portal — ancestors with transforms would
  // trap position:fixed. Panel hangs under the button, flips above when the
  // viewport runs out below, clamped to the window edges.
  const left = Math.max(8, Math.min(anchor?.left ?? 8, window.innerWidth - PANEL_W - 8));
  const below = (anchor?.top ?? 0) + 8;
  const flip = below + PANEL_H > window.innerHeight && (anchor?.top ?? 0) > window.innerHeight / 2;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label="Add media"
        className="fixed z-[100] flex max-h-[min(560px,72vh)] w-[340px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]"
        style={flip ? { left, bottom: window.innerHeight - (anchor?.top ?? 0) + 8 } : { left, top: below }}
      >
        {source ? (
          <button
            type="button"
            onClick={() => { setSource(null); reset(); }}
            className="flex w-full shrink-0 items-center gap-1 border-b border-line-soft px-3 py-2.5 text-left text-xs font-bold text-accent-ink hover:bg-paper-dim"
          >
            ‹ {label}
          </button>
        ) : (
          <p className="shrink-0 border-b border-line-soft px-3.5 py-2.5 font-display text-sm font-extrabold">Add media</p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {!source ? (
          <div>
            {onPickLocal ? menuRow('local', 'This device', 'Photos and videos on this device', () => { onClose(); onPickLocal(); }) : null}
            {SOURCES.map((s) => menuRow(s.icon, s.label, s.note, () => openSource(s.id)))}
            <div className="mx-1 my-1 h-px bg-line-soft" aria-hidden="true" />
            {SOON.map((s) => menuRow(s.icon, s.label, s.note, undefined, true))}
          </div>
        ) : (
          <div>
            {isCloud && !authed ? (
              <div className="py-6 text-center">
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
                  className="btn btn-primary mx-auto mt-3 !py-2 !text-sm"
                >
                  {connecting ? 'Connecting…' : source === 'dropbox' ? 'Connect Dropbox' : 'Connect Google'}
                </button>
                {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    className="field min-w-0 flex-1 !py-1.5 !text-sm"
                  />
                  <button type="button" onClick={search} disabled={busy} className="btn btn-primary !px-3 !py-1.5 !text-sm">
                    {busy ? '…' : 'Go'}
                  </button>
                </div>
                {source === 'pexels' ? (
                  <div className="mt-1.5 flex gap-1.5">
                    {(['photo', 'video'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          type === t ? 'border-ink bg-ink text-paper' : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {t === 'photo' ? 'Photos' : 'Videos'}
                      </button>
                    ))}
                  </div>
                ) : null}
                {source === 'unsplash' ? (
                  <p className="mt-1.5 text-[11px] text-muted">Photographer credit is added to your caption automatically.</p>
                ) : null}
                {err ? <p className="mt-1.5 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

                {source === 'drive' && folders.length > 0 && !query.trim() ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {folderStack.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = folderStack.slice(0, -1);
                          setFolderStack(next);
                          setQuery('');
                          void loadDriveInto(next.length ? next[next.length - 1].id : undefined);
                        }}
                        className="rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-paper-dim"
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
                          void loadDriveInto(f.id);
                        }}
                        className="max-w-[160px] truncate rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-paper-dim"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {source === 'dropbox' && dbxFolders.length > 0 && !query.trim() ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {dbxStack.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = dbxStack.slice(0, -1);
                          setDbxStack(next);
                          setQuery('');
                          void loadDropboxInto(next.length ? next[next.length - 1].path : undefined);
                        }}
                        className="rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-paper-dim"
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
                          void loadDropboxInto(f.path);
                        }}
                        className="max-w-[160px] truncate rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-paper-dim"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 grid grid-cols-3 gap-1.5">
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
    </>,
    // Portal inside the dashboard's theme scope so .theme-dark variables
    // apply; document.body would strand the panel outside dark mode.
    document.querySelector('[data-theme-root]') ?? document.body,
  );
}
