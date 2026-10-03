'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface StockItem {
  id: string;
  kind: 'image' | 'video';
  thumb: string;
  full: string;
  author: string;
  authorUrl: string;
  source: 'pexels' | 'unsplash';
}

const SOURCES = [
  { id: 'pexels', label: 'Pexels', note: 'Photos + videos' },
  { id: 'unsplash', label: 'Unsplash', note: 'Photos · credit auto-added' },
] as const;

type Source = (typeof SOURCES)[number]['id'];

/**
 * Stock browser dialog (Pexels + Unsplash via edge search fns — keys never
 * ship). Downloads resolve to Files for the caller's onAddFiles; Unsplash
 * items also return a credit line the caller appends (license requirement).
 * Cloud drives (Drive/Photos/Dropbox/OneDrive) land as tabs here as they ship.
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

  if (!open) return null;

  const search = async () => {
    if (!source || !query.trim() || busy) return;
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

  const pick = async (item: StockItem) => {
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
                onClick={() => {
                  setSource(s.id);
                  setItems([]);
                  setQuery('');
                  setErr(null);
                  if (s.id === 'unsplash') setType('photo');
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left transition hover:border-ink"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{s.label}</span>
                  <span className="block text-xs text-muted">{s.note}</span>
                </span>
                <span aria-hidden="true" className="text-faint">›</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => { setSource(null); setItems([]); setErr(null); }}
              className="text-xs font-bold text-accent-ink"
            >
              ‹ {source === 'pexels' ? 'Pexels' : 'Unsplash'}
            </button>
            <div className="mt-2 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
                placeholder="Search stock…"
                aria-label="Search stock"
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
            ) : (
              <p className="mt-2 text-[11px] text-muted">Photographer credit is added to your caption automatically.</p>
            )}
            {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void pick(item)}
                  className="group relative overflow-hidden rounded-xl border border-line bg-paper-dim"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumb} alt={item.author} loading="lazy" className="aspect-square w-full object-cover" />
                  {item.kind === 'video' ? (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">▶</span>
                  ) : null}
                  {downloading === item.id ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">…</span>
                  ) : null}
                  <span className="block truncate px-1.5 py-1 text-left text-[10px] text-muted">{item.author}</span>
                </button>
              ))}
            </div>
            {items.length === 0 && !busy ? (
              <p className="mt-3 text-center text-xs text-faint">Search above to browse stock.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
