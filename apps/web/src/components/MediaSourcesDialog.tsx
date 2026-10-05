'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BRAND_MARKS, LOCAL_ICON } from '@/components/SourceMarks';
import { createClient } from '@/lib/supabase/client';
import {
  cloudConnected, loginCloud, getValidCloudToken, invokeStock, disconnectCloud,
  listDriveFiles, downloadDriveFile, type CloudDriveFile,
  listGooglePhotos, downloadGooglePhoto, type CloudPhoto,
  listDropboxFolder, searchDropbox, downloadDropboxFile, type CloudDropboxEntry,
  listCanvaDesigns, downloadCanvaDesign, type CloudCanvaDesign,
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

type Source = 'drive' | 'gphotos' | 'dropbox' | 'canva' | 'unsplash';

const SOURCES = [
  { id: 'drive', label: 'Google Drive', icon: 'drive' },
  { id: 'gphotos', label: 'Google Photos', icon: 'gphotos' },
  { id: 'dropbox', label: 'Dropbox', icon: 'dropbox' },
  { id: 'canva', label: 'Canva', icon: 'canva' },
  { id: 'unsplash', label: 'Unsplash', icon: 'unsplash' },
] as const;

const SOON = [
  { label: 'OneDrive', icon: 'onedrive' },
];

const PANEL_W = 384;
const PANEL_H = 480;

/**
 * Add-media dropdown for the web composer (shared by composer + idea editors
 * via PostBox), anchored under the media button through a portal. Stock via
 * edge search fns; Drive/Photos/Dropbox via popup OAuth — tokens stay in
 * localStorage (this browser only). Downloads resolve to Files for onAddFiles;
 * Unsplash items also return a credit line.
 */
export default function MediaSourcesDialog({
  open,
  getAnchor,
  onClose,
  onAttach,
  onPickLocal,
}: {
  open: boolean;
  /** Live anchor — called on every scroll/resize so the panel sticks to the button. */
  getAnchor: () => { left: number; topEdge: number; bottom: number } | null;
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
  // Canva
  const [canvaFolders, setCanvaFolders] = useState<{ id: string; name: string }[]>([]);
  const [canvaStack, setCanvaStack] = useState<{ id: string; name: string }[]>([]);
  const [canvaDesigns, setCanvaDesigns] = useState<CloudCanvaDesign[]>([]);
  const [canvaKind, setCanvaKind] = useState<'image' | 'video'>('image');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Follow mode: re-anchor the panel to the button on any page scroll or
  // resize so it never floats away. rAF-throttled; panel-internal scrolls
  // are contained (overscroll) and don't move the anchor anyway.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    let queued = false;
    const onMove = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setTick((t) => t + 1);
      });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
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
    setCanvaFolders([]);
    setCanvaDesigns([]);
    setCanvaStack([]);
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
      } else if (id === 'canva') {
        const r = await listCanvaDesigns(canvaStack.length ? canvaStack[canvaStack.length - 1].id : undefined, q);
        setCanvaDesigns(r.designs);
        if (!q) setCanvaFolders(r.folders);
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
    if (id === 'drive' || id === 'gphotos' || id === 'dropbox' || id === 'canva') {
      const provider = id === 'dropbox' ? 'dropbox' : id === 'canva' ? 'canva' : 'google';
      if (!cloudConnected(provider)) return;
      setAuthed(true);
      void loadCloud(id);
    }
  };

  const disconnectSource = () => {
    if (!source || !isCloud) return;
    const provider = source === 'dropbox' ? 'dropbox' : source === 'canva' ? 'canva' : 'google';
    if (!window.confirm(`Disconnect ${label}? This forgets the login in this browser. Your files stay untouched.`)) return;
    disconnectCloud(provider);
    setAuthed(false);
    reset();
  };

  const connect = async () => {
    if (!source || connecting) return;
    const provider = source === 'dropbox' ? 'dropbox' : source === 'canva' ? 'canva' : 'google';
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
    if (source !== 'unsplash' || !query.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await invokeStock('unsplash-search', {
        query: query.trim(),
        type: 'photo',
        per_page: 12,
      });
      const list = (Array.isArray((data as any)?.items) ? (data as any).items : []) as StockItem[];
      setItems(list.map((x) => ({ ...x, source: 'unsplash' })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const search = () => {
    if (!source || busy) return;
    if (source === 'drive' || source === 'gphotos' || source === 'dropbox' || source === 'canva') {
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
      const file = new File([blob], `unsplash-${item.id}.jpg`, { type: 'image/jpeg' });
      const credit = `📷 ${item.author} on Unsplash (${item.authorUrl})`;
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

  const pickCanva = async (d: CloudCanvaDesign) => {
    if (downloading) return;
    setDownloading(d.id);
    try {
      onAttach([await downloadCanvaDesign(d, canvaKind)]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not attach.');
    } finally {
      setDownloading(null);
    }
  };

  const isCloud = source === 'drive' || source === 'gphotos' || source === 'dropbox' || source === 'canva';
  const label = SOURCES.find((s) => s.id === source)?.label ?? '';
  const placeholder =
    source === 'drive' ? 'Search Drive…' : source === 'gphotos' ? 'Search Photos…' : source === 'dropbox' ? 'Search Dropbox…' : source === 'canva' ? 'Search designs…' : 'Search stock…';

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

  const menuRow = (icon: React.ReactNode, title: string, onClick?: () => void, disabled?: boolean) =>
    disabled ? (
      <div className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 opacity-45">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <span className="min-w-0 flex-1 text-xs font-bold">{title}</span>
        <span className="rounded-full border border-line px-1.5 py-px text-[9px] font-bold text-faint">Soon</span>
      </div>
    ) : (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-paper-dim"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-ink [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <span className="min-w-0 flex-1 text-xs font-bold">{title}</span>
        <span aria-hidden="true" className="text-xs text-faint">›</span>
      </button>
    );

  // Anchored dropdown through a portal — ancestors with transforms would
  // trap position:fixed. Re-read the live anchor every render (tick bumps on
  // scroll/resize) so the panel sticks to the button. Flips above when the
  // viewport runs out below, clamped to the window edges.
  void tick;
  const a = getAnchor();
  const left = Math.max(8, Math.min(a?.left ?? 8, window.innerWidth - PANEL_W - 8));
  const below = a?.bottom ? a.bottom + 8 : (a?.topEdge ?? 0) + 8;
  const flip = below + PANEL_H > window.innerHeight && (a?.bottom ?? 0) > window.innerHeight / 2;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label="Add media"
        className="fixed z-[100] flex max-h-[min(480px,70vh)] w-[384px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]"
        style={flip ? { left, bottom: window.innerHeight - (a?.bottom ?? 0) + 8 } : { left, top: below }}
      >
        {source ? (
          <div className="flex shrink-0 items-center justify-between border-b border-line-soft">
            <button
              type="button"
              onClick={() => { setSource(null); reset(); }}
              className="flex items-center gap-1 px-3 py-2 text-left text-xs font-bold text-accent-ink hover:bg-paper-dim"
            >
              ‹ {label}
            </button>
            {isCloud && authed ? (
              <button
                type="button"
                onClick={disconnectSource}
                className="px-3 py-2 text-xs font-bold text-muted hover:text-ink"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {!source ? (
          <div>
            {onPickLocal ? menuRow(LOCAL_ICON, 'This device', () => { onClose(); onPickLocal(); }) : null}
            {SOURCES.map((s) => menuRow(BRAND_MARKS[s.icon], s.label, () => openSource(s.id)))}
            <div className="mx-1 my-1 h-px bg-line-soft" aria-hidden="true" />
            {SOON.map((s) => menuRow(BRAND_MARKS[s.icon], s.label, undefined, true))}
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
                      : source === 'canva'
                        ? 'Connect Canva to browse your designs.'
                        : 'Connect Google Photos to browse your library.'}
                </p>
                <p className="mt-1 text-xs text-muted">Read-only access · tokens stay in this browser.</p>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={connecting}
                  className="btn btn-primary mx-auto mt-4 !text-sm"
                >
                  {connecting ? 'Connecting…' : source === 'dropbox' ? 'Connect Dropbox' : source === 'canva' ? 'Connect Canva' : 'Connect Google'}
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
                {source === 'canva' ? (
                  <div className="mt-2 flex gap-1.5">
                    {(['photo', 'video'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => (source === 'canva' ? setCanvaKind(t === 'photo' ? 'image' : 'video') : setType(t))}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                          (source === 'canva' ? canvaKind === (t === 'photo' ? 'image' : 'video') : type === t)
                            ? 'border-ink bg-ink text-paper'
                            : 'border-line text-muted hover:text-ink'
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

                {source === 'canva' && canvaFolders.length > 0 && !query.trim() ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {canvaStack.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = canvaStack.slice(0, -1);
                          setCanvaStack(next);
                          setQuery('');
                          void (async () => {
                            const r = await listCanvaDesigns(next.length ? next[next.length - 1].id : undefined);
                            setCanvaDesigns(r.designs);
                            setCanvaFolders(r.folders);
                          })();
                        }}
                        className="rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-paper-dim"
                      >
                        ↑ Up
                      </button>
                    ) : null}
                    {canvaFolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setCanvaStack([...canvaStack, f]);
                          setQuery('');
                          void (async () => {
                            const r = await listCanvaDesigns(f.id);
                            setCanvaDesigns(r.designs);
                            setCanvaFolders(r.folders);
                          })();
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
                        : source === 'canva'
                          ? canvaDesigns.map((d) => cellFor(d.id, d.thumb, d.title, canvaKind, () => void pickCanva(d)))
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
                {!busy && source === 'canva' && canvaDesigns.length === 0 ? (
                  <p className="mt-3 text-center text-xs text-faint">{query ? 'No matching designs.' : 'Your newest designs will appear here.'}</p>
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
