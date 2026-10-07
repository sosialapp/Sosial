import { logTool } from './log';

/**
 * Stable MCP response envelopes. Success: {success:true, ...data}.
 * Failure: {success:false, error_code, message} — stable codes, no stack
 * traces, no provider raw errors. Every tool result also writes a log row.
 */

type Json = Record<string, unknown>;

export function ok(data: Json): Json {
  return { success: true, ...data };
}

export function fail(
  code:
    | 'unauthenticated'
    | 'insufficient_scope'
    | 'not_found'
    | 'validation_failed'
    | 'channel_not_connected'
    | 'scheduled_in_past'
    | 'confirmation_required'
    | 'rate_limited'
    | 'internal_error',
  message: string,
  extra?: Json,
): Json {
  return { success: false, error_code: code, message, ...extra };
}

/** Wrap a tool run: timing + outcome logging around the inner result. */
export function withLogging(
  admin: { from: (t: string) => any },
  keyId: string,
  workspaceId: string,
  userId: string | null,
  tool: string,
  run: () => Promise<Json>,
): () => Promise<Json> {
  return async () => {
    const t0 = Date.now();
    try {
      const res = await run();
      const outcome = res.success === false ? String(res.error_code) : 'ok';
      await logTool(admin, keyId, workspaceId, userId, tool, outcome, Date.now() - t0);
      return res;
    } catch (e) {
      await logTool(admin, keyId, workspaceId, userId, tool, 'internal_error', Date.now() - t0);
      // Never leak stack traces or provider errors.
      return fail('internal_error', 'Something went wrong on our side. Try again.');
    }
  };
}
