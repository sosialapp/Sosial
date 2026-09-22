'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const TICK_MS = 4000;
const MAX_TICKS = 6;

/**
 * Server-side avatar backfill trigger. When any connected account still lacks a
 * profile picture, ask the worker to fetch them (refresh-avatars edge function)
 * and re-render the page a few times until the pictures land. Renders nothing;
 * the brand tile stays the fallback if the worker is offline.
 */
export default function AvatarSync({
  workspaceId,
  missing,
}: {
  workspaceId: string;
  missing: number;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear polling on unmount only (missing changing mid-flight must not stop it).
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, []);

  useEffect(() => {
    if (missing <= 0 || timer.current) return;

    const sb = createClient();
    void sb.functions
      .invoke('refresh-avatars', { body: { workspace_id: workspaceId } })
      .catch(() => undefined);

    let ticks = 0;
    timer.current = setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= MAX_TICKS && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }, TICK_MS);
  }, [missing, router, workspaceId]);

  return null;
}
