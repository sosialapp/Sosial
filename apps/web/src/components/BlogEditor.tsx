'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  Image as ImageIcon,
  Italic,
  Link2,
  Plus,
  Table as TableIcon,
  Trash2,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { EmojiInput } from '@/components/Emoji';
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
  table: 'Table',
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
    else if (b.t === 'table') b.c.forEach((r) => r.forEach(count));
    else if (b.t === 'img') {
      if (b.caption) count(b.caption);
    } else if (b.t !== 'video') count(b.c);
  }
  return n;
}

/** Drop empty blocks so neither the preview nor the saved row carries husks. */
function cleanBlocks(blocks: Block[]): Block[] {  const out: Block[] = [];
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
    } else if (b.t === 'table') {
      const rows = b.c
        .map((r) => r.map((x) => x.trim()))
        .filter((r) => r.some((x) => x.length > 0));
      if (rows.length > 0) out.push({ t: 'table', c: rows, head: b.head !== false });
    } else if (b.c.trim()) {
      out.push({ t: b.t, c: b.c.trim() });
    }
  }
  return out;
}

/** Self-growing textarea for the document flow — no scrollbars inside blocks. */
function AutoTextarea({
  value,
  onChange,
  onSelect,
  onFocus,
  placeholder,
  className,
  rows = 1,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onSelect={onSelect}
      onFocus={onFocus}
      onChange={(e) => {
        onChange(e.target.value);
        const el = ref.current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-faint ${className ?? ''}`}
    />
  );
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
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
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
            : t === 'table'
              ? { t, c: [['', ''], ['', '']], head: true }
              : { t, c: '' },
    ]);

  const setCell = (i: number, r: number, cI: number, v: string) =>
    setBlocks((prev) =>
      prev.map((x, j) => {
        if (j !== i || x.t !== 'table') return x;
        return {
          ...x,
          c: x.c.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === cI ? v : cell)) : row)),
        };
      }),
    );

  const addRow = (i: number) =>
    setBlocks((prev) =>
      prev.map((x, j) => {
        if (j !== i || x.t !== 'table') return x;
        const cols = Math.max(1, ...x.c.map((r) => r.length));
        return { ...x, c: [...x.c, Array(cols).fill('')] };
      }),
    );

  const addCol = (i: number) =>
    setBlocks((prev) =>
      prev.map((x, j) => {
        if (j !== i || x.t !== 'table') return x;
        const rows = x.c.length > 0 ? x.c : [['']];
        return { ...x, c: rows.map((r) => [...r, '']) };
      }),
    );

  const delRow = (i: number, r: number) =>
    setBlocks((prev) =>
      prev.map((x, j) => {
        if (j !== i || x.t !== 'table' || x.c.length <= 1) return x;
        return { ...x, c: x.c.filter((_, ri) => ri !== r) };
      }),
    );

  const delBlock = (i: number) => setBlocks((prev) => prev.filter((_, j) => j !== i));

  /** Insert a blank block below i (the Docs-style + control). */
  const insertBelow = (i: number, t: BlockType = 'p') =>
    setBlocks((prev) => {
      const blank: Block =
        t === 'ul'
          ? { t, c: [''] }
          : t === 'img'
            ? { t, c: '', alt: '', caption: '' }
            : t === 'video'
              ? { t, c: '' }
              : t === 'table'
                ? { t, c: [['', ''], ['', '']], head: true }
                : { t: t as TextType, c: '' };
      return [...prev.slice(0, i + 1), blank, ...prev.slice(i + 1)];
    });

  /** Editable text of a block (ul joins items; media/table blocks have none). */
  const blockText = (b: Block): string | null => {
    if (b.t === 'ul') return b.c.join('\n');
    if (b.t === 'img' || b.t === 'video' || b.t === 'table') return null;
    return b.c;
  };

  const writeText = (i: number, text: string) =>
    setBlocks((prev) =>
      prev.map((x, j) => {
        if (j !== i) return x;
        if (x.t === 'ul') return { t: 'ul', c: text.split('\n') };
        if (x.t === 'img' || x.t === 'video' || x.t === 'table') return x;
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
    } else if (t === 'table') {
      setBlock(i, { t: 'table', c: [['', ''], ['', '']], head: true });
    } else {
      const text = blockText(b) ?? '';
      setBlock(i, { t: t as TextType, c: text });
    }
  };

  const words = wordsOf(blocks);
  const focusedBlock = focusedIdx !== null ? blocks[focusedIdx] : null;
  const ribbonType: TextType | 'ul' =
    focusedBlock && (focusedBlock.t === 'p' || focusedBlock.t === 'h' || focusedBlock.t === 'quote' || focusedBlock.t === 'ul')
      ? focusedBlock.t
      : 'p';
  /** Ribbon style dropdown: converts the focused text block, else appends. */
  const applyRibbonType = (t: BlockType) => {
    const i = focusedIdx;
    if (i === null || !blocks[i] || blocks[i].t === 'img' || blocks[i].t === 'video' || blocks[i].t === 'table') {
      addBlock(t);
      return;
    }
    changeType(i, t);
  };

  const ribbonBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg text-soft transition hover:bg-paper-dim hover:text-ink';

  /** One document block with a hover gutter (move · add below · delete). */
  const shell = (i: number, label: string, children: React.ReactNode) => (
    <div className="group relative">
      <div className="invisible absolute -top-2 right-0 z-10 flex items-center gap-0.5 rounded-full border border-line bg-card px-1 py-0.5 shadow-sm group-hover:visible max-md:visible">
        <span className="px-1.5 text-[10px] font-bold uppercase tracking-wide text-faint">{label}</span>
        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move block up" className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink disabled:opacity-30">
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Move block down" className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink disabled:opacity-30">
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => insertBelow(i)} aria-label="Add block below" className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => delBlock(i)} aria-label="Delete block" className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-[#9F2F2D]">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  );

  const textCls = (t: TextType | 'ul') =>
    t === 'h'
      ? 'font-display text-[26px] font-extrabold leading-snug tracking-tight'
      : t === 'quote'
        ? 'border-l-[3px] border-ink/60 pl-4 text-[17px] italic leading-relaxed text-soft'
        : 'text-[15px] leading-[1.8]';

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
            disabled={saving || upBusy}
            className="btn btn-ghost !px-3.5 !py-1.5 !text-xs"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => void save('published')}
            disabled={saving || upBusy}
            className="btn btn-primary !px-3.5 !py-1.5 !text-xs"
          >
            {saving ? 'Saving…' : initial?.status === 'published' ? 'Update live post' : 'Publish'}
          </button>
          {initial?.id ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving || upBusy}
              aria-label="Delete post"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-[#9F2F2D] transition hover:bg-[#FDEBEC] disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {/* ribbon: style · bold · italic · link · media */}
        {!preview ? (
          <div className="border-t border-line-soft">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-1.5 sm:px-6">
              <select
                value={ribbonType}
                onChange={(e) => applyRibbonType(e.target.value as BlockType)}
                aria-label="Block style"
                className="mr-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs font-bold"
              >
                <option value="p">Paragraph</option>
                <option value="h">Heading</option>
                <option value="quote">Quote</option>
                <option value="ul">List</option>
              </select>
              <button type="button" onClick={() => applyWrap('**', '**')} aria-label="Bold" title="Bold" className={ribbonBtn}>
                <Bold className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => applyWrap('*', '*')} aria-label="Italic" title="Italic" className={ribbonBtn}>
                <Italic className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setLinkOpen((v) => !v)} aria-label="Insert link" title="Link" className={ribbonBtn}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
              </button>
              {linkOpen ? (
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                    aria-label="Link URL"
                    className={`${inputCls} !py-1.5`}
                  />
                  <button type="button" onClick={confirmLink} aria-label="Apply link" className={ribbonBtn}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              ) : null}
              <span className="mx-1 h-5 w-px bg-line-soft" aria-hidden="true" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={upBusy} aria-label="Upload image" title="Image" className={ribbonBtn}>
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => addBlock('table')} aria-label="Insert table" title="Table" className={ribbonBtn}>
                <TableIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="flex-1" />
              <span className="text-[11px] font-bold text-faint">
                {upBusy ? 'Uploading…' : `${words} words`}
              </span>
            </div>
          </div>
        ) : null}
        {err ? (
          <p className="border-t border-line bg-[#FDEBEC] px-4 py-2 text-center text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
            {err}
          </p>
        ) : null}
      </div>

      {/* canvas + sheet */}
      <div className="bg-surface px-3 py-6 dark:bg-black/40 sm:px-6">
        <div className="doc-sheet mx-auto max-w-[820px] rounded-md bg-white px-5 py-8 text-[#1C1A14] shadow-[0_2px_24px_rgba(0,0,0,0.08)] sm:px-12">
          {preview ? (
            <>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">{title || 'Untitled'}</h2>
              {description ? <p className="mt-3 text-lg text-muted">{description}</p> : null}
              <hr className="my-6 border-line" />
              <Prose blocks={cleanBlocks(blocks)} />
            </>
          ) : (
            <>
              <AutoTextarea
                value={title}
                onChange={onTitle}
                placeholder="Untitled"
                ariaLabel="Post title"
                className="font-display text-[32px] font-extrabold leading-tight tracking-tight placeholder:text-faint/50"
              />
              <AutoTextarea
                value={description}
                onChange={setDescription}
                placeholder="Standfirst — one line under the title…"
                ariaLabel="Description"
                className="mt-2 text-[17px] leading-relaxed text-muted"
              />
              <hr className="my-6 border-line" />
          <div className="mt-2 space-y-5">
          {blocks.map((b, i) => (
            <div key={i}>
              {b.t === 'ul' ? shell(i, 'List', (
                <AutoTextarea
                  value={b.c.join('\n')}
                  onChange={(v) => setBlock(i, { t: 'ul', c: v.split('\n') })}
                  onSelect={trackSel(i)}
                  onFocus={() => setFocusedIdx(i)}
                  placeholder="One item per line — each line becomes a bullet"
                  ariaLabel={`List block ${i + 1}`}
                  className={textCls('ul')}
                />
              )) : b.t === 'img' ? shell(i, 'Image', (
                <div className="grid gap-2">
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
                  <EmojiInput
                    value={b.caption ?? ''}
                    onChange={(v) => setBlock(i, { ...b, caption: v })}
                    placeholder="Caption (optional, shown under the image)"
                    className={inputCls}
                  />
                </div>
              )) : b.t === 'video' ? shell(i, 'Video', (
                <div className="grid gap-2">
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
                      Only YouTube and Vimeo URLs embed. Anything else saves as a plain link.
                    </p>
                  ) : null}
                </div>
              )) : b.t === 'table' ? shell(i, 'Table', (
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-muted">
                    <input
                      type="checkbox"
                      checked={b.head !== false}
                      onChange={(e) => setBlock(i, { ...b, head: e.target.checked })}
                    />
                    First row is a header
                  </label>
                  {b.c.map((row, r) => (
                    <div key={r} className="flex items-center gap-1.5">
                      {row.map((cell, cI) => (
                        <input
                          key={cI}
                          value={cell}
                          onChange={(e) => setCell(i, r, cI, e.target.value)}
                          placeholder={r === 0 && b.head !== false ? 'Header' : 'Cell'}
                          className={`${inputCls} min-w-0 flex-1`}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => delRow(i, r)}
                        disabled={b.c.length <= 1}
                        className="rounded-lg border border-line bg-paper px-2 py-1 text-xs font-bold disabled:opacity-40"
                      >
                        −
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => addRow(i)} className={toolBtn}>
                      + Row
                    </button>
                    <button type="button" onClick={() => addCol(i)} className={toolBtn}>
                      + Column
                    </button>
                  </div>
                </div>
              )) : shell(i, BLOCK_LABELS[b.t], (
                <AutoTextarea
                  value={b.c}
                  onChange={(v) => setBlock(i, { t: b.t, c: v })}
                  onSelect={trackSel(i)}
                  onFocus={() => setFocusedIdx(i)}
                  placeholder={
                    b.t === 'h' ? 'Section heading' : b.t === 'quote' ? 'Pull quote' : 'Start writing…'
                  }
                  ariaLabel={`${BLOCK_LABELS[b.t]} block ${i + 1}`}
                  className={textCls(b.t === 'h' || b.t === 'quote' ? b.t : 'p')}
                />
              ))}
            </div>
          ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-1.5 border-t border-dashed border-line pt-4">
            {(['p', 'h', 'ul', 'quote', 'table'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addBlock(t)}
                className="flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {BLOCK_LABELS[t]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upBusy}
              className="flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint hover:text-ink disabled:opacity-40"
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {upBusy ? 'Uploading…' : 'Image'}
            </button>
            <button
              type="button"
              onClick={() => addBlock('video')}
              className="flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-faint hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Video
            </button>
          </div>
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
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
