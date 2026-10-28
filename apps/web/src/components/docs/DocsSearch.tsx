'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { DocsSearchEntry } from '@/lib/docs';

interface Hit {
  entry: DocsSearchEntry;
  score: number;
  snippet: string;
}

function snippetOf(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text.slice(0, 120);
  const start = Math.max(0, i - 50);
  return `${start ? '…' : ''}${text.slice(start, i + 90)}…`;
}

/** Every term must match somewhere; title and heading matches rank first. */
function search(index: DocsSearchEntry[], q: string): Hit[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const e of index) {
    const title = e.title.toLowerCase();
    const heads = e.headings.join(' ').toLowerCase();
    const desc = e.description.toLowerCase();
    const text = e.text.toLowerCase();
    let score = 0;
    let all = true;
    for (const t of terms) {
      const s =
        (title.includes(t) ? 10 : 0) + (heads.includes(t) ? 5 : 0) + (desc.includes(t) ? 3 : 0) + (text.includes(t) ? 1 : 0);
      if (!s) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) hits.push({ entry: e, score, snippet: snippetOf(e.description || e.text, terms[0]) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}

/** Header search: a button that opens a dialog (also on Ctrl/⌘ K or "/"). */
export default function DocsSearch({ index }: { index: DocsSearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => search(index, q), [index, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = (slug: string) => {
    setOpen(false);
    setQ('');
    router.push(`/${slug}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-sm text-ink/60 transition hover:text-ink sm:w-56 xl:w-64"
        aria-label="Search docs"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden min-w-0 flex-1 truncate text-left sm:block">Search docs</span>
        <kbd className="hidden rounded border border-line bg-card px-1.5 text-[10px] xl:block">Ctrl K</kbd>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div role="dialog" aria-label="Search docs" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="h-4 w-4 shrink-0 text-ink/60" aria-hidden="true" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                  else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSel((s) => Math.min(s + 1, Math.max(hits.length - 1, 0)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSel((s) => Math.max(s - 1, 0));
                  } else if (e.key === 'Enter' && hits[sel]) go(hits[sel].entry.slug);
                }}
                placeholder="Search the docs"
                aria-label="Search query"
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink/45"
              />
              <kbd className="rounded border border-line px-1.5 text-[10px] text-ink/60">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {q.trim() && !hits.length ? (
                <li className="px-3 py-6 text-center text-sm text-ink/60">No pages match “{q.trim()}”.</li>
              ) : null}
              {hits.map((h, i) => (
                <li key={h.entry.slug}>
                  <button
                    type="button"
                    onMouseEnter={() => setSel(i)}
                    onClick={() => go(h.entry.slug)}
                    className={`block w-full rounded-xl px-3 py-2.5 text-left ${i === sel ? 'bg-accent-soft' : ''}`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.08em] text-ink/55">{h.entry.section}</span>
                    <span className="block text-sm font-medium">{h.entry.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink/65">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
