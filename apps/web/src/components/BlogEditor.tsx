'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Eye, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import BlogDoc from '@/components/blog/BlogDoc';
import ChartIslands from '@/components/site/ChartIslands';
import { normalizeInitialDoc, wordsOfTipTap, type TipTapDoc } from '@/lib/blogConvert';
import { tiptapToProseHtml } from '@/lib/blogHtml';
import { BLOG_TAGS, type Block, type Category } from '@/content/types';

export interface BlogDraft {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  /** Stored body: legacy blocks, old BlockNote JSON or TipTap JSON — normalized on open. */
  body: unknown;
  tag: Category;
  minutes: number;
  status: 'draft' | 'published';
  published_at: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Owner post editor. The .doc-sheet chrome, title and page setup stay custom;
 * the document itself is a TipTap editor with media, Docs-style tables,
 * social embeds and charts. Saving serializes the document to HTML too, so
 * the public page server-renders exactly what was written.
 */
export default function BlogEditor({ initial }: { initial: BlogDraft | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tag, setTag] = useState<Category>(initial?.tag ?? 'Publishing');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Any stored body (legacy blocks, BlockNote JSON or TipTap JSON) normalizes
  // to a TipTap doc once, on open.
  const [doc, setDoc] = useState<TipTapDoc | null>(
    () => normalizeInitialDoc(initial?.body) ?? null,
  );
  const [words, setWords] = useState(() => wordsOfTipTap(normalizeInitialDoc(initial?.body)));

  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onDocChange = useCallback((next: TipTapDoc, w: number) => {
    setDoc(next);
    setWords(w);
  }, []);

  const save = async (status: 'draft' | 'published') => {
    const cleanSlug = slugify(slug);
    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }
    if (!cleanSlug) {
      setErr('Slug is required.');
      return;
    }
    const content: TipTapDoc = {
      type: 'doc',
      content: (doc?.content ?? []).filter((b) => {
        const url = String(b.attrs?.url ?? '').trim();
        if (b.type === 'socialEmbed' || b.type === 'image') return url.length > 0;
        if (b.type === 'chart') return String(b.attrs?.data ?? '').length > 0;
        if (b.type === 'buttonLink') {
          return String(b.attrs?.label ?? '').trim().length > 0 && url.length > 0;
        }
        return true;
      }),
    };
    if (content.content.length === 0) {
      setErr('Add at least one block with content.');
      return;
    }
    const bodyHtml = tiptapToProseHtml(content);
    if (!bodyHtml.trim()) {
      setErr('The document is still empty — write something first.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const now = new Date().toISOString();
      const payload = {
        slug: cleanSlug,
        title: title.trim(),
        description: description.trim(),
        body: content,
        body_html: bodyHtml,
        tag,
        minutes: Math.max(1, Math.round(words / 200)),
        status,
        published_at:
          status === 'published' ? (initial?.published_at ?? now) : (initial?.published_at ?? null),
        updated_at: now,
      };
      const sb = createClient();
      if (initial?.id) {
        const { error } = await sb.from('blog_posts').update(payload).eq('id', initial.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from('blog_posts').insert(payload);
        if (error) throw new Error(error.message);
      }
      router.push('/admin/blog');
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      setErr(/duplicate|unique/i.test(msg) ? 'That slug is taken.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial?.id || !confirm('Delete this post permanently?')) return;
    setSaving(true);
    try {
      const sb = createClient();
      const { error } = await sb.from('blog_posts').delete().eq('id', initial.id);
      if (error) throw new Error(error.message);
      router.push('/admin/blog');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
      setSaving(false);
    }
  };

  const previewHtml = tiptapToProseHtml(doc);

  return (
    <div className="min-h-screen">
      {/* app bar: back · status · words · write/preview · save */}
      <div className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <Link
            href="/admin/blog"
            aria-label="Back to posts"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-bold text-soft">
            {initial ? initial.status : 'new'}
          </span>
          <span className="text-[11px] font-bold text-faint">
            {words} words{initial?.published_at ? ` · published ${new Date(initial.published_at).toLocaleDateString('en-GB')}` : ''}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              !preview
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:border-faint'
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              preview
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:border-faint'
            }`}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => void save('draft')}
            disabled={saving}
            className="btn btn-ghost !px-3.5 !py-1.5 !text-xs"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => void save('published')}
            disabled={saving}
            className="btn btn-primary !px-3.5 !py-1.5 !text-xs"
          >
            {saving ? 'Saving…' : initial?.status === 'published' ? 'Update live post' : 'Publish'}
          </button>
          {initial?.id ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              aria-label="Delete post"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-[#9F2F2D] transition hover:bg-[#FDEBEC] disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {err ? (
          <p className="border-t border-line bg-[#FDEBEC] px-4 py-2 text-center text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
            {err}
          </p>
        ) : null}
      </div>

      {/* canvas + sheet */}
      <div className="bg-surface px-3 py-6 dark:bg-black/40 sm:px-6">
        <div className="doc-sheet blog-doc mx-auto max-w-[820px] rounded-md bg-white px-5 py-8 text-[#1C1A14] shadow-[0_2px_24px_rgba(0,0,0,0.08)] sm:px-12">
          {preview ? (
            <>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">{title || 'Untitled'}</h2>
              {description ? <p className="mt-3 text-lg text-muted">{description}</p> : null}
              <hr className="my-6 border-line" />
              <div className="prose-sosial blog-rich" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              <ChartIslands />
            </>
          ) : (
            <>
              <input
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="Untitled"
                aria-label="Post title"
                className="w-full border-0 bg-transparent font-display text-[32px] font-extrabold leading-tight tracking-tight outline-none placeholder:text-faint/50"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Standfirst — one line under the title…"
                aria-label="Description"
                className="mt-2 w-full border-0 bg-transparent text-[17px] leading-relaxed text-muted outline-none placeholder:text-faint/50"
              />
              <hr className="my-6 border-line" />
              <BlogDoc initial={doc} onChange={onDocChange} onError={setErr} />
            </>
          )}
        </div>

        {/* page setup */}
        <details className="doc-sheet mx-auto mt-4 max-w-[820px] rounded-md bg-white px-5 py-3 text-[#1C1A14] shadow-sm sm:px-8">
          <summary className="cursor-pointer text-xs font-bold text-muted">Page setup</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-muted">
              Slug
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                className="field"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Tag
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as Category)}
                className="field"
              >
                {BLOG_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </div>
    </div>
  );
}
