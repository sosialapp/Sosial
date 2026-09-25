import { describe, expect, it } from 'vitest';
import {
  bnToTipTap,
  legacyToTipTap,
  normalizeInitialDoc,
  wordsOfTipTap,
  type TipTapDoc,
} from './blogConvert';
import { tiptapToProseHtml } from './blogHtml';

describe('legacyToTipTap', () => {
  it('converts paragraphs, headings and quotes with inline marks', () => {
    const doc = legacyToTipTap([
      { t: 'p', c: 'Hello **bold** and *italic* world' },
      { t: 'h', c: 'Title here' },
      { t: 'quote', c: 'A wise line' },
    ]);
    expect(doc.type).toBe('doc');
    expect(doc.content.map((n) => n.type)).toEqual(['paragraph', 'heading', 'blockquote']);
    const marks = doc.content[0].content?.[1]?.marks?.map((m) => m.type);
    expect(marks).toEqual(['bold']);
  });

  it('links become link marks, lists group, tables keep headers', () => {
    const doc = legacyToTipTap([
      { t: 'p', c: 'See [Sosial](https://sosial.app/about) today' },
      { t: 'ul', c: ['one', 'two'] },
      { t: 'table', c: [['A', 'B'], ['1', '2']], head: true },
    ]);
    expect(doc.content[0].content?.[1]?.marks?.[0]).toMatchObject({
      type: 'link',
      attrs: { href: 'https://sosial.app/about' },
    });
    expect(doc.content[1]).toMatchObject({ type: 'bulletList' });
    expect(doc.content[1].content).toHaveLength(2);
    const table = doc.content[2];
    expect(table.content?.[0].content?.[0].type).toBe('tableHeader');
    expect(table.content?.[1].content?.[0].type).toBe('tableCell');
  });

  it('images and videos map to image and embed nodes', () => {
    const doc = legacyToTipTap([
      { t: 'img', c: 'https://x/y.jpg', caption: 'Cap' },
      { t: 'video', c: 'https://youtu.be/abc123' },
    ]);
    expect(doc.content[0]).toMatchObject({
      type: 'image',
      attrs: { src: 'https://x/y.jpg', title: 'Cap' },
    });
    expect(doc.content[1]).toMatchObject({
      type: 'socialEmbed',
      attrs: { url: 'https://youtu.be/abc123' },
    });
  });
});

describe('bnToTipTap', () => {
  it('maps custom blocks and groups flat list items', () => {
    const doc = bnToTipTap([
      { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'a' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'b' }] },
      { type: 'chart', props: { kind: 'bar', title: 'T', data: '[{"label":"A","value":1}]' } },
      { type: 'buttonLink', props: { label: 'Go', href: '/x', image: '', variant: 'solid' } },
    ]);
    expect(doc.content.map((n) => n.type)).toEqual([
      'paragraph',
      'bulletList',
      'chart',
      'buttonLink',
    ]);
    expect(doc.content[1].content).toHaveLength(2);
  });
});

describe('normalizeInitialDoc', () => {
  it('accepts TipTap docs, converts legacy and BlockNote arrays, empties to undefined', () => {
    const tip: TipTapDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] };
    expect(normalizeInitialDoc(tip)).toEqual(tip);
    expect(normalizeInitialDoc([{ t: 'p', c: 'hi' }])?.content[0].type).toBe('paragraph');
    expect(normalizeInitialDoc([{ type: 'paragraph', content: [] }])?.type).toBe('doc');
    expect(normalizeInitialDoc(null)).toBeUndefined();
    expect(normalizeInitialDoc([])).toBeUndefined();
  });
});

describe('wordsOfTipTap + tiptapToProseHtml', () => {
  const doc: TipTapDoc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello world' }] },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Score' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: { backgroundColor: '#FDF3D7' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ana' }] }],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Nine', marks: [{ type: 'textStyle', attrs: { color: '#D6249F' } }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it('counts words across headings and table cells', () => {
    expect(wordsOfTipTap(doc)).toBe(6);
  });

  it('serializes headings, header rows, cell colors and text colors', () => {
    const html = tiptapToProseHtml(doc);
    expect(html).toContain('<h2 class="rich-h2">Hello world</h2>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('background-color:#FDF3D7');
    expect(html).toContain('<span style="color:#D6249F">Nine</span>');
  });

  it('serializes charts, buttons and embeds', () => {
    const html = tiptapToProseHtml({
      type: 'doc',
      content: [
        { type: 'chart', attrs: { kind: 'bar', title: 'T', data: '[{"label":"A","value":1}]' } },
        { type: 'buttonLink', attrs: { label: 'Go', href: '/x', image: '', variant: 'solid' } },
        { type: 'socialEmbed', attrs: { url: 'https://www.youtube.com/watch?v=abc12345678', caption: '' } },
      ],
    });
    expect(html).toContain('class="sosial-chart"');
    expect(html).toContain('<a class="rich-btn" href="/x"');
    expect(html).toContain('youtube-nocookie.com/embed/abc12345678');
  });

  it('renders images inside table cells (not just paragraphs)', () => {
    const html = tiptapToProseHtml({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Logo' }] },
                    { type: 'image', attrs: { src: 'https://x/logo.png', alt: '' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(html).toContain('<td>Logo<br /><img class="rich-cell-img" src="https://x/logo.png"');
  });

  it('keeps top-level images (src attr, not url)', () => {
    const html = tiptapToProseHtml({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://x/photo.jpg', alt: '', title: 'Cap' } }],
    });
    expect(html).toContain('<img src="https://x/photo.jpg"');
    expect(html).toContain('<figcaption>Cap</figcaption>');
  });
});
