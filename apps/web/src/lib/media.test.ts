import { describe, expect, it } from 'vitest';
import { imageThumb, gridThumb, mediaThumbUrl, THUMB_WIDTHS } from './media';

const SIGNED =
  'https://jeldzdhvwlspjfnxzybl.supabase.co/storage/v1/object/sign/post-media/ws/abc/0-x.jpg?token=eyJhbGci';

describe('imageThumb', () => {
  it('rewrites a signed object URL to the render endpoint, keeping the token', () => {
    const out = imageThumb(SIGNED, THUMB_WIDTHS.sm);
    expect(out).toBe(
      'https://jeldzdhvwlspjfnxzybl.supabase.co/storage/v1/render/image/sign/post-media/ws/abc/0-x.jpg?token=eyJhbGci&width=160&quality=70&resize=contain',
    );
  });

  it('uses & when a query is already present', () => {
    const out = imageThumb(SIGNED, 96, 60);
    expect(out).toContain('?token=eyJhbGci&width=96&quality=60');
  });

  it('passes through non-storage URLs unchanged', () => {
    expect(imageThumb('https://example.com/a.jpg', 160)).toBe('https://example.com/a.jpg');
    expect(imageThumb('blob:http://localhost/x', 160)).toBe('blob:http://localhost/x');
  });

  it('passes through already-transformed URLs (no double rewrite)', () => {
    const once = imageThumb(SIGNED, 160)!;
    expect(imageThumb(once, 320)).toBe(once);
  });

  it('returns undefined for empty input', () => {
    expect(imageThumb(null, 160)).toBeUndefined();
    expect(imageThumb(undefined, 160)).toBeUndefined();
    expect(imageThumb('', 160)).toBeUndefined();
  });

  it('gridThumb uses the sm width', () => {
    expect(gridThumb(SIGNED)).toContain('width=160');
  });
});

describe('mediaThumbUrl', () => {
  it('prefers a client-generated thumb_url verbatim', () => {
    const out = mediaThumbUrl({ thumb_url: 'https://media.sosial.app/post-media/prod/w/1/thumb.webp' });
    expect(out).toBe('https://media.sosial.app/post-media/prod/w/1/thumb.webp');
  });

  it('derives a thumbnail from a signed R2 image URL', () => {
    const out = mediaThumbUrl({ signed_url: SIGNED });
    expect(out).toBe(imageThumb(SIGNED, THUMB_WIDTHS.sm));
  });

  it('returns undefined for a video with no thumb', () => {
    expect(mediaThumbUrl({ signed_url: SIGNED, kind: 'video' })).toBeUndefined();
  });

  it('returns undefined when there is nothing to work with', () => {
    expect(mediaThumbUrl({})).toBeUndefined();
    expect(mediaThumbUrl({ kind: 'image' })).toBeUndefined();
  });
});
