import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyApiKey } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { buildMcpServer } from '@/lib/mcp/server';
import { fail } from '@/lib/mcp/respond';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Sosial MCP endpoint (Streamable HTTP, stateless mode).
 *
 * Auth: existing workspace API key as `Authorization: Bearer <key>` —
 * the same credential model Zapier uses (hashed, shown once, revocable,
 * per-workspace), extended with scopes + optional expiry for MCP clients.
 * Every request resolves to exactly one workspace before any tool runs;
 * unauthenticated JSON-RPC never reaches the server.
 *
 * Transport notes: stateless mode = a fresh transport per request, JSON
 * responses (no held SSE streams), so it fits serverless hosting cleanly.
 */
export async function POST(req: Request) {
  const ctx = await verifyApiKey(req);
  if (!ctx) {
    return Response.json(fail('unauthenticated', 'Pass a workspace API key as `Authorization: Bearer <key>`. Create one in Team → API keys.'), { status: 401 });
  }

  // The acting user: the key's creator (fall back to the workspace owner).
  const admin = supabaseAdmin();
  let userId = ctx.createdBy;
  if (!userId) {
    const { data: owner } = await admin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('role', 'owner')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    userId = (owner as { user_id: string } | null)?.user_id ?? null;
  }
  if (!userId) {
    return Response.json(fail('unauthenticated', 'Workspace has no active owner.'), { status: 401 });
  }

  const scopes = ctx.scopes.length > 0
    ? ctx.scopes
    : ['posts:read', 'posts:write', 'posts:schedule', 'channels:read', 'media:read'];
  if (ctx.expiresAt && Date.parse(ctx.expiresAt) < Date.now()) {
    return Response.json(fail('unauthenticated', 'This API key has expired. Create a new one in Team → API keys.'), { status: 401 });
  }

  // Role of the key's creator governs approval-gated actions (members create
  // approval-gated posts exactly like in the app).
  const { data: mem } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  const role = (mem as { role?: string } | null)?.role ?? 'member';

  // A user-scoped client for service-layer parity (RLS-aware calls the tools
  // might add later); the tools primarily use the admin client, matching the
  // Zapier route's precedent.
  const sb = await createClient();

  const { server } = buildMcpServer({
    sb,
    admin,
    workspaceId: ctx.workspaceId,
    userId,
    keyId: ctx.keyId,
    role,
    scopes,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: fresh transport per request
    enableJsonResponse: true,
  });

  let handled: Response | null = null;
  const done = new Promise<void>((resolve) => {
    const realSend = transport.send.bind(transport);
    // The SDK writes to a ServerResponse-like sink; in stateless+JSON mode it
    // only needs send(). We bridge its output into a Web Response once.
    (transport as unknown as { send: (m: unknown) => Promise<void> }).send = async (message: unknown) => {
      handled = new Response(JSON.stringify(message), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      resolve();
      void realSend;
    };
  });

  try {
    await server.connect(transport);
    const body = await req.json().catch(() => null);
    await transport.handleRequest(req, body ? { parsedBody: body } : {});
  } catch {
    return Response.json(fail('internal_error', 'MCP transport error. Retry the request.'), { status: 500 });
  }
  await Promise.race([done, new Promise<void>((r) => setTimeout(r, 55_000))]);
  if (!handled) {
    return Response.json(fail('internal_error', 'MCP produced no response.'), { status: 500 });
  }
  return handled;
}

/** GET: MCP clients probe reachability here (no auth required for the ping). */
export async function GET() {
  return Response.json({ server: 'sosial', transport: 'streamable-http', stateless: true });
}
