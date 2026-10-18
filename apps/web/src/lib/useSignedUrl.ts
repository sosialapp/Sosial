'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Signed URL for an object in a private bucket. Signs once the auth session
 * is ready and retries a few times, because on a fresh navigation the sign
 * call can race the session / edge cold start and come back empty, which is
 * why a picture only appeared after the next click. Returns null until a URL
 * is available (and for a null path). A missing file still yields a URL
 * (signing does not check existence), so callers keep their onError fallback.
 */
export function useSignedUrl(
  path: string | null | undefined,
  bucket = 'avatars',
  expiresIn = 3600,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let dead = false;
    const key = path.split('?')[0];
    (async () => {
      const sb = createClient();
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const { data } = await sb.storage.from(bucket).createSignedUrl(key, expiresIn);
          if (data?.signedUrl) {
            if (!dead) setUrl(data.signedUrl);
            return;
          }
        } catch {
          /* session not ready yet, retry */
        }
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    })();
    return () => {
      dead = true;
    };
  }, [path, bucket, expiresIn]);

  return url;
}
