'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STUDIO_TONES } from '@/lib/aiStudio';
import { AI_MODEL_LABEL } from '@/lib/billing/aiCredits';

/** Idea -> full SEO draft. One line per idea (max 3 per batch), the edge
 *  writes the article and the route saves it as a draft row you edit. */
export default function AdminBlogGenerate() {
  const router = useRouter();
  const [ideas, setIdeas] = useState('');
  const [tone, setTone] = useState('auto');
  const [audience, setAudience] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; slug: string }[]>([]);

  const onePerLine = ideas.split('\n').map((l) => l.trim()).filter(Boolean);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setDone([]);
    try {
      const res = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideas: onePerLine,
          tone: tone === 'auto' ? '' : STUDIO_TONES.find((t) => t.id === tone)?.label ?? '',
          audience: audience.trim(),
          keywords: keywords.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error ?? 'Generation failed.');
      const list = (j.created ?? []) as { title: string; slug: string }[];
      setDone(list);
      router.push('/admin/blog');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">SEO autopilot</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Generate blog drafts
      </h1>
      <p className="mt-2 text-sm text-muted">
        One idea per line. Each becomes a full SEO article draft: meta title and description,
        H2 sections, FAQ, images, ready to edit and publish.
      </p>

      <label className="mt-5 block text-xs font-bold text-soft">Ideas (up to 3 per batch)</label>
      <textarea
        value={ideas}
        onChange={(e) => setIdeas(e.target.value)}
        rows={4}
        placeholder={'How to schedule TikTok posts without the app\nBest times to post on Instagram in 2026\nCross-posting to Bluesky and Mastodon safely'}
        className="mt-1.5 w-full resize-y rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink outline-none focus:border-accent"
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-soft">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
          >
            {STUDIO_TONES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-soft">Audience (optional)</label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="freelance social media managers"
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      </div>

      <label className="mt-4 block text-xs font-bold text-soft">Keywords to target (optional)</label>
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="schedule tiktok posts, instagram best times"
        className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
      />

      {err ? (
        <p className="mt-4 rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-bold text-accent-ink">
          {err}
        </p>
      ) : null}

      <button
        onClick={() => void submit()}
        disabled={busy || onePerLine.length === 0}
        className="mt-5 w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-bone disabled:opacity-40"
      >
        {busy
          ? `Drafting ${Math.min(3, onePerLine.length)} article${onePerLine.length === 1 ? '' : 's'}…`
          : `Generate ${Math.min(3, onePerLine.length) || ''} draft${onePerLine.length === 1 ? '' : 's'}`}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        {AI_MODEL_LABEL} writes, Openverse supplies commercial-licensed images. Drafts land in the list,
        nothing publishes by itself.
      </p>
    </div>
  );
}
