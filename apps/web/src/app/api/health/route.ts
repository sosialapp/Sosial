import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Plain liveness probe for the self-hosted container (Docker healthcheck,
 * Uptime Kuma). Deliberately touches nothing — a Supabase or network outage
 * should not restart the web container, it should show up in the app.
 */
export function GET() {
  return NextResponse.json({ ok: true, uptime: Math.round(process.uptime()) });
}
