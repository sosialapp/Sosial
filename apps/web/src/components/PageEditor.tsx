'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Eye, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import BlogDoc from '@/components/blog/BlogDoc';
import ChartIslands from '@/components/site/ChartIslands';
import { tiptapToProseHtml } from '@/lib/blogHtml';
import { cleanDocForPublish, normalizeInitialDoc, wordsOfTipTap, type TipTapDoc } from '@/lib/blogConvert';
import { defaultDocForSlug } from '@/content/siteDefaults';
import { customSlugAvailable, normalizeCustomSlug, type SitePageDef } from '@/content/sitePages';

/** Editable page metadata — everything about a page except its body. */
export interface AdminPageMeta {
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** ISO display date, or null. A future date schedules the page (hidden until due). */
  publishedAt: string | null;
  status: 'draft' | 'published';
  showInFooter: boolean;
  /** True for admin-created slugs (renamable + deletable); registry slugs are code-owned. */
  isCustom: boolean;
}

/** ISO → `datetime-local` value (local time, minute precision). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * CMS page editor — the TipTap document surface from the blog editor, plus
 * Page settings (title, URL, SEO, date, draft/publish, footer) for full
 * control. Save upserts the site_pages row; registry pages keep "Restore
 * default" (delete → falls back to the hardcoded design) while custom pages
 * get rename + delete instead.
 */
