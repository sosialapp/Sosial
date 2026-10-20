import { createClient } from '@/lib/supabase/server';
import { normalizeInitialDoc, cleanDocForPublish, wordsOfTipTap } from '@/lib/blogConvert';
import { tiptapToProseHtml } from '@/lib/blogHtml';
import { BLOG_TAGS, type Category } from '@/content/types';

/** Owner console: turn ideas into SEO-drafted blog rows. Owner generate-blog
 *  edge writes the copy (admin-gated, OpenAI + Openverse), this route
 *  slugifies, serializes body_html, inserts drafts through the caller's
 *  admin-gated session and returns what it saved. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isTag(v: unknown): v is Category {
  return typeof v === 'string' && (BLOG_TAGS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: isAdmin } = await sb.rpc('is_app_admin');
  if (!isAdmin) return Response.json({ error: 'Admins only.' }, { status: 403 });

  let payload: { ideas?: unknown; tone?: unknown; audience?: unknown; keywords?: unknown };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const ideas = Array.isArray(payload.ideas)
    ? payload.ideas
        .filter((i): i is string => typeof i === 'string')
        .map((i) => i.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (ideas.length === 0) {
    return Response.json({ error: 'Add at least one idea, one per line.' }, { status: 400 });
  }
  const tone = typeof payload.tone === 'string' ? payload.tone : '';
  const audience = typeof payload.audience === 'string' ? payload.audience : '';
  const keywords = typeof payload.keywords === 'string' ? payload.keywords : '';

  const { data: gen, error: genErr } = await sb.functions.invoke('generate-blog', {
    body: { ideas, tone, audience, keywords },
  });
  if (genErr || !gen) {
    const msg =
      (gen as { error?: string } | null)?.error || genErr?.message || 'AI generation failed.';
    return Response.json({ error: msg }, { status: 502 });
  }
  const drafts = Array.isArray((gen as { drafts?: unknown }).drafts)
    ? ((gen as { drafts: Record<string, unknown>[] }).drafts)
    : [];

  // Uniqueness across everything already stored plus this batch.
  const { data: existingSlugs } = await sb.from('blog_posts').select('slug');
  const taken = new Set<string>((existingSlugs ?? []).map((r) => String(r.slug)));

  const created: { id: string; slug: string; title: string }[] = [];
  for (const d of drafts) {
    const title = typeof d.title === 'string' ? d.title.trim().slice(0, 110) : '';
    if (!title) continue;
    const doc = cleanDocForPublish(normalizeInitialDoc(d.blocks));
    if (doc.content.length === 0) continue;
    const bodyHtml = tiptapToProseHtml(doc);
    if (!bodyHtml.trim()) continue;

    const base = slugify(String(d.slug_hint ?? title)) || 'post';
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);

    const words = wordsOfTipTap(doc);
    const tag = isTag(d.tag) ? d.tag : 'Strategy';
    const coverUrl =
      typeof (d.cover as { url?: unknown } | null)?.url === 'string' &&
      String((d.cover as { url?: unknown } | null)?.url).startsWith('https://')
        ? String((d.cover as { url?: unknown }).url)
        : null;
    const coverAlt =
      coverUrl && typeof (d.cover as { alt?: unknown }).alt === 'string'
        ? String((d.cover as { alt?: unknown }).alt).slice(0, 160)
        : null;

    const inserted = await sb
      .from('blog_posts')
      .insert({
        slug,
        title,
        description: typeof d.description === 'string' ? d.description.trim().slice(0, 160) : '',
        body: doc,
        body_html: bodyHtml,
        tag,
        cover_url: coverUrl,
        cover_alt: coverAlt,
        show_cover_home: false,
        minutes: Math.max(1, Math.round((d.minutes as number | undefined ?? words / 200))),
        status: 'draft',
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (inserted.data) created.push({ id: inserted.data.id, slug, title });
  }

  if (created.length === 0) {
    return Response.json(
      { error: 'Every draft came back too thin to save, try again.' },
      { status: 502 },
    );
  }
  return Response.json({ created });
}
