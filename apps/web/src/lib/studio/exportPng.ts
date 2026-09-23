'use client';

/**
 * Export a StudioCanvas DOM node to PNG via SVG foreignObject.
 * - Google Fonts are fetched (CORS-open) and embedded as data URLs so the
 *   export keeps real letterforms (SVG-as-image blocks external resources).
 * - Every <img> is inlined to data URL first (blob: and remote alike), so
 *   the canvas never taints.
 */

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Space+Grotesk:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Crimson+Pro:wght@400;700&family=Poppins:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Anton&display=swap';

let fontCssCache: string | null = null;
let pageCssCache: string | null = null;

/**
 * The canvas is styled with Tailwind utility classes (`absolute inset-0`,
 * `object-cover`, flex centring, percentage icon sizes…). Those selectors do
 * not exist inside the export document, so the layout collapses. Re-read the
 * live stylesheet and embed it, scrubbed of anything remote:
 * - an `@font-face` still pointing at a URL stops the SVG image loading;
 * - a remote `url()` both taints the canvas and blocks the render.
 */
function collectPageCss(): string {
  if (pageCssCache !== null) return pageCssCache;
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules; // throws for cross-origin sheets
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) chunks.push(rule.cssText);
  }
  let css = chunks.join('\n');
  css = css.replace(/@import[^;]*;/g, '');
  css = css.replace(/@font-face\s*{[^}]*}/g, '');
  css = css.replace(/url\((?!["']?data:)[^)]*\)/g, 'none');
  pageCssCache = css;
  return css;
}

async function embeddedFontCss(): Promise<string> {
  if (fontCssCache !== null) return fontCssCache;
  try {
    const css = await (await fetch(FONT_CSS_URL)).text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    let out = css;
    await Promise.all(
      urls.map(async (u) => {
        try {
          const buf = await (await fetch(u)).arrayBuffer();
          let bin = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          out = out.split(u).join(`data:font/woff2;base64,${btoa(bin)}`);
        } catch {
          /* single font fails — the rest still embed */
        }
      }),
    );
    // An @font-face that still points at a remote URL makes the whole SVG
    // image refuse to load — drop those faces entirely and fall back to the
    // local stacks instead.
    out = out.replace(/@font-face\s*{[^}]*url\((?:https?:)?\/\/[^}]*}/g, '');
    fontCssCache = out;
  } catch {
    fontCssCache = '';
  }
  return fontCssCache;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** 1px transparent GIF — stands in for any image that cannot be inlined,
 *  so no remote URL ever survives into the export (remote survivors are
 *  what taint the canvas and kill toBlob). */
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function blankImage(img: HTMLImageElement): void {
  img.setAttribute('src', BLANK_IMG);
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
}

async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src);
        if (!res.ok) {
          blankImage(img);
          return;
        }
        img.setAttribute('src', await blobToDataUrl(await res.blob()));
        // Drop srcset/sizes so the inlined src is authoritative.
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        await new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      } catch {
        // Remote host refused (CORS, offline) — a remote URL left inside the
        // export taints the canvas, so swap in a blank instead of failing it.
        blankImage(img);
      }
    }),
  );

  // Belt and braces: the previous build's failure mode was a remote URL that
  // survived this pass and tainted the canvas at toBlob. Nothing that is not
  // a data URL may reach the serializer — blank it instead.
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith('data:')) blankImage(img);
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.removeAttribute('crossorigin');
    img.removeAttribute('usemap');
  }
  for (const el of Array.from(root.querySelectorAll('image, use'))) {
    for (const attr of ['href', 'xlink:href']) {
      const href = el.getAttribute(attr) ?? '';
      if (href && !href.startsWith('#') && !href.startsWith('data:')) {
        el.removeAttribute(attr);
      }
    }
  }
}

/** Render the canvas node at full post width (1080) → PNG blob. */
export async function exportCanvasPng(node: HTMLElement, fullWidth: number): Promise<Blob> {
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error('[measure] Canvas is not rendered yet — try again.');
  }
  // Layout happens at the node's natural size (identical to the preview);
  // the SVG viewBox scales that finished layout up to the export width.
  const W = fullWidth;
  const H = Math.round(rect.height * (fullWidth / rect.width));

  const rasterise = async (styleCss: string): Promise<Blob> => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    if (document.documentElement.classList.contains('dark')) clone.classList.add('dark');
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.transform = 'none';

    await inlineImages(clone);

    let svg: string;
    try {
      svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${rect.width} ${rect.height}">` +
        `<style>${styleCss}</style>` +
        `<foreignObject x="0" y="0" width="${rect.width}" height="${rect.height}">` +
        new XMLSerializer().serializeToString(clone) +
        `</foreignObject></svg>`;
    } catch {
      throw new Error('[serialize] Could not read the canvas. Try again.');
    }

    // Chrome taints canvases when the SVG image is loaded from a blob: URL.
    // html-to-image loads it from a data: URL instead — that path never taints.
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('[raster] The picture would not draw. Try again.'));
      img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[encode] Canvas unavailable.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    // Taint probe: name the offender if the browser still flags the canvas.
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch {
      const offenders: string[] = [];
      for (const el of Array.from(clone.querySelectorAll('img'))) {
        const s = el.getAttribute('src') ?? '';
        if (!s.startsWith('data:')) offenders.push(`img ${s.slice(0, 140)}`);
      }
      for (const el of Array.from(clone.querySelectorAll('image, use'))) {
        const s = el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';
        if (s && !s.startsWith('#') && !s.startsWith('data:')) offenders.push(`${el.tagName} ${s.slice(0, 140)}`);
      }
      for (const el of Array.from(clone.querySelectorAll<HTMLElement>('[style]'))) {
        const st = el.getAttribute('style') ?? '';
        if (st.includes('url(http')) offenders.push(`style ${st.slice(0, 140)}`);
      }
      throw new Error(
        offenders.length
          ? `[taint] External content kept: ${offenders.join(' | ')}`
          : '[taint] Canvas flagged dirty without a visible external reference.',
      );
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('[encode] Export failed. Try again.');
    return blob;
  };

  // First attempt embeds the real webfonts; if the SVG refuses to load
  // (a poisoned font face or a serializer hiccup), retry with system fonts.
  const pageCss = collectPageCss();
  try {
    return await rasterise(`${pageCss}\n${await embeddedFontCss()}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('[raster]')) return rasterise(pageCss);
    throw e;
  }
}
