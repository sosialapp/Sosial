import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateApiKey } from '@/lib/apiKeys';

export const dynamic = 'force-dynamic';

function forbidden(): Response {
  return Response.json({ error: 'Only workspace owners and admins can manage API keys.' }, { status: 403 });
}

/** List this workspace's keys (hashes never leave the server). */
export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') return forbidden();
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('workspace_api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });
  if (error) return Response.json({ error: 'Could not list keys.' }, { status: 500 });
  return Response.json({ keys: data ?? [] });
}

/** Mint a key — the plaintext is returned once, right here. */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') return forbidden();
  let name = 'Zapier';
  try {
    const b = (await req.json()) as { name?: unknown };
    if (typeof b.name === 'string' && b.name.trim()) name = b.name.trim().slice(0, 60);
  } catch {
    /* default name */
  }
  const { key, hash, prefix } = generateApiKey();
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('workspace_api_keys')
    .insert({
      workspace_id: ctx.workspace.id,
      name,
      key_hash: hash,
      key_prefix: prefix,
      created_by: ctx.user.id,
    })
    .select('id, name, key_prefix, created_at')
    .single();
  if (error || !data) {
    return Response.json({ error: 'Could not create the key.' }, { status: 500 });
  }
  return Response.json({ ...(data as object), key }, { status: 201 });
}

/** Revoke a key — in-flight Zapier calls start failing closed. */
export async function DELETE(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') return forbidden();
  let id: unknown;
  try {
    id = ((await req.json()) as { id?: unknown }).id;
  } catch {
    return Response.json({ error: 'Body must be JSON with an `id`.' }, { status: 400 });
  }
  if (typeof id !== 'string' || !id) {
    return Response.json({ error: 'Body must be JSON with an `id`.' }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { error } = await admin
    .from('workspace_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id);
  if (error) return Response.json({ error: 'Could not revoke the key.' }, { status: 500 });
  return Response.json({ revoked: true });
}
