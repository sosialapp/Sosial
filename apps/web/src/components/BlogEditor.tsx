'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Prose from '@/components/site/Prose';
import { embedUrl } from '@/lib/richtext';
import { BLOG_TAGS, type Block, type Category } from '@/content/types';

export interface BlogDraft {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  body: Block[];
  tag: Category;
  minutes: number;
  status: 'draft' | 'published';
  published_at: string | null;
}

type BlockType = Block['t'];
type TextType = 'p' | 'h' | 'quote';

const BLOCK_LABELS: Record<BlockType, string> = {
  p: 'Paragraph',
  h: 'Heading',
  ul: 'List',
  quote: 'Quote',
  img: 'Image',
  video: 'Video',
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wordsOf(blocks: Block[]): number {
  let n = 0;
  const count = (s: string) => {
    n += s.split(/\s+/).filter(Boolean).length;
  };
  for (const b of blocks) {
    if (b.t === 'ul') b.c.forEach(count);
    else if (b.t === 'img') {
      if (b.caption) count(b.caption);
    } else if (b.t !== 'video') count(b.c);
  }
  return n;
}

/** Drop empty blocks so neither the preview nor the saved row carries husks. */
function cleanBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.t === 'ul') {
      const items = b.c.map((x) => x.trim()).filter((x) => x.length > 0);
      if (items.length > 0) out.push({ t: 'ul', c: items });
    } else if (b.t === 'img') {
      if (b.c.trim()) {
        out.push({
          t: 'img',
          c: b.c.trim(),
          ...(b.alt?.trim() ? { alt: b.alt.trim() } : {}),
          ...(b.caption?.trim() ? { caption: b.caption.trim() } : {}),
        });
      }
    } else if (b.t === 'video') {
      if (b.c.trim()) out.push({ t: 'video', c: b.c.trim() });
    } else if (b.c.trim()) {
      out.push({ t: b.t, c: b.c.trim() });
    }
  }
  return out;
}

/** Owner post editor. Blocks match the Prose model exactly, and the preview
 *  renders Prose itself — what saves is what the marketing page renders. */
