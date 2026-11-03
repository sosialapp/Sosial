// @ts-expect-error The app tsconfig carries no Node types; vitest runs in Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { angleFor, creditsFor, readPromptHints } from './prompt';

describe('aiPrompt mirror', () => {
  it('web and mobile copies are identical', () => {
    const mobile: string = readFileSync(new URL('./prompt.ts', import.meta.url), 'utf8');
    const web: string = readFileSync(new URL('../../../apps/web/src/lib/aiPrompt.ts', import.meta.url), 'utf8');
    expect(web).toBe(mobile);
  });
});

describe('readPromptHints', () => {
  it('reads a post count', () => {
    expect(readPromptHints('3 posts announcing our summer sale, friendly tone')).toEqual({ count: 3 });
    expect(readPromptHints('three short Instagram posts about our launch')).toEqual({ count: 3 });
    expect(readPromptHints('cinco publicaciones sobre la oferta')).toEqual({ count: 5 });
    expect(readPromptHints('夏のセールの投稿を3つ')).toEqual({ count: 3 });
    expect(readPromptHints('여름 세일을 알리는 게시물 3개, 친근한 톤')).toEqual({ count: 3 });
    expect(readPromptHints('3 条帖子宣布我们的夏季促销')).toEqual({ count: 3 });
    expect(readPromptHints('3 Posts zu unserem Sommer-Sale')).toEqual({ count: 3 });
    expect(readPromptHints('3つの投稿 夏のセール')).toEqual({ count: 3 });
  });

  it('caps the count and ignores numbers inside words', () => {
    expect(readPromptHints('10 posts for the week')).toEqual({ count: 5 });
    expect(readPromptHints('how often posts should go out')).toEqual({});
    expect(readPromptHints('our 2026 roadmap')).toEqual({});
  });

  it('reads a thread and its length', () => {
    expect(readPromptHints('a 5-part thread on pricing mistakes')).toEqual({ thread: true, parts: 5 });
    expect(readPromptHints('thread about our hiring process')).toEqual({ thread: true });
    expect(readPromptHints('2 tweets thread')).toEqual({ thread: true, parts: 3 });
    expect(readPromptHints('Ein Thread in 5 Teilen über Fehler')).toEqual({ thread: true, parts: 5 });
    expect(readPromptHints('Un hilo de 5 partes sobre errores')).toEqual({ thread: true, parts: 5 });
  });

  it('is empty for a plain idea', () => {
    expect(readPromptHints('why I stopped chasing viral hacks')).toEqual({});
    expect(readPromptHints('   ')).toEqual({});
  });
});

describe('angleFor / creditsFor', () => {
  it('only directs sets and re-rolls', () => {
    expect(angleFor(0, 1)).toBeUndefined();
    expect(angleFor(0, 1, true)).toMatch(/fresh take/);
    expect(angleFor(1, 3)).toMatch(/post 2 of 3/);
  });

  it('matches the credit gate costs', () => {
    expect(creditsFor(3, false)).toBe(6);
    expect(creditsFor(1, true)).toBe(3);
  });
});
