import { createHash, randomBytes } from 'node:crypto';

/**
 * MCP confirmation tokens (anti-footgun model). Destructive or
 * externally-visible tool calls must be confirmed twice:
 *   call 1 → { error_code: 'confirmation_required', confirmation_token }
 *   call 2 (same args + token) → executes.
 * Tokens are single-use, 5-minute TTL, bound to (workspace, key, tool, args
 * hash). Only the SHA-256 hash is stored — the plaintext lives only in the
 * agent's hands between the two calls.
 */

const TTL_MS = 5 * 60_000;

function argsHash(workspaceId: string, keyId: string, tool: string, args: unknown): string {
  return createHash('sha256').update(JSON.stringify({ workspaceId, keyId, tool, args })).digest('hex');
}

export interface ConfirmCheck {
  required: boolean;
  token?: string;
  summary?: string;
  expiresIn?: number;
  message?: string;
}

export function mcpConfirmGuard(admin: {
  from: (t: string) => any;
}, workspaceId: string, keyId: string) {
  async function check(
    tool: string,
    args: Record<string, unknown>,
    summary: () => Promise<string> | string,
    destructive: boolean,
    confirm?: string,
  ): Promise<ConfirmCheck> {
    const ah = argsHash(workspaceId, keyId, tool, args);

    // A presented token: single-use consume, bound to these exact args.
    if (confirm) {
      const hash = createHash('sha256').update(confirm).digest('hex');
      const { data: row } = await admin
        .from('mcp_confirmations')
        .select('id, args_hash, expires_at')
        .eq('token_hash', hash)
        .eq('workspace_id', workspaceId)
        .eq('key_id', keyId)
        .eq('tool', tool)
        .maybeSingle();
      const rec = row as { id: string; args_hash: string; expires_at: string } | null;
      if (!rec) {
        return { required: true, message: 'Confirmation token is invalid or was already used. Call again without `confirm` to get a fresh one.' };
      }
      if (rec.args_hash !== ah) {
        await admin.from('mcp_confirmations').delete().eq('id', rec.id);
        return { required: true, message: 'Arguments changed since the confirmation was issued — confirm the new call.' };
      }
      if (Date.parse(rec.expires_at) < Date.now()) {
        await admin.from('mcp_confirmations').delete().eq('id', rec.id);
        return { required: true, message: 'Confirmation expired. Call again to get a fresh token.' };
      }
      await admin.from('mcp_confirmations').delete().eq('id', rec.id); // single use
      return { required: false };
    }

    // No token: issue one and block, unless a previous grant for the exact
    // same call is still unexpired (idempotent double-fire protection).
    const s = await summary();
    const token = randomBytes(24).toString('base64url');
    const expires = new Date(Date.now() + TTL_MS).toISOString();
    await admin.from('mcp_confirmations').insert({
      workspace_id: workspaceId,
      key_id: keyId,
      tool,
      args_hash: ah,
      token_hash: createHash('sha256').update(token).digest('hex'),
      summary: s.slice(0, 300),
      expires_at: expires,
    });
    void destructive;
    return { required: true, token, summary: s, expiresIn: TTL_MS / 1000 };
  }

  return { check };
}
