/**
 * supabase-js throws FunctionsHttpError("Edge Function returned a non-2xx
 * status code") with the server's JSON body on `context` — dig out our
 * `error` message so the user sees the real reason (out of credits, not
 * signed in, …) instead of the generic wrapper text.
 */
export async function edgeErrorMessage(err: unknown): Promise<string | null> {
  try {
    const ctx = (err as { context?: unknown }).context;
    const res = ctx as Response | null;
    const body =
      res && typeof res.json === 'function'
        ? await (typeof res.clone === 'function' ? res.clone() : res)
            .json()
            .catch(() => null)
        : (ctx as { error?: unknown } | null);
    const msg = (body as { error?: unknown } | null)?.error;
    return typeof msg === 'string' && msg ? msg : null;
  } catch {
    return null;
  }
}
