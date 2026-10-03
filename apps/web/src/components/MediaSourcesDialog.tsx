'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  cloudConnected, loginCloud, getValidCloudToken, invokeStock,
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

/** Real brand marks (thesvg.org, CC0) — no hand-drawn glyphs. */
const BRAND_MARKS: Record<string, React.ReactNode> = {
  drive: (
    <svg viewBox="0 0 800 742" fill="none" aria-hidden="true">
      <mask id="drv-m" maskUnits="userSpaceOnUse" x="12" y="18" width="168" height="154">
        <path fill="#fff" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001Z" />
      </mask>
      <g mask="url(#drv-m)" transform="matrix(4.8140532,0,0,4.8140532,-62.146701,-86.652356)">
        <path fill="url(#drv-y)" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578Z" />
        <path fill="url(#drv-b)" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001Z" />
        <path fill="url(#drv-g)" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048Z" />
      </g>
      <defs>
        <linearGradient id="drv-y" x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
          <stop offset=".09" stop-color="#ffe921" />
          <stop offset="1" stop-color="#fec700" />
        </linearGradient>
        <linearGradient id="drv-b" x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
          <stop offset=".15" stop-color="#a9a8ff" />
          <stop offset=".33" stop-color="#6d97ff" />
          <stop offset=".48" stop-color="#3186ff" />
        </linearGradient>
        <linearGradient id="drv-g" x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
          <stop offset=".55" stop-color="#0ebc5f" />
          <stop offset=".85" stop-color="#78c9ff" />
        </linearGradient>
      </defs>
    </svg>
  ),
  gphotos: (
    <svg viewBox="0 0 24 24" fill="#4285F4" aria-hidden="true">
      <path d="M12.678 16.672c0 2.175.002 4.565-.001 6.494-.001.576-.244.814-.817.833-7.045.078-8.927-7.871-4.468-11.334-1.95.016-4.019.007-5.986.007-1.351 0-1.414-.01-1.405-1.351.258-6.583 7.946-8.275 11.323-3.936L11.308.928c-.001-.695.212-.906.906-.925 6.409-.187 9.16 7.308 4.426 11.326l6.131.002c1.097 0 1.241.105 1.228 1.217-.223 6.723-7.802 8.376-11.321 4.124zm.002-15.284-.003 9.972c6.56-.465 6.598-9.532.003-9.972zm-1.36 21.224-.001-9.97c-6.927.598-6.29 9.726.002 9.97zM1.4 11.315l9.95.008c-.527-6.829-9.762-6.367-9.95-.008zm11.238 1.365c.682 6.875 9.67 6.284 9.977.01z" />
    </svg>
  ),
  dropbox: (
    <svg viewBox="0 0 24 24" fill="#0061FF" aria-hidden="true">
      <path d="M6 1.807 0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
    </svg>
  ),
  unsplash: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z" />
    </svg>
  ),
  onedrive: (
    <svg viewBox="0 0 1000 615" aria-hidden="true">
      <defs>
        <radialGradient id="od-a" cx="-446.23" cy="850.24" r="6.99" fx="-446.23" fy="850.24" gradientTransform="matrix(28.87975 32.00675 53.69646 -48.39975 -32750.77 55564.7)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4894fe" /><stop offset=".7" stop-color="#0934b3" /></radialGradient>
        <radialGradient id="od-b" cx="-463.71" cy="855.09" r="6.99" fx="-463.71" fy="855.09" gradientTransform="matrix(-126.93754 135.45874 101.23704 94.7798 -144561.83 -18444.24)" gradientUnits="userSpaceOnUse"><stop offset=".17" stop-color="#23c0fe" /><stop offset=".53" stop-color="#1c91ff" /></radialGradient>
        <radialGradient id="od-c" cx="-478.67" cy="847.12" r="6.99" fx="-478.67" fy="847.12" gradientTransform="matrix(-30.17956 -23.43498 -52.80172 67.93278 30509.91 -68620.88)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" /><stop offset=".66" stop-color="#adc0ff" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-d" cx="-484.89" cy="847.31" r="6.99" fx="-484.89" fy="847.31" gradientTransform="matrix(-33.90072 -26.53382 -39.69188 50.66325 17714.49 -55348.26)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#033acc" /><stop offset="1" stop-color="#368eff" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-e" cx="-454.42" cy="853.18" r="6.99" fx="-454.42" fy="853.18" gradientTransform="matrix(38.74213 82.7056 94.03873 -44.01576 -62416.51 75114.97)" gradientUnits="userSpaceOnUse"><stop offset=".59" stop-color="#3464e3" stop-opacity="0" /><stop offset="1" stop-color="#033acc" /></radialGradient>
        <radialGradient id="od-f" cx="-465.3" cy="852.63" r="6.99" fx="-465.3" fy="852.63" gradientTransform="matrix(-101.35519 93.7574 146.5162 158.24743 -171232.53 -91444.13)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4bfde8" /><stop offset=".54" stop-color="#4bfde8" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-h" cx="-445.42" cy="847.35" r="6.99" fx="-445.42" fy="847.35" gradientTransform="matrix(60.3777 22.14291 39.59688 -107.87213 -6264.92 101508.79)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" /><stop offset=".79" stop-color="#fff" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-i" cx="-468.67" cy="861.39" r="6.99" fx="-468.67" fy="861.39" gradientTransform="matrix(-67.45933 53.77501 53.21816 66.68832 -76468.45 -32083.78)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4bfde8" /><stop offset=".58" stop-color="#4bfde8" stop-opacity="0" /></radialGradient>
        <linearGradient id="od-g" x1="638.67" x2="638.67" y1="2.44" y2="421.76" gradientTransform="matrix(1 0 0 -1 0 617.01)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0086ff" /><stop offset=".49" stop-color="#0bf" /></linearGradient>
      </defs>
      <path d="M276.36 94.08C123.48 94.08 9.21 209.84.6 338.79c5.33 27.79 22.83 82.65 50.24 79.84 34.26-3.52 120.56 0 194.17-123.26 53.77-90.04 164.37-201.29 31.35-201.29Z" fill="url(#od-a)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fill="url(#od-b)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fillOpacity=".4" fill="url(#od-c)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fill="url(#od-d)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fillOpacity=".6" fill="url(#od-e)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fillOpacity=".9" fill="url(#od-f)" />
      <path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fill="url(#od-g)" />
      <path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fillOpacity=".4" fill="url(#od-h)" />
      <path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fillOpacity=".9" fill="url(#od-i)" />
    </svg>
  ),
  canva: (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="40" fill="#7D2AE7" />
      <path d="M57.3 48.2c-.3 0-.6.3-.9.9-3.5 6.9-9.4 11.8-16.2 11.8-7.9 0-12.8-7.1-12.8-16.9 0-16.7 9.3-26.3 17.5-26.3 3.8 0 6.1 2.4 6.1 6.2 0 4.5-2.6 6.9-2.6 8.5 0 .7.5 1.1 1.4 1.1 3.5 0 7.7-4.1 7.7-9.8 0-5.6-4.9-9.7-13-9.7-13.5 0-25.5 12.5-25.5 29.8 0 13.4 7.7 22.2 19.5 22.2 12.5 0 19.7-12.4 19.7-16.5 0-.9-.4-1.3-.9-1.3Z" fill="#fff" />
    </svg>
  ),
};

const LOCAL_ICON = <ImagePlus className="h-4 w-4" aria-hidden="true" />;

const PANEL_W = 264;
const PANEL_H = 420;

/**
 * Add-media dropdown for the web composer (shared by composer + idea editors
 * via PostBox), anchored under the media button through a portal. Stock via
 * edge search fns; Drive/Photos/Dropbox via popup OAuth — tokens stay in
 * sessionStorage (device-only). Downloads resolve to Files for onAddFiles;
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
        className="fixed z-[100] flex max-h-[min(420px,66vh)] w-[264px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]"
        style={flip ? { left, bottom: window.innerHeight - (a?.bottom ?? 0) + 8 } : { left, top: below }}
      >
        {source ? (
          <button
            type="button"
            onClick={() => { setSource(null); reset(); }}
            className="flex w-full shrink-0 items-center gap-1 border-b border-line-soft px-3 py-2 text-left text-xs font-bold text-accent-ink hover:bg-paper-dim"
          >
            ‹ {label}
          </button>
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
