import { describe, expect, it } from 'vitest';
import { markdownToPlain, renderDocMarkdown } from './docsMarkdown';

describe('renderDocMarkdown', () => {
  it('gives h2/h3 unique ids and returns the outline', () => {
    const { html, headings } = renderDocMarkdown('# Top\n\n## Setup\n\n### Step one\n\n## Setup');
    expect(headings).toEqual([
      { id: 'setup', text: 'Setup', depth: 2 },
      { id: 'step-one', text: 'Step one', depth: 3 },
      { id: 'setup-1', text: 'Setup', depth: 2 },
    ]);
    expect(html).toContain('<h2 id="setup">');
    expect(html).toContain('<h2 id="setup-1">');
    expect(html).toContain('<h1>Top</h1>');
  });

  it('escapes raw HTML instead of rendering it', () => {
    const { html } = renderDocMarkdown('<script>alert(1)</script>\n\nHi <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops script URLs from links and images', () => {
    const { html } = renderDocMarkdown('[x](javascript:alert(1)) ![y](data:text/html,hi) [ok](/scheduling-posts)');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text');
    expect(html).toContain('href="/scheduling-posts"');
  });

  it('opens external links in a new tab and escapes code', () => {
    const { html } = renderDocMarkdown('[Sosial](https://sosial.app)\n\n```bash\necho "<b>"\n```');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('class="language-bash"');
    expect(html).toContain('echo &quot;&lt;b&gt;&quot;');
  });

  it('wraps tables so they scroll', () => {
    const { html } = renderDocMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<div class="docs-table"><table>');
    expect(html).toContain('<td>1</td>');
  });
});

describe('markdownToPlain', () => {
  it('strips syntax and code blocks', () => {
    expect(markdownToPlain('## Hi\n\nSee [docs](/x) and **bold**.\n\n```\ncode\n```')).toBe('Hi See docs and bold.');
  });
});
