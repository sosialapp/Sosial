import { supabaseAdmin } from '@/lib/supabase/admin';
import { bearerKey, hashApiKey } from '@/lib/apiKeys';

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  createdBy: string | null;
  /** Scope strings from the key row (Zapier keys default to posts:write). */
  scopes: string[];
  /** ISO expiry or null. */
  expiresAt: string | null;
}

/**
 * Bearer verification for /api/v1 (server-only: touches the service-role
 * keys table). Returns the workspace context or null. Touches
 * last_used_at on success (fire-and-forget).
 */
export async function verifyApiKey(req: Request): Promise<ApiKeyContext | null> {
  const key = bearerKey(req.headers.get('authorization'));
  if (!key) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('workspace_api_keys')
    .select('id, workspace_id, created_by, scopes, expires_at')
    .eq('key_hash', hashApiKey(key))
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string; workspace_id: string; created_by: string | null;
    scopes?: string[] | null; expires_at?: string | null;
  };
  // Expired keys fail closed (null = never expires; Zapier keys are null).
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;
  // Awaited: serverless runtimes freeze after the response, so fire-and-
  // forget writes get dropped (and an untracked key is undebuggable).
  try {
    await admin
      .from('workspace_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id);
  } catch {
    /* usage tracking must never fail the call */
  }
  return {
    keyId: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    scopes: row.scopes ?? [],
    expiresAt: row.expires_at ?? null,
  };
}

export function unauthorized(): Response {
  return Response.json(
    { error: 'Unauthorized — pass a workspace API key as `Authorization: Bearer <key>`.' },
    { status: 401 },
  );
}
