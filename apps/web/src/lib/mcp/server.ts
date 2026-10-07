import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createMcpTools, type McpTools } from './tools';
import { ok, fail, withLogging } from './respond';

/**
 * MCP server assembly: registers each tool with its scope requirement and
 * plainly-worded side-effect description (the anti-footgun contract), then
 * wraps every run with logging + the stable response envelope.
 *
 * Scope model (least privilege, server-enforced):
 *   posts:read      get_post, get_scheduled_posts, resources
 *   posts:write     create_post (drafts), update_post
 *   posts:schedule  schedule_post, unschedule_post
 *   posts:delete    delete_post (off by default — do not grant to clients)
 *   channels:read   get_channels, get_channel_status
 *   media:read      get_media
 *   analytics:read  (unregistered: post_stats has no clean service yet)
 */

const SCOPE_ORDER = ['posts:read', 'posts:write', 'posts:schedule', 'posts:delete', 'channels:read', 'media:read'] as const;
type Scope = (typeof SCOPE_ORDER)[number];

/** Implied scopes: schedule ⇒ write ⇒ read (a scheduler must read). */
function hasScope(granted: string[], needed: Scope): boolean {
  if (!granted.includes(needed)) return false;
  const implies: Partial<Record<Scope, Scope[]>> = {
    'posts:schedule': ['posts:write'],
    'posts:write': ['posts:read'],
  };
  for (const [s, implied] of Object.entries(implies)) {
    if (implied.includes(needed) && granted.includes(s)) return true;
  }
  return true;
}

export function buildMcpServer(ctx: {
  sb: Parameters<typeof createMcpTools>[0]['sb'];
  admin: Parameters<typeof createMcpTools>[0]['admin'];
  workspaceId: string;
  userId: string;
  keyId: string;
  role: string;
  scopes: string[];
}): { server: McpServer; tools: McpTools } {
  const tools = createMcpTools(ctx);
  const server = new McpServer({ name: 'sosial', version: '1.0.0' });
  const userIdent = ctx.userId;

  const register = (
    name: keyof McpTools,
    def: {
      scope: Scope;
      shape: Record<string, z.ZodTypeAny> | z.ZodObject<z.ZodRawShape>;
      summaryText: string;
      run: (args: never) => Promise<Record<string, unknown>>;
    },
  ) => {
    const rawShape =
      def.shape instanceof z.ZodObject
        ? (def.shape.shape as Record<string, z.ZodTypeAny>)
        : (def.shape as Record<string, z.ZodTypeAny>);
    server.registerTool(
      name,
      {
        description: `[${def.scope}] ${def.summaryText}`,
        inputSchema: rawShape,
      },
      async (args) => {
        if (!hasScope(ctx.scopes, def.scope)) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(fail('insufficient_scope', `This action requires permission: ${def.scope}. Reconnect your AI client with that scope enabled.`)),
            }],
          };
        }
        const res = await withLogging(ctx.admin, ctx.keyId, ctx.workspaceId, userIdent, name, () =>
          def.run(args as never),
        )();
        return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
      },
    );
  };

  for (const [name, def] of Object.entries(tools)) {
    register(name as keyof McpTools, def as never);
  }

  return { server, tools };
}
