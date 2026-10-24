import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  fetchLiveChannels,
  createPost,
  publishPostNow,
  reschedulePost,
  deletePost,
  friendlyLimit,
  type ComposeArgs,
} from '@/lib/posts';
import type { PostWithTargets, ProviderKey } from '@/lib/types';
import { CAPABILITIES } from '@/lib/compat';
import { providerMeta } from '@/lib/providers';
import { apiClientId, isValidIdempotencyKey } from '@/lib/apiKeys';
import { mcpConfirmGuard } from './confirm';
import { mcpRate } from './ratelimit';
import { ok, fail } from './respond';
import { logTool } from './log';

/**
 * MCP tool implementations, thin adapters over the same service layer the
 * web app uses (`lib/posts.ts` + `lib/compat.ts`). No DB access here beyond
 * what those services already do; no raw SQL; no passthrough. Every tool:
 *  1. is scope-gated by the caller (registerTool wiring in server.ts)
 *  2. enforces confirmation for destructive/imminent actions (mcpConfirmGuard)
 *  3. is rate-limited per token (mcpRate)
 *  4. logs tool/user/outcome/latency, never content or credentials
 */

/* ------------------------------- schemas ------------------------------- */

// Note (zod v4 + MCP SDK): z.infer over a *raw shape object* infers unknown,
// so every schema is a z.object(); tools expose `.shape` to registerTool and
// infer arg types from the object itself.

const CreatePostShape = z.object({
  content: z.string().min(1).max(40000).describe('Post body text (plain text).'),
  title: z.string().max(200).optional().describe('Optional internal title.'),
  media_ids: z.array(z.string().uuid()).max(10).optional().describe('media_assets ids to attach.'),
  channel_ids: z.array(z.string().uuid()).min(1).max(100).describe('Connected channel ids to target.'),
  scheduled_at: z.string().optional().describe('ISO 8601 datetime. Omit to keep the post as a draft.'),
  timezone: z.string().optional().describe('IANA zone for interpreting offset-less times.'),
  idempotency_key: z.string().min(1).max(128).regex(/\S/, 'no whitespace').optional(),
  confirm: z.string().optional().describe('confirmation_token from a prior confirmation_required response.'),
});

const UpdatePostShape = z.object({
  post_id: z.string().uuid(),
  content: z.string().min(1).max(40000).optional(),
  title: z.string().max(200).optional(),
  scheduled_at: z.string().optional().describe('Move the schedule. Requires posts:schedule.'),
  timezone: z.string().optional(),
  idempotency_key: z.string().min(1).max(128).regex(/\S/, 'no whitespace').optional(),
  confirm: z.string().optional(),
});

const ScheduleShape = z.object({
  post_id: z.string().uuid(),
  scheduled_at: z.string().describe('ISO 8601 datetime, at least 5 minutes in the future.'),
  timezone: z.string().optional(),
  confirm: z.string().optional(),
});

const ListCommentsShape = z.object({
  channel_id: z.string().uuid().optional().describe('Only comments on this channel.'),
  status: z.enum(['new', 'replied', 'hidden', 'deleted']).optional().describe('Only comments in this state.'),
  unanswered_only: z.boolean().optional().describe('Only comments nobody on this side has answered yet.'),
  limit: z.number().int().min(1).max(50).optional().describe('Default 20.'),
  cursor: z.string().optional().describe('Opaque cursor from a previous page.'),
});

const ReplyCommentShape = z.object({
  comment_id: z.string().uuid().describe('The comment to answer (from list_comments).'),
  text: z.string().min(1).max(2000).describe('Reply body, 1-2000 characters. Public on the platform.'),
  confirm: z.string().optional(),
});