export default function PageEditor({
  def,
  initial,
  loadedAt,
  meta,
}: {
  def: SitePageDef;
  initial: unknown;
  /** updated_at the editor opened with — the save aborts if the row moved on. */
  loadedAt: string | null;
  meta: AdminPageMeta;
}) {
  const router = useRouter();
  const isCustom = meta.isCustom;
  // Never-customized registry pages open with their current live copy
  // pre-loaded, so editing means changing what visitors see today — not
  // writing from zero. Custom pages start from their row (or empty).
  const seeded = normalizeInitialDoc(initial ?? (isCustom ? null : defaultDocForSlug(def.slug))) ?? null;
  const [doc, setDoc] = useState<TipTapDoc | null>(seeded);
  const [words, setWords] = useState(() => wordsOfTipTap(seeded));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState(meta.title ?? '');
  const [metaTitle, setMetaTitle] = useState(meta.metaTitle ?? '');
  const [metaDesc, setMetaDesc] = useState(meta.metaDescription ?? '');
  const [dateInput, setDateInput] = useState(() => toLocalInput(meta.publishedAt));
  const [status, setStatus] = useState<'draft' | 'published'>(meta.status);
  const [inFooter, setInFooter] = useState(meta.showInFooter);
  const [slugInput, setSlugInput] = useState(def.slug);

  const onDocChange = useCallback((next: TipTapDoc, w: number) => {
    setDoc(next);
    setWords(w);
  }, []);

  const scheduled = status === 'published' && !!dateInput && new Date(dateInput).getTime() > Date.now();
  const liveState = status === 'draft' ? 'Draft' : scheduled ? 'Scheduled' : 'Live';

  const metaColumns = () => {
    const parsed = dateInput ? new Date(dateInput).getTime() : NaN;
    return {
      title: title.trim() || null,
      meta_title: metaTitle.trim() || null,
      meta_description: metaDesc.trim() || null,
      published_at: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(),
      status,
      show_in_footer: isCustom ? inFooter : false,
      is_custom: isCustom,
      updated_at: new Date().toISOString(),
    };
  };

  const revalidate = async (paths: string[]) => {
    await fetch('/api/admin/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    }).catch(() => {});
  };

  const save = async () => {
    const content: TipTapDoc | null = doc ? cleanDocForPublish(doc) : null;
    const bodyHtml = content ? tiptapToProseHtml(content) : '';
    if (!bodyHtml.trim() && !(title.trim() && isCustom)) {
      setErr('The document is still empty — write something first.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const sb = createClient();
      // Stale guard: refuse to overwrite a row that moved since this editor
      // opened (another tab, another save). The editor keeps your work.
      const { data: fresh } = await sb
        .from('site_pages')
        .select('updated_at')
        .eq('slug', def.slug)
        .maybeSingle();
      const freshAt =
        (fresh as { updated_at?: unknown } | null)?.updated_at ?? null;
      if (loadedAt !== (typeof freshAt === 'string' ? freshAt : null)) {
        throw new Error(
          'This page changed since you opened it — reload the editor to avoid overwriting. Your current edits stay in place.',
        );
      }
      const { error } = await sb.from('site_pages').upsert(
        {
          slug: def.slug,
          body: content ?? [],
          body_html: bodyHtml,
          ...metaColumns(),
        },
        { onConflict: 'slug' },
      );
      if (error) throw new Error(error.message);
      // Instant publish: purge the ISR cache so the page is live now (or
      // gone now, when saved as a draft).
      await revalidate([def.route]);
      router.push('/admin/pages');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!confirm(`Remove the customized content for “${def.label}”? The page falls back to its default design.`)) return;
    setSaving(true);
    try {
      const sb = createClient();
      const { error } = await sb.from('site_pages').delete().eq('slug', def.slug);
      if (error) throw new Error(error.message);
      await revalidate([def.route]);
      router.push('/admin/pages');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Restore failed.');
      setSaving(false);
    }
  };

  /** Custom pages only: move to a new slug, leaving a 301 behind. */
  const rename = async () => {
    const next = normalizeCustomSlug(slugInput);
    if (!next || next === def.slug) {
      setErr('Type a new URL slug first.');
      return;
    }
    if (!customSlugAvailable(next)) {
      setErr('That URL is taken or reserved — try another.');
      return;
    }
    if (!confirm(`Move this page to /${next}? The old URL redirects automatically.`)) return;
    setSaving(true);
    setErr(null);
    try {
      const sb = createClient();
      const { data: taken } = await sb.from('site_pages').select('slug').eq('slug', next).maybeSingle();
      if (taken) throw new Error('That URL was just taken — try another.');
      const { data: redir } = await sb
        .from('site_redirects')
        .select('from_slug')
        .eq('from_slug', next)
        .maybeSingle();
      if (redir) throw new Error('That URL redirects elsewhere — try another.');
      const content: TipTapDoc | null = doc ? cleanDocForPublish(doc) : null;
      const bodyHtml = content ? tiptapToProseHtml(content) : '';
      // Re-point any redirect chain that landed on the old slug first.
      await sb.from('site_redirects').update({ to_slug: next }).eq('to_slug', def.slug);
      const { error: insErr } = await sb.from('site_pages').insert({
        slug: next,
        body: content ?? [],
        body_html: bodyHtml,
        ...metaColumns(),
      });
      if (insErr) throw new Error(insErr.message);
      await sb.from('site_redirects').upsert({ from_slug: def.slug, to_slug: next }, { onConflict: 'from_slug' });
      const { error: delErr } = await sb.from('site_pages').delete().eq('slug', def.slug);
      if (delErr) throw new Error(`Moved, but the old row survived: ${delErr.message}`);
      await revalidate([`/${def.slug}`, `/${next}`]);
      router.push(`/admin/pages/${next}`);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Rename failed.');
      setSaving(false);
    }
  };

  /** Custom pages only: the page and its URL go away for good. */
  const remove = async () => {
    if (!confirm(`Delete “${title.trim() || def.slug}”? The page and its URL go away for good.`)) return;
    setSaving(true);
    try {
      const sb = createClient();
      await sb.from('site_redirects').delete().eq('from_slug', def.slug);
      await sb.from('site_redirects').delete().eq('to_slug', def.slug);
      const { error } = await sb.from('site_pages').delete().eq('slug', def.slug);
      if (error) throw new Error(error.message);
      await revalidate([`/${def.slug}`]);
      router.push('/admin/pages');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
      setSaving(false);
    }
  };

  // Preview renders the exact publish pipeline — what you see is what ships.
  const previewHtml = doc ? tiptapToProseHtml(cleanDocForPublish(doc)) : '';

  return (
    <div className="min-h-screen">
      <div className="sticky top-[60px] z-30 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[60px] max-w-5xl flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar px-4 sm:px-6">
          <Link
            href="/admin/pages"
            aria-label="Back to pages"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-extrabold tracking-tight">
              {title.trim() || def.label}{' '}
              <span
                className={`ml-1 rounded-full border px-2 py-0.5 align-middle text-[10px] font-bold ${
                  liveState === 'Live'
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-paper text-muted'
                }`}
              >
                {liveState}
              </span>
            </p>
            <p className="truncate text-[11px] font-bold text-faint">
              {def.group} · {def.route} · {words} words
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
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
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              preview
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:border-faint'
            }`}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </button>
          {initial && !isCustom ? (
            <button
              type="button"
              onClick={() => void restore()}
              disabled={saving}
              aria-label="Restore default"
              title="Restore default"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
          >
            {saving ? 'Saving…' : initial ? 'Update page' : 'Publish page'}
          </button>
        </div>
        {err ? (
          <p className="border-t border-line bg-[#FDEBEC] px-4 py-2 text-center text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
            {err}
          </p>
        ) : null}
      </div>

      {/* ---- page settings: everything about the page except its body ---- */}
      <details className="border-b border-line bg-card" open={!initial}>
        <summary className="mx-auto flex max-w-5xl cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold text-soft sm:px-6">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Page settings — title, URL, SEO, date, visibility
        </summary>
        <div className="mx-auto grid max-w-5xl gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-6">
          <label className="block">
            <span className="text-xs font-bold text-muted">Page title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isCustom ? 'e.g. Launch day checklist' : def.label}
              className="field mt-1"
            />
          </label>
          {isCustom ? (
            <div>
              <span className="text-xs font-bold text-muted">URL slug</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="field"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => void rename()}
                  disabled={saving || normalizeCustomSlug(slugInput) === def.slug}
                  className="btn btn-ghost shrink-0 !px-3 !py-2 !text-xs disabled:opacity-40"
                >
                  Move
                </button>
              </div>
            </div>
          ) : (
            <label className="block">
              <span className="text-xs font-bold text-muted">Date (record)</span>
              <input
                type="datetime-local"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="field mt-1"
              />
            </label>
          )}
          {isCustom ? (
            <label className="block">
              <span className="text-xs font-bold text-muted">Date — future dates schedule the page</span>
              <input
                type="datetime-local"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="field mt-1"
              />
            </label>
          ) : null}
          <div>
            <span className="text-xs font-bold text-muted">Visibility</span>
            <div className="mt-1 flex gap-2" role="group" aria-label="Visibility">
              {(['draft', 'published'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold capitalize transition ${
                    status === s
                      ? 'border-ink bg-[#191512] text-white'
                      : 'border-line bg-paper text-muted hover:border-faint'
                  }`}
                >
                  {s === 'draft' ? 'Draft' : 'Published'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-faint">
              {status === 'draft'
                ? isCustom
                  ? 'Hidden from the site until you publish.'
                  : 'Hides your customized section — visitors see the default design.'
                : scheduled
                  ? 'Goes live automatically when the date arrives.'
                  : 'Live on the site after you save.'}
            </p>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-muted">SEO title (search + tab)</span>
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Defaults to the page title"
              className="field mt-1"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-muted">SEO description (search snippet)</span>
            <textarea
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="One or two sentences for search results."
              rows={2}
              className="field mt-1"
            />
          </label>
          {isCustom ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2.5">
              <input
                type="checkbox"
                checked={inFooter}
                onChange={(e) => setInFooter(e.target.checked)}
                className="h-4 w-4 accent-current"
              />
              <span className="text-xs font-bold">
                Show in footer
                <span className="block font-normal text-faint">Listed under Resources on every page.</span>
              </span>
            </label>
          ) : null}
          {isCustom ? (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className="btn shrink-0 !px-3 !py-2 !text-xs border border-line bg-paper text-[#9F2F2D] hover:border-[#9F2F2D] disabled:opacity-40"
              >
                <Trash2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Delete page
              </button>
            </div>
          ) : null}
        </div>
      </details>

      <div className="bg-surface px-3 py-6 dark:bg-black/40 sm:px-6">
        <div className="doc-sheet blog-doc mx-auto max-w-[820px] rounded-md bg-white px-5 py-8 text-[#1C1A14] shadow-[0_2px_24px_rgba(0,0,0,0.08)] sm:px-12">
          {preview ? (
            <>
              <div className="prose-sosial blog-rich" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              <ChartIslands />
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wide text-faint">
                {initial
                  ? def.hint
                  : isCustom
                    ? 'Blank page — write the content, set the title and date above, then publish.'
                    : 'Pre-loaded with the page’s current copy — edit freely, then publish to replace the CMS section.'}
              </p>
              <div className="mt-2">
                <BlogDoc initial={doc} onChange={onDocChange} onError={setErr} />
              </div>
            </>
          )}
        </div>
        <p className="mx-auto mt-4 max-w-[820px] px-1 text-center text-xs text-muted">
          <Trash2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Charts, embeds, tables and media from the blog editor all work here.{' '}
          {isCustom
            ? 'On the live page this renders under your title.'
            : 'On the live page this content renders wherever the design reserves its slot.'}
        </p>
      </div>
    </div>
  );
}
