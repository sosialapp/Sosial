'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { slugify, type DocsPage, type DocsSection } from '@/lib/docs';
import DocsIcon from './DocsIcon';

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return null;
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    return j?.error ?? `Request failed (${res.status}).`;
  } catch {
    return 'Network error, try again.';
  }
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-soft transition hover:bg-bone disabled:opacity-30';

/** Owner docs list: sections and their pages, with order, publish and delete. */
export default function DocsAdminList({ sections, pages }: { sections: DocsSection[]; pages: DocsPage[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSection, setNewSection] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    router.refresh();
  };

  const reorder = (kind: 'pages' | 'sections', ids: string[]) =>
    run(() => call('/api/admin/docs/reorder', 'POST', { kind, ids }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Docs</h1>
          <p className="mt-1 text-sm text-muted">
            {pages.length} pages in {sections.length} sections · live at docs.sosial.app
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/docs" className="btn !px-4 !py-2 !text-sm" target="_blank">
            View docs
          </Link>
          {sections.length ? (
            <Link href="/admin/docs/new" className="btn btn-primary !px-4 !py-2 !text-sm">
              New page
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {sections.map((s, si) => {
        const list = pages.filter((p) => p.sectionId === s.id);
        // Top-level pages, each followed by its sub-pages; order buttons move a
        // page among its siblings only.
        const ids = new Set(list.map((p) => p.id));
        const top = list.filter((p) => !p.parentId || !ids.has(p.parentId));
        const rows = top.flatMap((t, ti) => {
          const kids = list.filter((c) => c.parentId === t.id);
          return [
            { p: t, siblings: top, pi: ti, child: false },
            ...kids.map((c, ci) => ({ p: c, siblings: kids, pi: ci, child: true })),
          ];
        });
        return (
          <section key={s.id} className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {renaming?.id === s.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = renaming.title.trim();
                    if (!title) return;
                    setRenaming(null);
                    void run(() => call(`/api/admin/docs/sections/${s.id}`, 'PATCH', { title }));
                  }}
                >
                  <input
                    autoFocus
                    value={renaming.title}
                    onChange={(e) => setRenaming({ id: s.id, title: e.target.value })}
                    className="field !py-1.5 min-w-0 flex-1"
                    aria-label="Section title"
                  />
                  <button type="submit" className="btn btn-primary !px-3 !py-1.5 !text-xs">
                    Save
                  </button>
                  <button type="button" onClick={() => setRenaming(null)} className="btn !px-3 !py-1.5 !text-xs">
                    Cancel
                  </button>
                </form>
              ) : (
                <p className="eyebrow min-w-0 flex-1 truncate">{s.title}</p>
              )}
              <button
                type="button"
                className={iconBtn}
                disabled={busy || si === 0}
                aria-label={`Move ${s.title} up`}
                onClick={() => reorder('sections', move(sections, si, -1).map((x) => x.id))}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={busy || si === sections.length - 1}
                aria-label={`Move ${s.title} down`}
                onClick={() => reorder('sections', move(sections, si, 1).map((x) => x.id))}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={busy}
                aria-label={`Rename ${s.title}`}
                onClick={() => setRenaming({ id: s.id, title: s.title })}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={busy}
                aria-label={`Delete ${s.title}`}
                title={list.length ? 'Move or delete its pages first' : 'Delete section'}
                onClick={() => {
                  if (list.length) {
                    setError(`“${s.title}” still has ${list.length} page(s). Move or delete them first.`);
                    return;
                  }
                  if (confirm(`Delete the section “${s.title}”?`)) {
                    void run(() => call(`/api/admin/docs/sections/${s.id}`, 'DELETE'));
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 grid gap-2">
              {list.length ? null : (
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-muted">
                  No pages yet. Empty sections are hidden on the docs site.
                </p>
              )}
              {rows.map(({ p, siblings, pi, child }) => (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 ${child ? 'ml-6 sm:ml-10' : ''}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-ink">
                    <DocsIcon name={p.icon} fallback className="h-4 w-4" />
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      p.published ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-paper text-muted'
                    }`}
                  >
                    {p.published ? 'Live' : 'Draft'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {child ? <span className="text-muted">↳ </span> : null}
                      {p.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      /{p.slug}
                      {p.updatedAt ? ` · edited ${new Date(p.updatedAt).toLocaleDateString('en-GB')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={busy || pi === 0}
                    aria-label={`Move ${p.title} up`}
                    onClick={() => reorder('pages', move(siblings, pi, -1).map((x) => x.id))}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={busy || pi === siblings.length - 1}
                    aria-label={`Move ${p.title} down`}
                    onClick={() => reorder('pages', move(siblings, pi, 1).map((x) => x.id))}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => call(`/api/admin/docs/pages/${p.id}`, 'PATCH', { published: !p.published }))}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                  >
                    {p.published ? 'Unpublish' : 'Publish'}
                  </button>
                  {p.published ? (
                    <Link
                      href={`/docs/${p.slug}`}
                      target="_blank"
                      className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/docs/${p.id}`}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={busy}
                    aria-label={`Delete ${p.title}`}
                    onClick={() => {
                      if (confirm(`Delete “${p.title}”? This can't be undone.`)) {
                        void run(() => call(`/api/admin/docs/pages/${p.id}`, 'DELETE'));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <form
        className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-line bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const title = newSection.trim();
          if (!title) return;
          setNewSection('');
          void run(() => call('/api/admin/docs/sections', 'POST', { title, slug: slugify(title) }));
        }}
      >
        <input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          placeholder="New section title, e.g. Integrations"
          aria-label="New section title"
          className="field min-w-0 flex-1"
        />
        <button type="submit" disabled={busy || !newSection.trim()} className="btn btn-primary !px-4 !py-2 !text-sm">
          Add section
        </button>
      </form>
    </div>
  );
}
