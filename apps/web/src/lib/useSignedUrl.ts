'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type SbClient = ReturnType<typeof createClient>;

/**
 * Signed URL for an object in a private bucket.
 *
 * Callers used to sign one object at a time, so a single page paid one round
 * trip per face: the masthead avatar, every team in the switcher dropdown and
 * every member row each fired their own createSignedUrl. Each signed URL then
 * 302-redirects to R2, a second hop. This module coalesces the requests made in
 * the same tick into ONE batched call per bucket, memoises the results
 * (remounts and router.refresh never re-sign), de-dupes concurrent callers, and
 * only retries genuinely transient failures — a missing object is settled once
 * instead of burning the old 4x backoff (~1.8s) before falling back to a letter.
 *
 * The cache key is the FULL stored path, `?v=` cache-buster included, because a
 * replaced picture keeps its object key and only bumps the version: caching by
 * the sign key would keep serving the old photo. The sign request strips the
 * query string, which is not part of the object key.
 */

const DEFAULT_TTL_S = 3600;
const CACHE_BUFFER_MS = 60_000;
const NEGATIVE_TTL_MS = 30_000;
const BATCH_DELAY_MS = 12;

type CacheEntry = { url: string | null; expiresAt: number };

/** full stored path -> signed url (or null when the object doesn't exist). */
const cache = new Map<string, CacheEntry>();
/** full stored path -> the in-flight promise, so N callers share ONE request. */
const inflight = new Map<string, Promise<string | null>>();

interface Waiter {
  path: string;
  signKey: string;
  resolve: (url: string | null) => void;
}

/** bucket+ttl -> the distinct object keys queued for the next flush. */
let queue = new Map<string, { bucket: string; expiresIn: number; keys: Set<string>; waiters: Waiter[] }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const cacheKey = (bucket: string, path: string) => `${bucket}\u0000${path}`;
const signKeyOf = (path: string) => path.split('?')[0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readCache(bucket: string, path: string): string | null | undefined {
  const hit = cache.get(cacheKey(bucket, path));
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  return undefined;
}

/** Only session/network/5xx failures are worth another attempt; a 4xx means the
 *  object is genuinely absent (deleted, or lost in the cloud migration). */
function retriable(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number } | null;
  const status = e?.statusCode ?? e?.status ?? null;
  return status === null || status === 401 || status >= 500;
}

function enqueue(bucket: string, path: string, expiresIn: number): Promise<string | null> {
  const ck = cacheKey(bucket, path);
  const cached = readCache(bucket, path);
  if (cached !== undefined) return Promise.resolve(cached);
  const running = inflight.get(ck);
  if (running) return running;

  const promise = new Promise<string | null>((resolve) => {
    const groupKey = `${bucket}\u0000${expiresIn}`;
    const group = queue.get(groupKey) ?? { bucket, expiresIn, keys: new Set<string>(), waiters: [] };
    const signKey = signKeyOf(path);
    group.keys.add(signKey);
    group.waiters.push({ path, signKey, resolve });
    queue.set(groupKey, group);
    if (flushTimer === null) flushTimer = setTimeout(flushQueue, BATCH_DELAY_MS);
  });
  inflight.set(ck, promise);
  promise.finally(() => inflight.delete(ck));
  return promise;
}

async function flushQueue() {
  flushTimer = null;
  const groups = [...queue.values()];
  queue = new Map();
  const sb = createClient();
  await Promise.all(
    groups.map(async (group) => {
      const keys = [...group.keys];
      const urls = await signMany(sb, group.bucket, keys, group.expiresIn);
      const byKey = new Map(keys.map((k, i) => [k, urls[i] ?? null]));
      for (const waiter of group.waiters) {
        const url = byKey.get(waiter.signKey) ?? null;
        const ttl = url ? group.expiresIn * 1000 - CACHE_BUFFER_MS : NEGATIVE_TTL_MS;
        cache.set(cacheKey(group.bucket, waiter.path), {
          url,
          expiresAt: Date.now() + Math.max(ttl, 0),
        });
        waiter.resolve(url);
      }
    }),
  );
}

/** One batched sign request, retried only when the call itself failed. */
async function signMany(
  sb: SbClient,
  bucket: string,
  keys: string[],
  expiresIn: number,
): Promise<(string | null)[]> {
  const single = keys.length === 1;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (single) {
        const { data, error } = await sb.storage.from(bucket).createSignedUrl(keys[0], expiresIn);
        if (!error) return [data?.signedUrl ?? null];
        if (!retriable(error)) return [null];
      } else {
        const { data, error } = await sb.storage.from(bucket).createSignedUrls(keys, expiresIn);
        if (!error && data) return keys.map((_, i) => data[i]?.signedUrl ?? null);
        if (!retriable(error)) return keys.map(() => null);
      }
    } catch {
      /* network — retry */
    }
    await sleep(200 * (attempt + 1));
  }
  return keys.map(() => null);
}

/** Warm the cache for a list of paths in one batched request, so a dropdown
 *  that renders them later paints the faces immediately. */
export function prefetchSignedUrls(
  paths: (string | null | undefined)[],
  bucket = 'avatars',
  expiresIn = DEFAULT_TTL_S,
): void {
  for (const path of paths) {
    if (!path || readCache(bucket, path) !== undefined) continue;
    void enqueue(bucket, path, expiresIn);
  }
}

export function useSignedUrl(
  path: string | null | undefined,
  bucket = 'avatars',
  expiresIn = DEFAULT_TTL_S,
): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    path ? (readCache(bucket, path) ?? null) : null,
  );

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = readCache(bucket, path);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    let dead = false;
    setUrl(null);
    enqueue(bucket, path, expiresIn).then((u) => {
      if (!dead) setUrl(u);
    });
    return () => {
      dead = true;
    };
  }, [path, bucket, expiresIn]);

  return url;
}
