'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Eye, RotateCcw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import BlogDoc from '@/components/blog/BlogDoc';
import ChartIslands from '@/components/site/ChartIslands';
import { tiptapToProseHtml } from '@/lib/blogHtml';
import { normalizeInitialDoc, wordsOfTipTap, type TipTapDoc } from '@/lib/blogConvert';
import { defaultDocForSlug } from '@/content/siteDefaults';
import type { SitePageDef } from '@/content/sitePages';

/**
 * CMS page editor — the TipTap document surface from the blog editor,
 * without title/slug/tag chrome (the registry owns identity). Save upserts
 * the site_pages row; "Restore default" deletes it so the page falls back
 * to its hardcoded design.
 */
export default function PageEditor({
  def,
  initial,
}: {
  def: SitePageDef;
  initial: unknown;
}) {
  const router = useRouter();
  // Never-customized pages open with their current live copy pre-loaded, so
  // editing means changing what visitors see today — not writing from zero.
  const seeded = normalizeInitialDoc(initial ?? defaultDocForSlug(def.slug)) ?? null;
  const [doc, setDoc] = useState<TipTapDoc | null>(seeded);
  const [words, setWords] = useState(() => wordsOfTipTap(seeded));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDocChange = useCallback((next: TipTapDoc, w: number) => {
    setDoc(next);
    setWords(w);
  }, []);

  const save = async () => {
    const content: TipTapDoc = {
      type: 'doc',
      content: (doc?.content ?? []).filter((b) => {
        if (b.type === 'socialEmbed') return String(b.attrs?.url ?? '').trim().length > 0;
        if (b.type === 'image') return String(b.attrs?.src ?? '').trim().length > 0;
        if (b.type === 'chart') return String(b.attrs?.data ?? '').length > 0;
        if (b.type === 'buttonLink') {
          return String(b.attrs?.label ?? '').trim().length > 0 && String(b.attrs?.href ?? '').trim().length > 0;
        }
        return true;
      }),
    };
    const bodyHtml = tiptapToProseHtml(content);
    if (!bodyHtml.trim()) {
      setErr('The document is still empty — write something first.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.from('site_pages').upsert(
        {
          slug: def.slug,
          body: content,
          body_html: bodyHtml,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      );
      if (error) throw new Error(error.message);
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
      router.push('/admin/pages');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Restore failed.');
      setSaving(false);
    }
  };

  const previewHtml = tiptapToProseHtml(doc);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <Link
            href="/admin/pages"
            aria-label="Back to pages"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-extrabold tracking-tight">{def.label}</p>
            <p className="truncate text-[11px] font-bold text-faint">
              {def.group} · {def.route} · {words} words
            </p>
          </div>
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
          {initial ? (
            <button
              type="button"
              onClick={() => void restore()}
              disabled={saving}
              aria-label="Restore default"
              title="Restore default"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn btn-primary !px-3.5 !py-1.5 !text-xs"
          >
            {saving ? 'Saving…' : initial ? 'Update page' : 'Publish to page'}
          </button>
        </div>
        {err ? (
          <p className="border-t border-line bg-[#FDEBEC] px-4 py-2 text-center text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
            {err}
          </p>
        ) : null}
      </div>

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
          Charts, embeds, tables and media from the blog editor all work here. On the live
          page this content renders wherever the design reserves its slot
          {def.mode === 'body' ? ' — for this page it replaces the default body.' : '.'}
        </p>
      </div>
    </div>
  );
}
