'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

const BLOCK_LABELS: Record<BlockType, string> = {
  p: 'Paragraph',
  h: 'Heading',
  ul: 'List',
  quote: 'Quote',
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
  for (const b of blocks) {
    const parts = Array.isArray(b.c) ? b.c : [b.c];
    for (const x of parts) n += x.split(/\s+/).filter(Boolean).length;
  }
  return n;
}

/** Owner post editor. Blocks match the Prose model exactly (p/h/ul/quote),
 *  so what saves is what the marketing page renders — no markdown layer. */
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setBlocks((prev) => [...prev, t === 'ul' ? { t, c: [''] } : { t, c: '' }]);

  const delBlock = (i: number) => setBlocks((prev) => prev.filter((_, j) => j !== i));

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
    const cleanBlocks: Block[] = [];
    for (const b of blocks) {
      if (b.t === 'ul') {
        const items = (Array.isArray(b.c) ? b.c : [b.c])
          .map((x) => x.trim())
          .filter((x) => x.length > 0);
        if (items.length > 0) cleanBlocks.push({ t: 'ul', c: items });
      } else {
        const text = (Array.isArray(b.c) ? b.c.join('\n') : b.c).trim();
        if (text) cleanBlocks.push({ t: b.t, c: text });
      }
    }
    if (cleanBlocks.length === 0) {
      setErr('Add at least one block with text.');
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
        body: cleanBlocks,
        tag,
        minutes: Math.max(1, Math.round(wordsOf(cleanBlocks) / 200)),
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

      {blocks.map((b, i) => (
        <div key={i} className="rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={b.t}
              onChange={(e) => {
                const t = e.target.value as BlockType;
                setBlock(i, t === 'ul' ? { t, c: [''] } : { t, c: Array.isArray(b.c) ? b.c.join('\n') : b.c });
              }}
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
              value={(Array.isArray(b.c) ? b.c : [b.c]).join('\n')}
              onChange={(e) => setBlock(i, { t: 'ul', c: e.target.value.split('\n') })}
              rows={Math.max(2, (Array.isArray(b.c) ? b.c.length : 1) + 1)}
              placeholder="One item per line"
              className={`${inputCls} mt-2`}
            />
          ) : (
            <textarea
              value={Array.isArray(b.c) ? b.c.join('\n') : b.c}
              onChange={(e) => setBlock(i, { t: b.t, c: e.target.value })}
              rows={b.t === 'h' ? 1 : 4}
              placeholder={b.t === 'h' ? 'Section heading' : b.t === 'quote' ? 'Pull quote' : 'Paragraph'}
              className={`${inputCls} mt-2`}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => addBlock(t)}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint"
          >
            + {BLOCK_LABELS[t]}
          </button>
        ))}
      </div>

      {err ? <p className="text-xs font-bold text-red-600">{err}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save('draft')}
          disabled={saving}
          className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold transition disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => void save('published')}
          disabled={saving}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone transition disabled:opacity-40"
        >
          {saving ? 'Saving…' : initial?.status === 'published' ? 'Update live post' : 'Publish'}
        </button>
        {initial?.id ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={saving}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-red-600 transition disabled:opacity-40"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
