import { supabaseAdmin } from '@/lib/supabase/admin';
import { bearerKey, hashApiKey } from '@/lib/apiKeys';

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  createdBy: string | null;
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
    .select('id, workspace_id, created_by')
    .eq('key_hash', hashApiKey(key))
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; workspace_id: string; created_by: string | null };
  void admin
    .from('workspace_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id);
  return { keyId: row.id, workspaceId: row.workspace_id, createdBy: row.created_by };
}

export function unauthorized(): Response {
  return Response.json(
    { error: 'Unauthorized — pass a workspace API key as `Authorization: Bearer <key>`.' },
    { status: 401 },
  );
}