export default function BlogEditor({ initial }: { initial: BlogDraft | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tag, setTag] = useState<Category>(initial?.tag ?? 'Publishing');
  const [blocks, setBlocks] = useState<Block[]>(
    initial && initial.body.length > 0 ? initial.body : [{ t: 'p', c: '' }],
  );
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const selRef = useRef<{ i: number; start: number; end: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const setBlock = (i: number, b: Block) =>
    setBlocks((prev) => prev.map((x, j) => (j === i ? b : x)));

  const move = (i: number, d: -1 | 1) =>
    setBlocks((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const addBlock = (t: BlockType) =>
    setBlocks((prev) => [
      ...prev,
      t === 'ul'
        ? { t, c: [''] }
        : t === 'img'
          ? { t, c: '', alt: '', caption: '' }
          : t === 'video'
            ? { t, c: '' }
            : { t, c: '' },
    ]);

  const delBlock = (i: number) => setBlocks((prev) => prev.filter((_, j) => j !== i));

  /** Editable text of a block (ul joins items; media blocks have none). */
  const blockText = (b: Block): string | null => {
    if (b.t === 'ul') return b.c.join('\n');
    if (b.t === 'img' || b.t === 'video') return null;
    return b.c;
  };

  const writeText = (i: number, text: string) =>
    setBlocks((prev) =>
      prev.map((x, j) => {
        if (j !== i) return x;
        if (x.t === 'ul') return { t: 'ul', c: text.split('\n') };
        if (x.t === 'img' || x.t === 'video') return x;
        return { t: x.t, c: text };
      }),
    );

  const trackSel = (i: number) => (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const t = e.target as HTMLTextAreaElement;
    selRef.current = { i, start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 };
  };

  /** Wrap the last-selected text (toolbar B / I / link). */
  const applyWrap = (before: string, after: string) => {
    const s = selRef.current;
    if (!s) return;
    const b = blocks[s.i];
    const text = blockText(b);
    if (text === null) return;
    const sel = text.slice(s.start, s.end);
    if (!sel) return;
    writeText(s.i, text.slice(0, s.start) + before + sel + after + text.slice(s.end));
    selRef.current = null;
    setLinkOpen(false);
    setLinkUrl('');
  };

  const confirmLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/.+\..+/.test(url)) {
      setErr('Link needs a full https:// URL.');
      return;
    }
    applyWrap('[', `](${url})`);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErr('Only image files.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErr('Images must be under 5 MB.');
      return;
    }
    setUpBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const ext =
        (f.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await sb.storage
        .from('blog-media')
        .upload(path, f, { contentType: f.type });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from('blog-media').getPublicUrl(path);
      setBlocks((prev) => [...prev, { t: 'img', c: data.publicUrl, alt: '', caption: '' }]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUpBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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
    const clean = cleanBlocks(blocks);
    if (clean.length === 0) {
      setErr('Add at least one block with content.');
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
        body: clean,
        tag,
        minutes: Math.max(1, Math.round(wordsOf(clean) / 200)),
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

  const inputCls =
    'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint';
  const toolBtn =
    'rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-extrabold text-soft transition hover:border-faint disabled:opacity-40';

  const changeType = (i: number, t: BlockType) => {
    const b = blocks[i];
    if (t === 'ul') {
      const text = blockText(b) ?? '';
      setBlock(i, { t: 'ul', c: text ? text.split('\n') : [''] });
    } else if (t === 'img') {
      setBlock(i, { t: 'img', c: '', alt: '', caption: '' });
    } else if (t === 'video') {
      setBlock(i, { t: 'video', c: '' });
    } else {
      const text = blockText(b) ?? '';
      setBlock(i, { t: t as TextType, c: text });
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-line bg-paper px-2.5 py-1 font-bold text-soft">
            {initial ? initial.status : 'new'}
          </span>
          {initial?.published_at ? (
            <span className="text-muted">
              published {new Date(initial.published_at).toLocaleDateString('en-GB')}
            </span>
          ) : null}
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
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              preview
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:border-faint'
            }`}
          >
            Preview
          </button>
        </div>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Title
          <input value={title} onChange={(e) => onTitle(e.target.value)} className={inputCls} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-muted">
            Slug
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              className={inputCls}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-muted">
            Tag
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as Category)}
              className={inputCls}
            >
              {BLOG_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Description (cards + SEO)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </label>
      </div>

      {preview ? (
        <div className="rounded-2xl border border-line bg-card p-4 sm:p-8">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">{title || 'Untitled'}</h2>
          {description ? <p className="mt-3 text-lg text-muted">{description}</p> : null}
          <hr className="my-6 border-line" />
          <Prose blocks={cleanBlocks(blocks)} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-card px-3 py-2">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-faint">
              Select text, then:
            </span>
            <button type="button" onClick={() => applyWrap('**', '**')} className={toolBtn}>
              B
            </button>
            <button type="button" onClick={() => applyWrap('*', '*')} className={toolBtn}>
              <em>I</em>
            </button>
            <button type="button" onClick={() => setLinkOpen((v) => !v)} className={toolBtn}>
              Link
            </button>
            {linkOpen ? (
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className={`${inputCls} !py-1.5`}
                />
                <button type="button" onClick={confirmLink} className={toolBtn}>
                  ✓
                </button>
              </span>
            ) : null}
          </div>

          {blocks.map((b, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={b.t}
                  onChange={(e) => changeType(i, e.target.value as BlockType)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs font-bold"
                >
                  {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
                    <option key={t} value={t}>
                      {BLOCK_LABELS[t]}
                    </option>
                  ))}
                </select>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-xs font-bold disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === blocks.length - 1}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-xs font-bold disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => delBlock(i)}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-xs font-bold text-red-600"
                >
                  ✕
                </button>
              </div>
              {b.t === 'ul' ? (
                <textarea
                  value={b.c.join('\n')}
                  onChange={(e) => setBlock(i, { t: 'ul', c: e.target.value.split('\n') })}
                  onSelect={trackSel(i)}
                  rows={Math.max(2, b.c.length + 1)}
                  placeholder="One item per line"
                  className={`${inputCls} mt-2`}
                />
              ) : b.t === 'img' ? (
                <div className="mt-2 grid gap-2">
                  {b.c ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.c}
                      alt={b.alt ?? ''}
                      className="max-h-64 w-full rounded-xl border border-line object-cover"
                    />
                  ) : null}
                  <input
                    value={b.alt ?? ''}
                    onChange={(e) => setBlock(i, { ...b, alt: e.target.value })}
                    placeholder="Alt text (accessibility)"
                    className={inputCls}
                  />
                  <input
                    value={b.caption ?? ''}
                    onChange={(e) => setBlock(i, { ...b, caption: e.target.value })}
                    placeholder="Caption (optional, shown under the image)"
                    className={inputCls}
                  />
                </div>
              ) : b.t === 'video' ? (
                <div className="mt-2 grid gap-2">
                  <input
                    value={b.c}
                    onChange={(e) => setBlock(i, { t: 'video', c: e.target.value })}
                    placeholder="YouTube or Vimeo URL"
                    className={inputCls}
                  />
                  {embedUrl(b.c) ? (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-line">
                      <iframe
                        src={embedUrl(b.c) ?? ''}
                        title="Video preview"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  ) : b.c.trim() ? (
                    <p className="text-xs text-muted">
                      Only YouTube and Vimeo URLs embed — anything else saves as a plain link.
                    </p>
                  ) : null}
                </div>
              ) : (
                <textarea
                  value={b.c}
                  onChange={(e) => setBlock(i, { t: b.t, c: e.target.value })}
                  onSelect={trackSel(i)}
                  rows={b.t === 'h' ? 1 : 4}
                  placeholder={
                    b.t === 'h' ? 'Section heading' : b.t === 'quote' ? 'Pull quote' : 'Paragraph'
                  }
                  className={`${inputCls} mt-2`}
                />
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5">
            {(['p', 'h', 'ul', 'quote'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addBlock(t)}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint"
              >
                + {BLOCK_LABELS[t]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upBusy}
              className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint disabled:opacity-40"
            >
              {upBusy ? 'Uploading…' : '+ Image'}
            </button>
            <button
              type="button"
              onClick={() => addBlock('video')}
              className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint"
            >
              + Video
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        </>
      )}

      {err ? <p className="text-xs font-bold text-red-600">{err}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save('draft')}
          disabled={saving || upBusy}
          className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold transition disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => void save('published')}
          disabled={saving || upBusy}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone transition disabled:opacity-40"
        >
          {saving ? 'Saving…' : initial?.status === 'published' ? 'Update live post' : 'Publish'}
        </button>
        {initial?.id ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={saving || upBusy}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-red-600 transition disabled:opacity-40"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
