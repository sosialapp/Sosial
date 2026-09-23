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

async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
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
        /* remote host refused — draw without it rather than fail export */
      }
    }),
  );
}

/** Render the canvas node at full post width (1080) → PNG blob. */
export async function exportCanvasPng(node: HTMLElement, fullWidth: number): Promise<Blob> {
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error('[measure] Canvas is not rendered yet — try again.');
  }
  const scale = fullWidth / rect.width;
  const W = fullWidth;
  const H = Math.round(rect.height * scale);

  const rasterise = async (fontCss: string): Promise<Blob> => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    // Render at full width inside the clone so text wraps identically.
    clone.style.width = `${W}px`;
    clone.style.height = `${H}px`;
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = 'top left';
    clone.style.margin = '0';

    await inlineImages(clone);

    let svg: string;
    try {
      svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
        `<style>${fontCss}</style>` +
        `<foreignObject x="0" y="0" width="${W}" height="${H}">` +
        new XMLSerializer().serializeToString(clone) +
        `</foreignObject></svg>`;
    } catch {
      throw new Error('[serialize] Could not read the canvas. Try again.');
    }

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('[raster] The picture would not draw. Try again.'));
        img.src = url;
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
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('[encode] Export failed. Try again.');
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // First attempt embeds the real webfonts; if the SVG refuses to load
  // (a poisoned font face or a serializer hiccup), retry with system fonts.
  try {
    return await rasterise(await embeddedFontCss());
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('[raster]')) return rasterise('');
    throw e;
  }
}
