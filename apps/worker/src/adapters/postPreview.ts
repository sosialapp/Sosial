/**
 * Helpers for the post context that rides along with the comment sweep.
 *
 * The inbox shows the post a comment belongs to, and the cheapest place to
 * learn what that post says is the read the sweep already makes to find its
 * comments. These functions turn each platform's shape into one preview.
 */

/** Captions are shown as a two-line strip, so a long one is wasted bytes. */
export const PREVIEW_CHARS = 400;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#34': '"',
  '#39;': "'",
};

/** Mastodon (and anything else HTML) down to a single line of plain text. */
export function plainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
      if (name.startsWith('#x') || name.startsWith('#X')) {
        const code = Number.parseInt(name.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      if (name.startsWith('#')) {
        const code = Number.parseInt(name.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

/** Collapse whitespace and cut to something a preview strip can hold. */
export function previewText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1).trimEnd()}\u2026` : text;
}

/** ISO-8601 UTC from whatever timestamp shape the platform sent. */
export function isoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    // Seconds vs milliseconds: anything past year 2286 is already ms.
    const ms = n > 10_000_000_000 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Collapse the per-platform media vocabularies into four buckets the inbox
 * can draw: image, video, carousel, text.
 */
export function mediaKind(value: unknown): string {
  const t = String(value ?? '').toUpperCase();
  if (!t) return 'text';
  if (t.includes('CAROUSEL') || t.includes('ALBUM')) return 'carousel';
  if (t.includes('VIDEO') || t.includes('GIF') || t.includes('AUDIO')) return 'video';
  if (t.includes('IMAGE') || t.includes('PHOTO')) return 'image';
  return 'text';
}
