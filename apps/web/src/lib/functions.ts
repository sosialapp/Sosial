/**
 * supabase-js throws FunctionsHttpError("Edge Function returned a non-2xx
 * status code") with the raw Response on `context`. Some runtimes (older
 * undici inside Next serverless) can throw when reading a consumed body via
 * clone(), so read the body through whatever interface the Response exposes:
 * text() first, JSON.parse after — JSON, HTML and empty bodies all resolve.
 */
export async function edgeErrorBody(err: unknown): Promise<string | null> {
  try {
    const ctx = (err as { context?: unknown }).context;
    const res = ctx as Response | null;
    if (res && typeof res.text === 'function') {
      const raw = await res.text().catch(() => '');
      if (!raw) return null;
      try {
        const j = JSON.parse(raw);
        const msg = (j as { error?: unknown }).error;
        return typeof msg === 'string' && msg ? msg : null;
      } catch {
        // HTML/plain body: surface a trimmed version if it looks useful
        const stripped = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return stripped.length > 0 && stripped.length < 200 ? stripped : null;
      }
    }
    const direct = (ctx as { error?: unknown } | null)?.error;
    return typeof direct === 'string' && direct ? direct : null;
  } catch {
    return null;
  }
}

/** Alias kept for the existing call sites. */
export const edgeErrorMessage = edgeErrorBody;
