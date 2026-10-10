import { describe, expect, it } from 'vitest';
import type { TipTapDoc } from './blogConvert';
import {
  ARTICLE_CHANNELS,
  articleIsEmpty,
  articleOptions,
  articlePlainText,
  isArticleProvider,
  tiptapToArticleHtml,
  tiptapToMarkdown,
} from './article';

const doc = (content: TipTapDoc['content']): TipTapDoc => ({ type: 'doc', content });

describe('isArticleProvider', () => {
  it('recognises the four website channels', () => {
    for (const p of ARTICLE_CHANNELS) expect(isArticleProvider(p)).toBe(true);
  });
  it('rejects social channels', () => {
    expect(isArticleProvider('x')).toBe(false);
    expect(isArticleProvider('instagram')).toBe(false);
    expect(isArticleProvider('')).toBe(false);
  });
});

describe('tiptapToMarkdown', () => {
  it('maps headings, lists, quotes, code, rules and images', () => {
    const d = doc([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world', marks: [{ type: 'bold' }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] },
      ] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
      ] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted' }] }] },
      { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const a = 1;' }] },
      { type: 'horizontalRule' },
      { type: 'image', attrs: { src: 'https://x/y.png', alt: 'pic' } },
    ]);
    expect(tiptapToMarkdown(d)).toBe(
      [
        '## Title',
        '',
        'Hello **world**',
        '',
        '- One',
        '- Two',
        '',
        '1. First',
        '',
        '> Quoted',
        '',
        '```ts\nconst a = 1;\n```',
        '',
        '---',
        '',
        '![pic](https://x/y.png)',
      ].join('\n'),
    );
  });

  it('renders inline marks and links', () => {
    const d = doc([
      { type: 'paragraph', content: [
        { type: 'text', text: 'a', marks: [{ type: 'italic' }] },
        { type: 'text', text: 'b', marks: [{ type: 'strike' }] },
        { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://a.b' } }] },
      ] },
    ]);
    expect(tiptapToMarkdown(d)).toBe('*a*~~b~~[link](https://a.b)');
  });

  it('nests lists', () => {
    const d = doc([
      { type: 'bulletList', content: [
        { type: 'listItem', content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }] },
          ] },
        ] },
      ] },
    ]);
    expect(tiptapToMarkdown(d)).toBe('- Parent\n  - Child');
  });

  it('escapes block-leading characters in paragraphs', () => {
    const d = doc([{ type: 'paragraph', content: [{ type: 'text', text: '# not a heading' }] }]);
    expect(tiptapToMarkdown(d)).toBe('\\# not a heading');
  });
});

describe('tiptapToArticleHtml', () => {
  it('renders semantic HTML with links and captions', () => {
    const d = doc([
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Hi' }] },
      { type: 'paragraph', content: [
        { type: 'text', text: 'see ' },
        { type: 'text', text: 'here', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://a.b' } }] },
      ] },
      { type: 'image', attrs: { src: 'https://x/y.png', alt: 'a&b', title: 'cap' } },
    ]);
    expect(tiptapToArticleHtml(d)).toBe(
      '<h3>Hi</h3>\n<p>see <a href="https://a.b" target="_blank" rel="noopener noreferrer"><strong>here</strong></a></p>\n<figure><img src="https://x/y.png" alt="a&amp;b" loading="lazy" /><figcaption>cap</figcaption></figure>',
    );
  });

  it('escapes text content', () => {
    const d = doc([{ type: 'paragraph', content: [{ type: 'text', text: '<script>&' }] }]);
    expect(tiptapToArticleHtml(d)).toBe('<p>&lt;script&gt;&amp;</p>');
  });
});

describe('articleIsEmpty / articlePlainText', () => {
  it('treats an empty paragraph doc as empty', () => {
    expect(articleIsEmpty(doc([{ type: 'paragraph' }]))).toBe(true);
    expect(articleIsEmpty(null)).toBe(true);
  });
  it('treats text, images and rules as content', () => {
    expect(articleIsEmpty(doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]))).toBe(false);
    expect(articleIsEmpty(doc([{ type: 'image', attrs: { src: 'https://x/y.png' } }]))).toBe(false);
    expect(articleIsEmpty(doc([{ type: 'horizontalRule' }]))).toBe(false);
  });
  it('flattens text and skips images', () => {
    const d = doc([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
      { type: 'image', attrs: { src: 'https://x/y.png' } },
    ]);
    expect(articlePlainText(d)).toBe('Title\n\nBody');
  });
});

describe('articleOptions', () => {
  it('bundles json, html and markdown', () => {
    const d = doc([{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }]);
    const { article } = articleOptions(d);
    expect(article.json).toEqual(d);
    expect(article.html).toBe('<p>Hi</p>');
    expect(article.markdown).toBe('Hi');
  });
});
