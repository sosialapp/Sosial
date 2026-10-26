'use client';

/**
 * Live table changes over Supabase Realtime.
 *
 * Every surface used to learn about new rows by re-querying: comments polled
 * on a timer, and Messages had no recurring read at all. Realtime pushes the
 * row instead, so a comment the sweep just stored appears the moment it
 * lands. The migration p105 put the tables in the `supabase_realtime`
 * publication, and Realtime delivers a row only to subscribers who can read
 * it, so the policies already on `comments`/`messages`/`conversations` are
 * the whole access rule — no extra filtering is needed here beyond the
 * workspace filter that keeps traffic down.
 */

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ChangeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  commit_timestamp?: string;
}

/**
 * Runs `onChange` (collapsed to one call per burst) whenever a row of
 * `table` changes. Subscribing is not a substitute for the initial read: the
 * hook only reports changes that happen *after* the join, so callers still
 * load once and use this to stay current.
 *
 * @param table  Table to watch.
 * @param filter Column filter such as `workspace_id=eq.<uuid>`. Leave it out
 *   for a table reached through a join (`messages` has no `workspace_id`);
 *   RLS still limits delivery to rows the signed-in user may read.
 */
export function usePostgresChanges({
  table,
  filter,
  enabled = true,
  debounceMs = 250,
  onChange,
}: {
  table: string;
  filter?: string;
  enabled?: boolean;
  debounceMs?: number;
  onChange: (e: ChangeEvent) => void;
}): void {
  const latest = useRef(onChange);
  latest.current = onChange;

  // A topic unique to this hook instance: two components watching the same
  // table must not share a channel, or one unmounting would tear down the
  // other's subscription.
  const topic = useRef<string>('');
  if (!topic.current) {
    topic.current = `rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;
  }

  useEffect(() => {
    if (!enabled) return;
    const sb = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = sb
      .channel(topic.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          const event = payload as unknown as ChangeEvent;
          if (debounceMs <= 0) {
            latest.current(event);
            return;
          }
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            latest.current(event);
          }, debounceMs);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [table, filter, enabled, debounceMs]);
}