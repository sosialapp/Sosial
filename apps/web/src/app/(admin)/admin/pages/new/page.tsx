'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { customSlugAvailable, normalizeCustomSlug } from '@/content/sitePages';

/** Owner "new page" — title + URL, created as a draft custom page. */
export default function AdminPageNew() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = normalizeCustomSlug(slug || title);
  const ok = next.length >= 3 && customSlugAvailable(next);

  const create = async () => {
    if (!ok) {
      setErr('Pick a URL-safe slug of 3+ characters that is not taken or reserved.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { data: taken } = await sb.from('site_pages').select('slug').eq('slug', next).maybeSingle();
      if (taken) throw new Error('That URL is already taken — try another.');
      const { data: redir } = await sb
        .from('site_redirects')
        .select('from_slug')
        .eq('from_slug', next)
        .maybeSingle();
      if (redir) throw new Error('That URL redirects elsewhere — try another.');
      const { error } = await sb.from('site_pages').insert({
        slug: next,
        title: title.trim() || null,
        status: 'draft',
        is_custom: true,
        body: [],
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      router.push(`/admin/pages/${next}`);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Create failed.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/admin/pages"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink"
        aria-label="Back to pages"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      <p className="eyebrow mt-4">Owner console</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">New page</h1>
      <p className="mt-1 text-sm text-muted">
        Lives at <span className="font-bold text-ink">sosial.app/{next || 'your-url'}</span> · starts as a
        draft, so nothing is public until you publish it.
      </p>

      <div className="card mt-4 space-y-4 p-5">
        <div>
          <p className="text-xs font-bold text-muted">Page title</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Launch day checklist"
            className="field mt-1"
          />
        </div>
        <div>
          <p className="text-xs font-bold text-muted">URL slug</p>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. launch-day-checklist"
            className="field mt-1"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {next ? (
            <p className={`mt-1 text-xs font-bold ${ok ? 'text-[#2f8f5b]' : 'text-[#9F2F2D]'}`}>
              /{next} {ok ? '· available' : '· taken, reserved or too short'}
            </p>
          ) : null}
        </div>
        {err ? <p className="text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
        <button type="button" onClick={() => void create()} disabled={busy} className="btn btn-primary w-full">
          {busy ? 'Creating…' : 'Create draft'}
        </button>
      </div>
    </div>
  );
}
