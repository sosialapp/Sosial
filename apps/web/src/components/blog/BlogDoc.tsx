'use client';

import { useCallback } from 'react';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
} from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartColumn, ImagePlus, Link2, Plus, Trash2 } from 'lucide-react';
import { resolveEmbed } from '@/lib/richtext';
import {
  encodeChartData,
  parseChartData,
  wordsOfDoc,
  type ChartPoint,
} from '@/lib/blogConvert';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

/* ------------------------------ social embed ------------------------------ */

/** Social/video/music embed — paste any post URL, render the real thing. */
const SocialEmbed = createReactBlockSpec(
  {
    type: 'socialEmbed',
    propSchema: {
      url: { default: '' },
      caption: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const url = String(block.props.url ?? '');
      const embed = resolveEmbed(url);
      const set = (props: Record<string, string>) =>
        editor.updateBlock(block, { props: { ...block.props, ...props } });

      const uploadable = (
        <div className="blog-embed-edit">
          <input
            value={url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="Paste a YouTube, X, Instagram, TikTok, Spotify… URL"
            className="blog-embed-input"
          />
          {url ? (
            <button type="button" onClick={() => set({ url: '' })} className="blog-embed-clear">
              Clear
            </button>
          ) : null}
        </div>
      );

      return (
        <div contentEditable={false} className="blog-embed">
          {uploadable}
          {embed ? (
            <div
              className={`blog-embed-box${embed.ratio === 'auto' ? ' blog-embed-auto' : ''}`}
              style={embed.ratio === 'auto' ? { height: embed.height } : { aspectRatio: embed.ratio }}
            >
              <iframe
                src={embed.src}
                title="Embedded content"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : url ? (
            <a className="blog-embed-card" href={url} target="_blank" rel="noopener noreferrer">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{url}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                renders as a link card
              </span>
            </a>
          ) : null}
          <input
            value={String(block.props.caption ?? '')}
            onChange={(e) => set({ caption: e.target.value })}
            placeholder="Caption (optional)"
            className="blog-embed-caption"
          />
        </div>
      );
    },
  },
);

/* --------------------------------- chart --------------------------------- */

const CHART_COLORS = ['#1C1A14', '#F2A400', '#2F8F5B', '#1D7FE0', '#D6249F', '#E6A417', '#7C6FF0', '#C24E4C', '#4E9BB9', '#8A8F3A', '#B06FA8', '#5E5A50'];

function ChartCanvas({ kind, points }: { kind: string; points: ChartPoint[] }) {
  return (
    <div className="h-56 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'pie' ? (
          <PieChart>
            <Pie data={points} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : kind === 'line' ? (
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,26,20,0.12)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
            <YAxis tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#F2A400" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        ) : (
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,26,20,0.12)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
            <YAxis tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Chart block — editable data rows in the editor, recharts everywhere. */
const ChartBlock = createReactBlockSpec(
  {
    type: 'chart',
    propSchema: {
      kind: { default: 'bar', values: ['bar', 'line', 'pie'] as const },
      title: { default: '' },
      data: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const points = parseChartData(block.props.data);
      const set = (props: Record<string, string>) =>
        editor.updateBlock(block, { props: { ...block.props, ...props } });
      const setPoint = (i: number, patch: Partial<ChartPoint>) =>
        set({ data: encodeChartData(points.map((p, j) => (j === i ? { ...p, ...patch } : p))) });
      const addPoint = () => set({ data: encodeChartData([...points, { label: '', value: 0 }]) });
      const delPoint = (i: number) => set({ data: encodeChartData(points.filter((_, j) => j !== i)) });

      return (
        <div contentEditable={false} className="blog-chart">
          <div className="blog-chart-head">
            <ChartColumn className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <input
              value={String(block.props.title ?? '')}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Chart title…"
              className="blog-chart-title"
            />
            <select
              value={String(block.props.kind ?? 'bar')}
              onChange={(e) => set({ kind: e.target.value })}
              aria-label="Chart type"
              className="blog-chart-kind"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
            </select>
          </div>
          {points.length > 0 ? <ChartCanvas kind={String(block.props.kind ?? 'bar')} points={points} /> : null}
          <div className="blog-chart-rows">
            {points.map((p, i) => (
              <div key={i} className="blog-chart-row">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
                <input
                  value={p.label}
                  onChange={(e) => setPoint(i, { label: e.target.value })}
                  placeholder="Label"
                  className="blog-chart-cell"
                  aria-label={`Point ${i + 1} label`}
                />
                <input
                  value={String(p.value)}
                  onChange={(e) => setPoint(i, { value: Number(e.target.value) || 0 })}
                  inputMode="decimal"
                  className="blog-chart-cell !w-20 text-right"
                  aria-label={`Point ${i + 1} value`}
                />
                <button
                  type="button"
                  onClick={() => delPoint(i)}
                  aria-label="Remove point"
                  className="blog-chart-del"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addPoint} className="blog-chart-add">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add data point
            </button>
          </div>
        </div>
      );
    },
  },
);

/* ------------------------------- button link ------------------------------- */

/**
 * Button block — a labelled call-to-action linking anywhere (external URL or
 * an internal route like /compare). Optional image renders left of the label,
 * turning the button into a card-style link (e.g. "Sosial vs Buffer" with the
 * competitor's logo).
 */
const ButtonLink = createReactBlockSpec(
  {
    type: 'buttonLink',
    propSchema: {
      label: { default: '' },
      href: { default: '' },
      image: { default: '' },
      variant: { default: 'solid', values: ['solid', 'outline'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const label = String(block.props.label ?? '');
      const href = String(block.props.href ?? '');
      const image = String(block.props.image ?? '');
      const set = (props: Record<string, string>) =>
        editor.updateBlock(block, { props: { ...block.props, ...props } });

      const upload = async (file: File | undefined) => {
        if (!file) return;
        try {
          const uploader = (editor as unknown as { uploadFile?: (f: File) => Promise<string> }).uploadFile;
          if (typeof uploader === 'function') {
            set({ image: await uploader.call(editor, file) });
          } else {
            // No uploader on this surface — fall back to reading a data URL.
            const reader = new FileReader();
            reader.onload = () => set({ image: String(reader.result ?? '') });
            reader.readAsDataURL(file);
          }
        } catch {
          /* keep the previous image */
        }
      };

      return (
        <div contentEditable={false} className="blog-btn">
          <div className="blog-btn-row">
            <label className="blog-btn-preview" title="Button image (optional)">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full rounded-lg object-cover" />
              ) : (
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              )}
            </label>
            <input
              value={label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Button label — e.g. Sosial vs Buffer"
              aria-label="Button label"
              className="blog-btn-label"
            />
            <input
              value={href}
              onChange={(e) => set({ href: e.target.value })}
              placeholder="https://… or /compare"
              aria-label="Button link"
              className="blog-btn-href"
            />
            <select
              value={String(block.props.variant ?? 'solid')}
              onChange={(e) => set({ variant: e.target.value })}
              aria-label="Button style"
              className="blog-btn-variant"
            >
              <option value="solid">Solid</option>
              <option value="outline">Outline</option>
            </select>
          </div>
          {label || href ? (
            <div className="blog-btn-live">
              <a
                className={`rich-btn ${block.props.variant === 'outline' ? 'rich-btn-outline' : ''}`}
                href={href || '#'}
                onClick={(e) => e.preventDefault()}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="rich-btn-img" />
                ) : null}
                <span>{label || 'Button'}</span>
              </a>
            </div>
          ) : null}
        </div>
      );
    },
  },
);

/* --------------------------------- schema --------------------------------- */

export const blogSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    socialEmbed: SocialEmbed,
    chart: ChartBlock,
    buttonLink: ButtonLink,
  },
});

export type BlogDocChange = (doc: unknown[], words: number) => void;

/**
 * The BlockNote surface inside the .doc-sheet. Uploads go to Supabase
 * blog-media; every change hands the document JSON + word count upward.
 */
export default function BlogDoc({
  initial,
  onChange,
  onError,
}: {
  initial: unknown[];
  onChange: BlogDocChange;
  onError: (msg: string) => void;
}) {
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const ext =
        (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await sb.storage
        .from('blog-media')
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from('blog-media').getPublicUrl(path);
      return data.publicUrl;
    },
    [],
  );

  const editor = useCreateBlockNote({
    schema: blogSchema,
    initialContent: (initial.length ? initial : undefined) as never,
    uploadFile,
  });

  const emit = useCallback(() => {
    const doc = editor.document as unknown[];
    onChange(doc, wordsOfDoc(doc as never));
  }, [editor, onChange]);

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      editable
      onChange={emit}
    />
  );
}
