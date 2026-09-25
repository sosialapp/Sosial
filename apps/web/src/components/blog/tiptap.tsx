'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
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
import * as React from 'react';
import { ChartColumn, ImagePlus, Link2, Plus, Trash2 } from 'lucide-react';
import { resolveEmbed } from '@/lib/embeds';
import {
  encodeChartData,
  parseChartData,
  type ChartPoint,
} from '@/lib/blogConvert';

/**
 * TipTap schema for the blog/page editor. Core writing (StarterKit), Docs-style
 * tables, and three custom blocks ported from the old editor: social embeds,
 * charts and link buttons.
 *
 * Table superpowers vs the old editor: images inside cells, per-cell
 * background colors, colored text anywhere (Color mark), and an adjustable
 * corner radius stored on the table itself.
 */

export type Uploader = (file: File) => Promise<string>;

/* ------------------------------ table styling ------------------------------ */

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute('data-bg') ||
          (el as HTMLElement).style.backgroundColor ||
          null,
        renderHTML: (attrs) =>
          attrs.backgroundColor
            ? {
                'data-bg': attrs.backgroundColor,
                style: `background-color: ${attrs.backgroundColor}`,
              }
            : {},
      },
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute('data-bg') ||
          (el as HTMLElement).style.backgroundColor ||
          null,
        renderHTML: (attrs) =>
          attrs.backgroundColor
            ? {
                'data-bg': attrs.backgroundColor,
                style: `background-color: ${attrs.backgroundColor}`,
              }
            : {},
      },
    };
  },
});

const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      radius: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-radius'),
        renderHTML: (attrs) => (attrs.radius ? { 'data-radius': attrs.radius } : {}),
      },
    };
  },
});

/* ------------------------------- resizable image ------------------------------- */

const IMG_PRESETS = [25, 50, 75, 100];

function ResizableImageView({
  node,
  updateAttributes,
  selected,
  editor,
}: {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  selected: boolean;
  editor: { view?: { dom?: { clientWidth?: number } } };
}) {
  const width = typeof node.attrs.width === 'number' ? node.attrs.width : 100;
  const [dragW, setDragW] = React.useState<number | null>(null);
  const dragRef = React.useRef<{ startX: number; start: number; domW: number } | null>(null);
  const shown = dragW ?? width;

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const domW = editor?.view?.dom?.clientWidth || 600;
    dragRef.current = { startX: e.clientX, start: shown, domW };
    setDragW(shown);
    const move = (ev: PointerEvent) => {
      const s = dragRef.current;
      if (!s) return;
      setDragW(Math.min(100, Math.max(10, Math.round(s.start + ((ev.clientX - s.startX) / s.domW) * 100))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragW((w) => {
        if (w != null) updateAttributes({ width: w });
        return null;
      });
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <NodeViewWrapper className="tiptap-imgview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={String(node.attrs.src ?? '')}
        alt={String(node.attrs.alt ?? '')}
        title={String(node.attrs.title ?? '')}
        style={{ width: `${shown}%` }}
        draggable={false}
      />
      <span
        className="tiptap-imghandle"
        title="Drag to resize"
        onPointerDown={startDrag}
        contentEditable={false}
      />
      {selected ? (
        <span className="tiptap-imgpresets" contentEditable={false}>
          {IMG_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ width: v })}
              className={`tiptap-imgpreset${width === v ? ' tiptap-imgpreset-on' : ''}`}
            >
              {v === 100 ? 'Full' : `${v}%`}
            </button>
          ))}
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Image with a stored width (percent). Same node name, so saved docs keep working. */
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const v = (el as HTMLElement).getAttribute('data-width');
          const n = v ? Number(v) : NaN;
          return Number.isFinite(n) && n > 0 ? Math.min(100, n) : null;
        },
        renderHTML: (attrs) =>
          typeof attrs.width === 'number' ? { 'data-width': String(attrs.width) } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView as never);
  },
});

/* ------------------------------ social embed ------------------------------ */

function SocialEmbedView({
  node,
  updateAttributes,
}: {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
}) {
  const url = String(node.attrs.url ?? '');
  const embed = resolveEmbed(url);
  return (
    <NodeViewWrapper className="blog-embed">
      <div className="blog-embed-edit">
        <input
          value={url}
          onChange={(e) => updateAttributes({ url: e.target.value })}
          placeholder="Paste a YouTube, X, Instagram, TikTok, Spotify… URL"
          className="blog-embed-input"
        />
        {url ? (
          <button type="button" onClick={() => updateAttributes({ url: '' })} className="blog-embed-clear">
            Clear
          </button>
        ) : null}
      </div>
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
        <span className="blog-embed-card">
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{url}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
            renders as a link card
          </span>
        </span>
      ) : null}
      <input
        value={String(node.attrs.caption ?? '')}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        placeholder="Caption (optional)"
        className="blog-embed-caption"
      />
    </NodeViewWrapper>
  );
}

