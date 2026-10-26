'use client';

import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';

/** URL-safe id from a heading's text, unique within the page. */
function slugify(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/**
 * "On this page": reads the article's h2s after it renders (works for both
 * the HTML posts and the legacy block posts), gives each an id, and lights up
 * the one being read. Hidden when an article has fewer than two sections.
 */
export function ArticleToc() {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const body = document.querySelector('[data-article-body]');
    if (!body) return;
    const used = new Set<string>();
    const heads = Array.from(body.querySelectorAll('h2'));
    const list = heads.map((h) => {
      if (!h.id) h.id = slugify(h.textContent ?? '', used);
      else used.add(h.id);
      h.style.scrollMarginTop = '96px';
      return { id: h.id, text: (h.textContent ?? '').trim() };
    });
    setItems(list.filter((i) => i.text));

    const obs = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    heads.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page">
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">On this page</p>
      <ol className="mt-3 grid gap-0.5 border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? 'location' : undefined}
              className={`-ml-px block border-l-2 py-1.5 pl-3 text-[13px] leading-snug transition ${
                active === i.id ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {i.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Copy-link plus share-to links for X, LinkedIn and Facebook. */
export function ShareLinks({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(path);
  useEffect(() => setUrl(new URL(path, window.location.origin).toString()), [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the share links still work */
    }
  };
  const enc = encodeURIComponent;
  const out = [
    { p: 'x' as const, label: 'X', href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}` },
    { p: 'linkedin' as const, label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { p: 'facebook' as const, label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line bg-card text-muted transition hover:text-ink';
  return (
    <div>
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">Share</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={btn} aria-label={copied ? 'Link copied' : 'Copy link'} title={copied ? 'Copied' : 'Copy link'}>
          {copied ? <Check className="h-4 w-4 text-[#2f8f5b]" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        </button>
        {out.map((o) => (
          <a key={o.p} href={o.href} target="_blank" rel="noopener noreferrer" className={btn} aria-label={`Share on ${o.label}`} title={`Share on ${o.label}`}>
            <BrandIcon provider={o.p} mono className="h-4 w-4" />
          </a>
        ))}
      </div>
    </div>
  );
}
