/** Shared Meta Graph helpers: timestamp/attachment normalization and
 *  plain-language errors for the refusals users actually hit. */

/** Graph sometimes returns UNIX seconds (Instagram conversations), sometimes
 *  ISO-8601. Postgres rejects the numeric string, so normalize both. */
export function isoTime(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^\d+$/.test(raw)) return new Date(Number(raw) * 1000).toISOString();
  const d = raw ? new Date(raw) : new Date(NaN);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Messenger and Instagram use different attachment shapes (image_data,
 *  video_data, file_url, media.image.uri). Pull every URL we can render. */
export function attachmentUrls(atts: any): { url: string }[] {
  const data = Array.isArray(atts?.data) ? atts.data : [];
  const out: { url: string }[] = [];
  for (const a of data) {
    const url =
      a?.image_data?.url ??
      a?.video_data?.url ??
      a?.file_url ??
      a?.media?.image?.uri ??
      a?.media?.video?.uri ??
      a?.media?.url ??
      null;
    if (typeof url === 'string' && url) out.push({ url });
  }
  return out;
}

/** Send API attachment type from the URL (image/video/file/audio). */
export function attachmentType(url: string): 'image' | 'video' | 'audio' | 'file' {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(clean)) return 'video';
  if (/\.(mp3|m4a|aac|wav|ogg)$/.test(clean)) return 'audio';
  if (/\.(jpe?g|png|gif|webp|heic|avif)$/.test(clean)) return 'image';
  return 'file';
}

/** Error with the Graph message plus the fix the user can act on. */
export function metaError(label: string, data: any, status: number): Error {
  const e = data?.error ?? {};
  const message = String(e.message ?? data?.message ?? `request failed (${status})`);
  const code = Number(e.code ?? 0);
  const sub = Number(e.error_subcode ?? 0);
  let hint = '';
  if (
    code === 10 ||
    code === 200 ||
    /permission|requires pages_|does not have permission|not available/i.test(message)
  ) {
    hint =
      ' Meta has not granted this permission to the app yet — reconnect the account after approval.';
  } else if (sub === 2018278 || /outside.*window|24.hour/i.test(message)) {
    hint = " Meta only allows replies within 24 hours of the person's last message.";
  } else if (sub === 2534013) {
    hint = ' The Facebook Page is not linked to an Instagram professional account.';
  }
  return new Error(`${label}: ${message}${hint}`);
}