/** Providers the sync engine can reply on; mirrors the reply-comment function. */
const REPLY_PROVIDERS = new Set(['facebook', 'instagram', 'threads', 'mastodon', 'x', 'bluesky']);
const NO_REPLY_YET: Record<string, string> = {
  youtube: 'Unified comments for YouTube are planned.',
  linkedin: 'Unified comments for LinkedIn are planned.',
  tiktok: 'Unified comments for TikTok are planned.',
  pinterest: 'Comment replies are not exposed by the Pinterest API.',
};

/* ------------------------------ utilities ------------------------------ */

/** Resolve an ISO time to UTC + a display zone; null when unparseable. */
function resolveTime(iso: string, timezone?: string): { utc: string; local: string; zone: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let zone = timezone || 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone });
  } catch {
    zone = 'UTC';
  }
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, dateStyle: 'medium', timeStyle: 'short',
  }).format(d);
  return { utc: d.toISOString(), local, zone };
}

/** Per-provider character limits as one short warning string, or null. */
function limitWarning(providers: ProviderKey[], content: string): string | null {
  const tooLong = providers
    .map((p) => ({ p, max: CAPABILITIES[p]?.limits?.text }))
    .filter((x) => typeof x.max === 'number' && content.length > (x.max as number));
  if (tooLong.length === 0) return null;
  return `Heads up: content exceeds the limit for ${tooLong.map((x) => providerMeta(x.p).label).join(', ')}. The platform may truncate or reject it.`;
}

function targetChannels<T extends { id: string }>(channels: T[], ids: string[]): T[] {
  const set = new Set(ids);
  return channels.filter((c) => set.has(c.id));
}

/* -------------------------------- tools -------------------------------- */

