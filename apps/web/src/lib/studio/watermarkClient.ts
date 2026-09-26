'use client';

/**
 * Studio exports are watermarked SERVER-SIDE. The rendered PNG is posted to
 * /api/export/watermark, which reads the workspace's plan + watermark setting
 * from the database and returns the composited image. The client can't opt out,
 * and the clean bytes never leave the request — devtools can't strip the mark.
 *
 * Fails closed: if the round-trip fails, no file is produced rather than an
 * un-watermarked one.
 */
export async function watermarkBlob(blob: Blob): Promise<Blob> {
  const res = await fetch('/api/export/watermark', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = 'Could not prepare the export. Try again.';
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = String(j.error);
    } catch {
      /* keep the generic message */
    }
    throw new Error(msg);
  }
  const out = await res.blob();
  if (!out.size) throw new Error('Could not prepare the export. Try again.');
  return out;
}
