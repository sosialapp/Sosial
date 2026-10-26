import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PICK_COOKIE, b64d, type PickState } from '@/lib/oauthServer';

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * GET /api/oauth/fb-page-avatar?page_id=…
 *
 * Page pictures are 500-byte signed CDN URLs, and the pick cookie is capped at
 * ~3.8 KB, so fitPick() sheds them the moment a login has more than a few
 * Pages. The picker renders this URL instead: short, always available, and the
 * Page token never leaves the server. 302 to the CDN so the browser fetches the
 * bytes itself; anything missing just falls through to the brand disc.
 */
export async function GET(req: Request) {
  const pageId = new URL(req.url).searchParams.get('page_id') ?? '';
  if (!pageId) return new NextResponse(null, { status: 400 });

  const jar = await cookies();
  const pick = b64d<PickState>(jar.get(PICK_COOKIE)?.value);
  const page = pick?.pages.find((p) => p.id === pageId);
  if (!page?.access_token) return new NextResponse(null, { status: 404 });

  try {
    const r = await fetch(
      `${GRAPH}/${encodeURIComponent(pageId)}/picture?redirect=false&type=normal&width=160` +
        `&access_token=${encodeURIComponent(page.access_token)}`,
      { cache: 'no-store' },
    );
    const j = (await r.json().catch(() => null)) as { data?: { url?: unknown } } | null;
    const url = typeof j?.data?.url === 'string' ? j.data.url : '';
    if (!r.ok || !url) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, {
      status: 302,
      headers: { Location: url, 'Cache-Control': 'private, max-age=600' },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