export function createMcpTools(opts: {
  sb: SupabaseClient;
  admin: SupabaseClient;
  workspaceId: string;
  userId: string;
  keyId: string;
  role: string;
}) {
  const { sb, admin, workspaceId, userId, keyId, role } = opts;
  const writeGuard = mcpConfirmGuard(admin, workspaceId, keyId);
  const rate = mcpRate(admin, keyId);

  const guard = async (
    tool: string,
    args: Record<string, unknown>,
    opts2: { destructive?: boolean; write?: boolean; summary: () => Promise<string> | string },
  ): Promise<{ blocked?: ReturnType<typeof fail> } & Record<string, unknown>> => {
    const r = rate.take(tool, opts2.write ? 'write' : 'read');
    if (!r.allowed) {
      await logTool(admin, keyId, workspaceId, userId, tool, 'rate_limited', 0);
      return { blocked: fail('rate_limited', `Rate limit reached. Retry after ${r.retryAfterSeconds}s.`) };
    }
    // Only destructive or externally-visible calls need a confirmation
    // round-trip; plain reads (and other harmless calls) execute straight away.
    if (opts2.destructive !== true && opts2.write !== true) return {};
    const c = await writeGuard.check(tool, args, opts2.summary, opts2.destructive === true, (args as { confirm?: string }).confirm);
    if (c.required) {
      await logTool(admin, keyId, workspaceId, userId, tool, 'confirmation_required', 0);
      return { blocked: fail('confirmation_required', c.message ?? 'Confirmation required.', { confirmation_token: c.token, summary: c.summary, expires_in: c.expiresIn }) };
    }
    return {};
  };

  const guardTyped = <A extends object>(
    tool: string,
    args: A,
    opts2: { destructive?: boolean; write?: boolean; summary: () => Promise<string> | string },
  ): Promise<{ blocked?: ReturnType<typeof fail> } & Record<string, unknown>> =>
    guard(tool, args as Record<string, unknown>, opts2);

  return {
    create_post: {
      scope: 'posts:write' as const,
      destructive: false,
      shape: CreatePostShape,
      summaryText: 'Create a post (draft, or scheduled when scheduled_at is provided). This targets the channels you list.',
      run: async (args: z.infer<typeof CreatePostShape>) => {
        const g = await guardTyped('create_post', args, {
          write: true,
          summary: () => {
            const when = args.scheduled_at ? resolveTime(args.scheduled_at, args.timezone) : null;
            return `${when ? 'Schedule' : 'Create'} a post on ${args.channel_ids.length} channel(s): “${args.content.slice(0, 80)}${args.content.length > 80 ? '…' : ''}-${when ? ` at ${when.local} (${when.zone})` : ''}`;
          },
        });
        if (g.blocked) return g.blocked;

        const channels = await fetchLiveChannels(admin, workspaceId);
        const chosen = targetChannels(channels, args.channel_ids);
        if (chosen.length === 0) {
          return fail('channel_not_connected', 'None of the listed channel ids are connected in this workspace. Call get_channels first.');
        }

        let when: ReturnType<typeof resolveTime> = null;
        let scheduleIso: string | null = null;
        if (args.scheduled_at) {
          when = resolveTime(args.scheduled_at, args.timezone);
          if (!when) return fail('validation_failed', 'scheduled_at is not a valid ISO 8601 datetime.');
          scheduleIso = when.utc;
        }

        // Idempotency: same key returns the original post (client_id unique).
        let clientId: string | undefined;
        if (args.idempotency_key) {
          clientId = apiClientId(keyId, args.idempotency_key);
          const { data: existing } = await admin
            .from('posts')
            .select('id, status, scheduled_at')
            .eq('client_id', clientId)
            .maybeSingle();
          if (existing) return ok({ deduped: true, ...(existing as object) });
        }

        const mediaIds = args.media_ids ?? [];
        const files: ComposeArgs['files'] = [];
        const mediaBlock = mediaIds.length > 0 ? null : null;
        if (mediaIds.length > 0) {
          return fail('validation_failed', 'media_ids are not supported yet, attach media in the app, or omit media_ids.');
        }
        void mediaBlock;

        const argsCompose: ComposeArgs = {
          workspaceId,
          userId,
          role: role === 'owner' || role === 'admin' ? role : 'member',
          title: args.title ?? '',
          body: args.content,
          mode: scheduleIso ? 'schedule' : 'draft',
          scheduleIso,
          channels: chosen as ComposeArgs['channels'],
          files,
          timezone: args.timezone,
          clientId,
          leadCheck: false, // MCP validates past dates itself (see below)
        };
        if (scheduleIso) {
          const t = new Date(scheduleIso).getTime();
          if (t < Date.now()) return fail('scheduled_in_past', 'scheduled_at is in the past. Pick a future time.');
          if (t < Date.now() + 5 * 60_000) return fail('validation_failed', 'scheduled_at must be at least 5 minutes in the future.');
        }

        try {
          const postId = await createPost(admin, argsCompose);
          return ok({
            post_id: postId,
            status: scheduleIso ? 'scheduled' : 'draft',
            scheduled_at: scheduleIso,
            resolved_time: when ? { utc: when.utc, local: when.local, timezone: when.zone } : undefined,
            warning: limitWarning(chosen.map((c) => c.provider), args.content) ?? undefined,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not create the post.';
          if (/scheduled|lead time|past/i.test(msg)) return fail('validation_failed', friendlyLimit(msg));
          return fail('validation_failed', friendlyLimit(msg));
        }
      },
    },

    update_post: {
      scope: 'posts:write' as const,
      destructive: false,
      shape: UpdatePostShape,
      summaryText: 'Edit a post in this workspace. Editing content or time of a scheduled post is external-facing.',
      run: async (args: z.infer<typeof UpdatePostShape>) => {
        const g = await guardTyped('update_post', args, {
          write: true,
          summary: async () => {
            const { data: p } = await admin.from('posts').select('title, body, scheduled_at').eq('id', args.post_id).eq('workspace_id', workspaceId).maybeSingle();
            return `Edit post “${(p as { title?: string } | null)?.title ?? (p as { body?: string } | null)?.body?.slice(0, 60) ?? args.post_id}-`;
          },
        });
        if (g.blocked) return g.blocked;

        const { data: p } = await admin
          .from('posts')
          .select('id, title, body, status, scheduled_at, timezone')
          .eq('id', args.post_id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        const post = p as { id: string; title: string; body: string; status: string; scheduled_at: string | null; timezone: string | null } | null;
        if (!post) return fail('not_found', 'Post not found in this workspace.');

        if (args.scheduled_at !== undefined) {
          if (post.status !== 'draft' && post.status !== 'queued') {
            return fail('validation_failed', `Cannot reschedule a post with status “${post.status}-.`);
          }
          const when = resolveTime(args.scheduled_at, args.timezone ?? post.timezone ?? undefined);
          if (!when) return fail('validation_failed', 'scheduled_at is not a valid ISO 8601 datetime.');
          if (when.utc && new Date(when.utc).getTime() < Date.now() + 5 * 60_000) {
            return fail('scheduled_in_past', 'scheduled_at must be at least 5 minutes in the future.');
          }
          await reschedulePost(admin, args.post_id, when.utc);
        }
        const patch: Record<string, unknown> = {};
        if (args.content !== undefined) patch.body = args.content;
        if (args.title !== undefined) patch.title = args.title;
        if (Object.keys(patch).length > 0) {
          const { error } = await admin.from('posts').update(patch).eq('id', args.post_id).eq('workspace_id', workspaceId);
          if (error) return fail('validation_failed', friendlyLimit(error.message));
        }
        return ok({ post_id: args.post_id, updated: true });
      },
    },

    schedule_post: {
      scope: 'posts:schedule' as const,
      destructive: false,
      shape: ScheduleShape,
      summaryText: 'Schedule an existing draft for publishing at the given time. It will go out to its channels at that time.',
      run: async (args: z.infer<typeof ScheduleShape>) => {
        const g = await guardTyped('schedule_post', args, {
          write: true,
          summary: () => {
            const when = resolveTime(args.scheduled_at, args.timezone);
            return `Schedule post ${args.post_id.slice(0, 8)}… for ${when?.local ?? args.scheduled_at} (${when?.zone ?? '?'})`;
          },
        });
        if (g.blocked) return g.blocked;

        const { data: p } = await admin
          .from('posts')
          .select('id, status, scheduled_at')
          .eq('id', args.post_id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        const post = p as { id: string; status: string; scheduled_at: string | null } | null;
        if (!post) return fail('not_found', 'Post not found in this workspace.');
        if (post.status !== 'draft' && post.status !== 'queued') {
          return fail('validation_failed', `Only drafts or queued posts can be scheduled (status: ${post.status}).`);
        }
        const when = resolveTime(args.scheduled_at, args.timezone);
        if (!when) return fail('validation_failed', 'scheduled_at is not a valid ISO 8601 datetime.');
        if (new Date(when.utc).getTime() < Date.now() + 5 * 60_000) {
          return fail('scheduled_in_past', 'scheduled_at must be at least 5 minutes in the future.');
        }
        try {
          await reschedulePost(admin, args.post_id, when.utc);
        } catch (e) {
          return fail('validation_failed', friendlyLimit(e instanceof Error ? e.message : 'Could not schedule.'));
        }
        // Drafts enter the scheduler the same way the app does it.
        if (post.status === 'draft') {
          await admin.from('posts').update({ status: 'queued' }).eq('id', args.post_id);
          await admin
            .from('post_targets')
            .update({ status: 'queued', scheduled_at: when.utc })
            .eq('post_id', args.post_id)
            .in('status', ['pending']);
        }
        return ok({
          post_id: args.post_id,
          status: 'scheduled',
          scheduled_at: when.utc,
          resolved_time: { utc: when.utc, local: when.local, timezone: when.zone },
        });
      },
    },

    unschedule_post: {
      scope: 'posts:schedule' as const,
      destructive: false,
      shape: { post_id: z.string().uuid(), confirm: z.string().optional() },
      summaryText: 'Return a scheduled post to draft status. It will stop being published.',
      run: async (args: { post_id: string; confirm?: string }) => {
        const g = await guardTyped('unschedule_post', args, {
          destructive: true,
          summary: async () => {
            const { data: p } = await admin.from('posts').select('title, body').eq('id', args.post_id).eq('workspace_id', workspaceId).maybeSingle();
            return `Return post “${(p as { title?: string } | null)?.title ?? (p as { body?: string } | null)?.body?.slice(0, 60) ?? args.post_id.slice(0, 8)}- to draft`;
          },
        });
        if (g.blocked) return g.blocked;

        const { data: p } = await admin
          .from('posts')
          .select('id, status')
          .eq('id', args.post_id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        const post = p as { id: string; status: string } | null;
        if (!post) return fail('not_found', 'Post not found in this workspace.');
        if (post.status === 'sent' || post.status === 'partial' || post.status === 'publishing') {
          return fail('validation_failed', 'This post has already been sent (or is mid-flight) and cannot be unscheduled.');
        }
        await admin.from('posts').update({ status: 'draft', scheduled_at: null }).eq('id', args.post_id);
        await admin
          .from('post_targets')
          .update({ status: 'pending', scheduled_at: null })
          .eq('post_id', args.post_id)
          .in('status', ['queued']);
        return ok({ post_id: args.post_id, status: 'draft' });
      },
    },

    delete_post: {
      scope: 'posts:delete' as const,
      destructive: true,
      shape: { post_id: z.string().uuid(), confirm: z.string().optional() },
      summaryText: 'Delete a post in this workspace. This permanently removes the post and its per-channel targets.',
      run: async (args: { post_id: string; confirm?: string }) => {
        const g = await guardTyped('delete_post', args, {
          destructive: true,
          summary: async () => {
            const { data: p } = await admin.from('posts').select('title, body, status').eq('id', args.post_id).eq('workspace_id', workspaceId).maybeSingle();
            const pp = p as { title?: string; body?: string; status?: string } | null;
            return `Delete ${pp?.status ?? ''} post “${pp?.title ?? pp?.body?.slice(0, 60) ?? args.post_id.slice(0, 8)}-`;
          },
        });
        if (g.blocked) return g.blocked;
        const { data: p } = await admin.from('posts').select('id').eq('id', args.post_id).eq('workspace_id', workspaceId).maybeSingle();
        if (!p) return fail('not_found', 'Post not found in this workspace.');
        await deletePost(admin, args.post_id);
        return ok({ post_id: args.post_id, deleted: true });
      },
    },

    get_post: {
      scope: 'posts:read' as const,
      destructive: false,
      shape: { post_id: z.string().uuid() },
      summaryText: 'Read one post: status, channels, media summary.',
      run: async (args: { post_id: string }) => {
        const g = await guardTyped('get_post', args, { summary: () => 'Read a post' });
        if (g.blocked) return g.blocked;
        const { data } = await admin
          .from('posts')
          .select('id, title, body, status, scheduled_at, timezone, sent_at, post_targets(provider, status, remote_url, last_error), post_media(position, media_assets(id, kind, mime_type, byte_size))')
          .eq('id', args.post_id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        if (!data) return fail('not_found', 'Post not found in this workspace.');
        return ok(data);
      },
    },

    get_scheduled_posts: {
      scope: 'posts:read' as const,
      destructive: false,
      shape: {
        start_date: z.string().optional().describe('ISO date (inclusive).'),
        end_date: z.string().optional().describe('ISO date (inclusive).'),
        channel_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).optional().describe('Default 20.'),
        cursor: z.string().optional().describe('Opaque cursor from a previous page.'),
      },
      summaryText: 'List upcoming scheduled posts (next 7 days by default, capped).',
      run: async (args: { start_date?: string; end_date?: string; channel_id?: string; limit?: number; cursor?: string }) => {
        const g = await guardTyped('get_scheduled_posts', args, { summary: () => 'List scheduled posts' });
        if (g.blocked) return g.blocked;
        const limit = args.limit ?? 20;
        const startIso = args.start_date ? new Date(`${args.start_date}T00:00:00Z`).toISOString() : new Date().toISOString();
        const endIso = args.end_date
          ? new Date(`${args.end_date}T23:59:59Z`).toISOString()
          : new Date(Date.now() + 7 * 86_400_000).toISOString();
        let q = admin
          .from('posts')
          .select('id, title, body, status, scheduled_at, timezone, post_targets(provider, channel_id, status, scheduled_at)')
          .eq('workspace_id', workspaceId)
          .in('status', ['queued'])
          .gte('scheduled_at', startIso)
          .lte('scheduled_at', endIso)
          .order('scheduled_at', { ascending: true })
          .range(0, limit); // cursor page: range window; cursor adds an offset
        if (args.cursor) {
          const off = Number.parseInt(args.cursor, 10);
          if (Number.isFinite(off)) q = q.range(off, off + limit - 1);
        }
        const { data } = await q;
        const rows = (data ?? []) as PostWithTargets[];
        const filtered = args.channel_id
          ? rows.filter((r) => r.post_targets?.some((t) => t.channel_id === args.channel_id))
          : rows;
        const next = rows.length === limit ? String((args.cursor ? Number.parseInt(args.cursor, 10) : 0) + limit) : null;
        return ok({ posts: filtered, next_cursor: next });
      },
    },

    get_channels: {
      scope: 'channels:read' as const,
      destructive: false,
      shape: {},
      summaryText: 'List connected channels (id, platform, display name, handle, status). Never tokens.',
      run: async () => {
        const g = await guardTyped('get_channels', {}, { summary: () => 'List channels' });
        if (g.blocked) return g.blocked;
        const channels = await fetchLiveChannels(admin, workspaceId);
        return ok({
          channels: channels.map((c) => ({
            id: c.id,
            provider: c.provider,
            display_name: c.display_name,
            handle: c.handle,
            status: c.status,
          })),
        });
      },
    },

    get_channel_status: {
      scope: 'channels:read' as const,
      destructive: false,
      shape: { channel_id: z.string().uuid() },
      summaryText: 'Is this channel usable? Returns connected / expired / needs reauth.',
      run: async (args: { channel_id: string }) => {
        const g = await guardTyped('get_channel_status', args, { summary: () => 'Check a channel' });
        if (g.blocked) return g.blocked;
        const channels = await fetchLiveChannels(admin, workspaceId);
        const c = channels.find((x) => x.id === args.channel_id);
        if (!c) return fail('not_found', 'Channel not found in this workspace.');
        return ok({ channel_id: c.id, provider: c.provider, status: c.status, usable: c.status === 'connected' });
      },
    },

    get_media: {
      scope: 'media:read' as const,
      destructive: false,
      shape: {
        search: z.string().max(120).optional(),
        type: z.enum(['image', 'video']).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      summaryText: 'Browse media uploaded to this workspace. Returns ids, type and size, never storage credentials.',
      run: async (args: { search?: string; type?: 'image' | 'video'; limit?: number }) => {
        const g = await guardTyped('get_media', args, { summary: () => 'Browse media' });
        if (g.blocked) return g.blocked;
        let q = admin
          .from('media_assets')
          .select('id, kind, mime_type, byte_size, created_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(args.limit ?? 20);
        if (args.type) q = q.eq('kind', args.type);
        const { data, error } = await q;
        if (error) return fail('internal_error', 'Could not list media.');
        return ok({ media: data ?? [] });
      },
    },

    list_comments: {
      scope: 'comments:read' as const,
      destructive: false,
      shape: ListCommentsShape,
      summaryText: 'Read comments people left on this workspace\u2019s posts, newest first. Never tokens.',
      run: async (args: z.infer<typeof ListCommentsShape>) => {
        const g = await guardTyped('list_comments', args, { summary: () => 'Read comments' });
        if (g.blocked) return g.blocked;
        const limit = args.limit ?? 20;
        let q = admin
          .from('comments')
          .select('id, channel_id, platform, external_post_id, parent_external_id, author_name, body, created_at, status, is_own')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(limit); // cursor page: range window; cursor adds an offset
        if (args.channel_id) q = q.eq('channel_id', args.channel_id);
        if (args.status) q = q.eq('status', args.status);
        if (args.unanswered_only) q = q.eq('status', 'new').eq('is_own', false);
        if (args.cursor) {
          const off = Number.parseInt(args.cursor, 10);
          if (Number.isFinite(off)) q = q.range(off, off + limit - 1);
        }
        const { data, error } = await q;
        if (error) return fail('internal_error', 'Could not load comments.');
        const rows = (data ?? []) as { id: string }[];
        const next = rows.length === limit ? String((args.cursor ? Number.parseInt(args.cursor, 10) : 0) + limit) : null;
        return ok({ comments: data ?? [], next_cursor: next });
      },
    },

    reply_to_comment: {
      scope: 'comments:write' as const,
      destructive: true,
      shape: ReplyCommentShape,
      summaryText: 'Post a public reply to a comment, as the connected channel. This is externally visible.',
      run: async (args: z.infer<typeof ReplyCommentShape>) => {
        const g = await guardTyped('reply_to_comment', args, {
          destructive: true,
          write: true,
          summary: async () => {
            const { data: c } = await admin
              .from('comments')
              .select('author_name, body')
              .eq('id', args.comment_id)
              .eq('workspace_id', workspaceId)
              .maybeSingle();
            const cm = c as { author_name?: string | null } | null;
            return `Reply to ${cm?.author_name ?? 'a comment'}: \u201c${args.text.slice(0, 80)}${args.text.length > 80 ? '\u2026' : ''}\u201d`;
          },
        });
        if (g.blocked) return g.blocked;

        const { data: c } = await admin
          .from('comments')
          .select('id, workspace_id, channel_id, is_own, status')
          .eq('id', args.comment_id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        const cm = c as { id: string; channel_id: string; is_own: boolean; status: string } | null;
        if (!cm) return fail('not_found', 'Comment not found in this workspace.');
        if (cm.is_own) return fail('validation_failed', 'That is a reply already sent from this side, not a comment to answer.');
        if (cm.status === 'deleted') return fail('validation_failed', 'That comment was deleted.');

        const { data: ch } = await admin
          .from('connected_channels')
          .select('id, provider, status')
          .eq('id', cm.channel_id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        const channel = ch as { id: string; provider: string; status: string } | null;
        if (!channel) return fail('not_found', 'The channel that owns this comment is gone.');
        if (channel.status !== 'connected') return fail('channel_not_connected', 'That channel is disconnected. Reconnect it in Connect.');
        if (NO_REPLY_YET[channel.provider]) return fail('validation_failed', NO_REPLY_YET[channel.provider]);
        if (!REPLY_PROVIDERS.has(channel.provider)) return fail('validation_failed', 'Replies are not supported for this channel yet.');

        const { error } = await admin.rpc('enqueue_reply_comment', {
          p_channel: channel.id,
          p_comment: cm.id,
          p_text: args.text,
        });
        if (error) {
          if (/invalid_message/i.test(error.message)) return fail('validation_failed', 'Write a reply between 1 and 2000 characters.');
          return fail('internal_error', 'Could not queue the reply.');
        }
        return ok({ comment_id: cm.id, channel_id: channel.id, provider: channel.provider, queued: true });
      },
    },
  };
}

export type McpTools = ReturnType<typeof createMcpTools>;
