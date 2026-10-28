'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ImagePlus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadBlogMedia } from '@/lib/mediaUpload';
import { slugify, type DocsPage, type DocsSection } from '@/lib/docs';
import { renderDocMarkdown } from '@/lib/docsMarkdown';
import DocsCopyButtons from './DocsCopyButtons';
import DocsIcon, { DOCS_ICON_CHOICES } from './DocsIcon';
import './docs.css';

type View = 'write' | 'preview' | 'split';

/** Markdown syntax the toolbar wraps around the selection (or inserts). */
const TOOLS: { label: string; title: string; before: string; after?: string; line?: boolean }[] = [
  { label: 'H2', title: 'Heading', before: '## ', line: true },
  { label: 'H3', title: 'Subheading', before: '### ', line: true },
  { label: 'B', title: 'Bold', before: '**', after: '**' },
  { label: 'I', title: 'Italic', before: '_', after: '_' },
  { label: '`', title: 'Inline code', before: '`', after: '`' },
  { label: 'Link', title: 'Link', before: '[', after: '](https://)' },
  { label: '• List', title: 'Bulleted list', before: '- ', line: true },
  { label: '1. List', title: 'Numbered list', before: '1. ', line: true },
  { label: '> Note', title: 'Callout', before: '> ', line: true },
  { label: '{ }', title: 'Code block', before: '```bash\n', after: '\n```' },
];

/** Owner docs page editor: fields, a markdown textarea and a live preview
 *  rendered by the same renderer the public site uses. Saves via the admin
 *  API, which re-checks is_app_admin() server-side. */
