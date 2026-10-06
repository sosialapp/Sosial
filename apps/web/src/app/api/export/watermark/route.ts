import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Server-side watermarking for studio exports — PASS-THROUGH.
 *
 * The preview renders the mark inside the canvas DOM (data-watermark), and
 * the export pipeline rasterises that DOM as-is, so the downloaded file is
 * pixel-identical to the live preview. This route used to composite its own
 * server mark, which produced a second, differently-styled watermark at the
 * bottom — wrong. The workspace's show_watermark setting is honoured in the
 * canvas itself (StudioEditor hides the DOM mark for paid workspaces that
 * opted out), so this endpoint just relays the client bytes.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ error: 'Empty image.' }, { status: 400 });
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large to export.' }, { status: 413 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