const SocialEmbed = Node.create({
  name: 'socialEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      caption: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-social-embed]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-social-embed': '',
        'data-url': node.attrs.url,
        'data-caption': node.attrs.caption,
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SocialEmbedView as never);
  },
});

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

function ChartView({
  node,
  updateAttributes,
}: {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
}) {
  const points = parseChartData(node.attrs.data);
  const kind = String(node.attrs.kind ?? 'bar');
  const set = (props: Record<string, string>) => updateAttributes(props);
  const setPoint = (i: number, patch: Partial<ChartPoint>) =>
    set({ data: encodeChartData(points.map((p, j) => (j === i ? { ...p, ...patch } : p))) });
  const addPoint = () => set({ data: encodeChartData([...points, { label: '', value: 0 }]) });
  const delPoint = (i: number) => set({ data: encodeChartData(points.filter((_, j) => j !== i)) });

  return (
    <NodeViewWrapper className="blog-chart">
      <div className="blog-chart-head">
        <ChartColumn className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
        <input
          value={String(node.attrs.title ?? '')}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Chart title…"
          className="blog-chart-title"
        />
        <select
          value={kind}
          onChange={(e) => set({ kind: e.target.value })}
          aria-label="Chart type"
          className="blog-chart-kind"
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
        </select>
      </div>
      {points.length > 0 ? <ChartCanvas kind={kind} points={points} /> : null}
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
            <button type="button" onClick={() => delPoint(i)} aria-label="Remove point" className="blog-chart-del">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" onClick={addPoint} className="blog-chart-add">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add data point
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const ChartBlock = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      kind: { default: 'bar' },
      title: { default: '' },
      data: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-chart-block]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-chart-block': '',
        'data-kind': node.attrs.kind,
        'data-title': node.attrs.title,
        'data-data': node.attrs.data,
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChartView as never);
  },
});

/* ------------------------------- button link ------------------------------- */

function ButtonView({
  node,
  updateAttributes,
  editor,
}: {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  editor: { storage: Record<string, unknown> };
}) {
  const label = String(node.attrs.label ?? '');
  const href = String(node.attrs.href ?? '');
  const image = String(node.attrs.image ?? '');
  const set = (props: Record<string, string>) => updateAttributes(props);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const uploader = editor.storage.blogUpload as Uploader | undefined;
      if (typeof uploader === 'function') {
        set({ image: await uploader(file) });
      } else {
        const reader = new FileReader();
        reader.onload = () => set({ image: String(reader.result ?? '') });
        reader.readAsDataURL(file);
      }
    } catch {
      /* keep the previous image */
    }
  };

  return (
    <NodeViewWrapper className="blog-btn">
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
          value={String(node.attrs.variant ?? 'solid')}
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
          <span
            className={`rich-btn ${node.attrs.variant === 'outline' ? 'rich-btn-outline' : ''}`}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="rich-btn-img" />
            ) : null}
            <span>{label || 'Button'}</span>
          </span>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

function makeButtonLink(uploader: Uploader) {
  return Node.create({
    name: 'buttonLink',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
      return {
        label: { default: '' },
        href: { default: '' },
        image: { default: '' },
        variant: { default: 'solid' },
      };
    },
    parseHTML() {
      return [{ tag: 'p[data-button-link]' }];
    },
    renderHTML({ node, HTMLAttributes }) {
      return [
        'p',
        mergeAttributes(HTMLAttributes, {
          'data-button-link': '',
          'data-label': node.attrs.label,
          'data-href': node.attrs.href,
          'data-image': node.attrs.image,
          'data-variant': node.attrs.variant,
        }),
      ];
    },
    addNodeView() {
      const View = (props: { node: { attrs: Record<string, unknown> }; updateAttributes: (a: Record<string, unknown>) => void }) => (
        <ButtonView
          node={props.node}
          updateAttributes={props.updateAttributes}
          editor={{ storage: { blogUpload: uploader } }}
        />
      );
      return ReactNodeViewRenderer(View as never);
    },
  });
}

/* --------------------------------- factory --------------------------------- */

/** Full extension set for the blog/page editor. The uploader backs image
 *  uploads (toolbar image, drops, pastes, button-block pictures). */
export function createBlogExtensions(uploader: Uploader) {
  return [
    StarterKit.configure({
      link: false,
      heading: { levels: [1, 2, 3] },
      dropcursor: { width: 3, color: '#F2A400' },
    }),
    Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
    TextStyle,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ResizableImage.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder: 'Start writing…' }),
    CustomTable.configure({ resizable: true }),
    TableRow,
    CustomTableHeader,
    CustomTableCell,
    SocialEmbed,
    ChartBlock,
    makeButtonLink(uploader),
  ];
}