export default function DocsEditor({
  sections,
  pages,
  initial,
}: {
  sections: DocsSection[];
  /** Every page, for the parent picker. */
  pages: DocsPage[];
  initial: DocsPage | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? sections[0]?.id ?? '');
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  // Parents: top-level pages of the chosen section, never this page; a page
  // that has sub-pages can't be nested itself (one level only).
  const hasChildren = !!initial && pages.some((p) => p.parentId === initial.id);
  const parentChoices = pages.filter((p) => p.sectionId === sectionId && !p.parentId && p.id !== initial?.id);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [body, setBody] = useState(initial?.bodyMd ?? '');
  const [published, setPublished] = useState(initial?.published ?? false);
  const [updatedAt, setUpdatedAt] = useState(initial?.updatedAt ?? null);
  const [view, setView] = useState<View>('split');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => renderDocMarkdown(body).html, [body]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
    setSavedAt(null);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(
    async (overrides?: { published?: boolean }) => {
      if (saving) return;
      const pub = overrides?.published ?? published;
      setSaving(true);
      setError(null);
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        section_id: sectionId,
        parent_id: parentId || null,
        icon,
        description: description.trim(),
        body_md: body,
        published: pub,
      };
      try {
        const res = await fetch(initial ? `/api/admin/docs/pages/${initial.id}` : '/api/admin/docs/pages', {
          method: initial ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(initial ? { ...payload, expected_updated_at: updatedAt ?? undefined } : payload),
        });
        const j = (await res.json().catch(() => null)) as { error?: string; page?: { id: string; updated_at: string } } | null;
        if (!res.ok || !j?.page) {
          setError(j?.error ?? `Save failed (${res.status}).`);
          return;
        }
        setPublished(pub);
        setUpdatedAt(j.page.updated_at);
        setDirty(false);
        setSavedAt(Date.now());
        if (!initial) router.replace(`/admin/docs/${j.page.id}`);
        else router.refresh();
      } catch {
        setError('Network error, try again.');
      } finally {
        setSaving(false);
      }
    },
    [saving, published, title, slug, sectionId, parentId, icon, description, body, initial, updatedAt, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const insert = (before: string, after = '', line = false) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    let start = a;
    if (line) start = value.lastIndexOf('\n', a - 1) + 1;
    const selected = value.slice(a, b);
    const next = line
      ? value.slice(0, start) + before + value.slice(start, b) + after + value.slice(b)
      : value.slice(0, a) + before + selected + after + value.slice(b);
    touch(setBody)(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = line ? b + before.length : a + before.length + selected.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadBlogMedia(createClient(), 'docs', file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '');
      insert(`\n![${alt}](${url})\n`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!initial || !confirm(`Delete “${initial.title}”? This can't be undone.`)) return;
    setSaving(true);
    const res = await fetch(`/api/admin/docs/pages/${initial.id}`, { method: 'DELETE' });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? 'Delete failed.');
      return;
    }
    setDirty(false);
    router.replace('/admin/docs');
    router.refresh();
  };

  const canSave = !!title.trim() && !!slug.trim() && !!sectionId && !saving;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/docs" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Docs
        </Link>
        <span className="flex-1" />
        <span className="text-xs text-muted" aria-live="polite">
          {saving ? 'Saving…' : savedAt ? 'Saved' : dirty ? 'Unsaved changes' : ''}
        </span>
        {initial && published ? (
          <Link
            href={`/docs/${initial.slug}`}
            target="_blank"
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
          >
            View live
          </Link>
        ) : null}
        {initial ? (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            aria-label="Delete page"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-soft"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => save({ published: !published })}
          disabled={!canSave}
          className="btn !px-4 !py-2 !text-sm"
        >
          {published ? 'Unpublish' : 'Publish'}
        </button>
        <button type="button" onClick={() => save()} disabled={!canSave} className="btn btn-primary !px-4 !py-2 !text-sm">
          {initial ? 'Save' : 'Create page'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-soft sm:col-span-2">
          Title
          <input
            value={title}
            onChange={(e) => {
              touch(setTitle)(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="field text-base"
            placeholder="Connecting accounts"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-soft">
          Slug
          <div className="flex items-center gap-1">
            <span className="text-sm font-normal text-muted">docs.sosial.app/</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                touch(setSlug)(slugify(e.target.value));
              }}
              className="field min-w-0 flex-1"
              placeholder="connecting-accounts"
            />
          </div>
        </label>
        <label className="grid gap-1 text-xs font-bold text-soft">
          Section
          <select
            value={sectionId}
            onChange={(e) => {
              touch(setSectionId)(e.target.value);
              setParentId('');
            }}
            className="field"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-soft">
          Parent page <span className="font-normal text-muted">(shows it under that page in the sidebar)</span>
          <select
            value={parentId}
            onChange={(e) => touch(setParentId)(e.target.value)}
            disabled={hasChildren}
            title={hasChildren ? 'This page has sub-pages, so it stays top level.' : undefined}
            className="field"
          >
            <option value="">None, top level</option>
            {parentChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-soft">
          Icon
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink">
              <DocsIcon name={icon} fallback className="h-5 w-5" />
            </span>
            <select value={icon} onChange={(e) => touch(setIcon)(e.target.value)} className="field min-w-0 flex-1">
              <option value="">Default (page)</option>
              {DOCS_ICON_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="grid gap-1 text-xs font-bold text-soft sm:col-span-2">
          Description <span className="font-normal text-muted">(shown under the title and in search results)</span>
          <input
            value={description}
            onChange={(e) => touch(setDescription)(e.target.value)}
            maxLength={300}
            className="field"
            placeholder="One sentence on what this page covers."
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-t-2xl border border-b-0 border-line bg-card px-2 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onClick={() => insert(t.before, t.after, t.line)}
            className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-bold text-soft hover:bg-bone"
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title="Upload image"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-bold text-soft hover:bg-bone"
        >
          <ImagePlus className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
        <span className="flex-1" />
        <div className="flex rounded-lg border border-line bg-paper p-0.5 text-xs font-bold">
          {(['write', 'split', 'preview'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md px-2.5 py-1 capitalize ${view === v ? 'bg-ink text-paper' : 'text-soft'} ${
                v === 'split' ? 'hidden lg:block' : ''
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`grid min-h-[60vh] overflow-hidden rounded-b-2xl border border-line bg-card ${
          view === 'split' ? 'lg:grid-cols-2' : ''
        }`}
      >
        <textarea
          ref={textRef}
          value={body}
          onChange={(e) => touch(setBody)(e.target.value)}
          spellCheck
          aria-label="Markdown body"
          placeholder={'## First heading\n\nWrite in Markdown. Images, tables and code blocks are supported.'}
          className={`min-h-[60vh] w-full resize-y bg-card p-4 font-mono text-[13px] leading-relaxed outline-none ${
            view === 'preview' ? 'hidden' : view === 'split' ? 'max-lg:block' : ''
          }`}
        />
        <div
          className={`min-w-0 overflow-y-auto border-line p-5 ${view === 'split' ? 'hidden border-l lg:block' : ''} ${
            view === 'write' ? 'hidden' : ''
          }`}
        >
          <h1 className="font-display text-3xl font-medium tracking-tight">{title || 'Untitled'}</h1>
          {description ? <p className="mt-2 text-lg text-ink/70">{description}</p> : null}
          <div id="docs-preview" className="docs-prose mt-6" dangerouslySetInnerHTML={{ __html: preview }} />
          <DocsCopyButtons rootId="docs-preview" watch={preview} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Ctrl/⌘ S saves. Drafts are visible only here.</p>
    </div>
  );
}
