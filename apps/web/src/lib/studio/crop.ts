/**
 * Image block crop model (v2). Mirrored in mobile src/utils/crop.ts, keep in
 * sync.
 *
 * zoom is relative to the cover fit (1 = the photo just fills the frame),
 * x/y (-1..1) pick an anchor: the photo point at fraction (x+1)/2 sits on the
 * frame point at the same fraction, so -1 shows the left/top edge and +1 the
 * right/bottom. `ar` is the photo's natural aspect (w/h), which lets both
 * renderers lay the photo out in exact pixels. It never distorts, and if the
 * frame changes shape later the same anchor just shows a bit more or less.
 *
 * Crops without `v: 2` are the old model and keep their old rendering.
 */
export interface ImageCrop {
  zoom: number;
  x: number;
  y: number;
  ar?: number;
  v?: 2;
}

export const MAX_CROP_ZOOM = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function isCropV2(c: ImageCrop | undefined | null): c is ImageCrop & { ar: number; v: 2 } {
  return !!c && c.v === 2 && !!c.ar && c.ar > 0;
}

/** Size of the cover-fit window, as fractions of the photo's width/height. */
export function coverWindow(imgAspect: number, frameAspect: number): { cw: number; ch: number } {
  return imgAspect > frameAspect ? { cw: frameAspect / imgAspect, ch: 1 } : { cw: 1, ch: imgAspect / frameAspect };
}

/** Crop rect (fractions of the photo: left, top, width, height) → model. */
export function rectToCrop(
  r: { u: number; v: number; uw: number; vh: number },
  imgAspect: number,
  frameAspect: number,
): ImageCrop {
  const { cw } = coverWindow(imgAspect, frameAspect);
  const zoom = clamp(cw / Math.max(1e-6, r.uw), 1, MAX_CROP_ZOOM);
  const px = r.uw < 0.999 ? clamp(r.u / (1 - r.uw), 0, 1) : 0.5;
  const py = r.vh < 0.999 ? clamp(r.v / (1 - r.vh), 0, 1) : 0.5;
  return { zoom: r2(zoom), x: r2(px * 2 - 1), y: r2(py * 2 - 1), ar: Math.round(imgAspect * 10000) / 10000, v: 2 };
}

/** Model → crop rect in photo fractions, for the frame aspect given. */
export function cropToRect(c: ImageCrop, imgAspect: number, frameAspect: number): { u: number; v: number; uw: number; vh: number } {
  const { cw, ch } = coverWindow(imgAspect, frameAspect);
  const z = clamp(c.zoom, 1, MAX_CROP_ZOOM);
  const uw = cw / z;
  const vh = ch / z;
  const px = (clamp(c.x, -1, 1) + 1) / 2;
  const py = (clamp(c.y, -1, 1) + 1) / 2;
  return { u: px * (1 - uw), v: py * (1 - vh), uw, vh };
}

/** Where the photo sits inside a W×H frame (px), for a v2 crop. */
export function cropLayout(c: ImageCrop & { ar: number }, W: number, H: number): { width: number; height: number; left: number; top: number } {
  const z = clamp(c.zoom, 1, MAX_CROP_ZOOM);
  const cover = W / Math.max(1e-6, H) < c.ar ? { w: H * c.ar, h: H } : { w: W, h: W / c.ar };
  const width = cover.w * z;
  const height = cover.h * z;
  const px = (clamp(c.x, -1, 1) + 1) / 2;
  const py = (clamp(c.y, -1, 1) + 1) / 2;
  return { width, height, left: px * (W - width), top: py * (H - height) };
}
