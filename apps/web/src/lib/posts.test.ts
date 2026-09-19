import { describe, expect, it } from 'vitest';
import { extFor, mimeFor, newClientId } from './posts';

describe('extFor', () => {
  it('lowers the extension and strips query strings', () => {
    expect(extFor('clip.MOV?token=abc', 'video')).toBe('mov');
    expect(extFor('photo.JPEG', 'image')).toBe('jpeg');
  });

  it('falls back by media kind when there is no extension', () => {
    expect(extFor('noext', 'image')).toBe('jpg');
    expect(extFor('noext', 'video')).toBe('mp4');
  });
});

describe('mimeFor', () => {
  it('maps image formats', () => {
    expect(mimeFor('png', 'image')).toBe('image/png');
    expect(mimeFor('webp', 'image')).toBe('image/webp');
    expect(mimeFor('gif', 'image')).toBe('image/gif');
    expect(mimeFor('jpg', 'image')).toBe('image/jpeg');
  });

  it('maps video formats', () => {
    expect(mimeFor('mov', 'video')).toBe('video/quicktime');
    expect(mimeFor('mp4', 'video')).toBe('video/mp4');
  });
});

describe('newClientId', () => {
  it('prefixes web ids and stays unique', () => {
    const a = newClientId();
    const b = newClientId();
    expect(a.startsWith('web_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
