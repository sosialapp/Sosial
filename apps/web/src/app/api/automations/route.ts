import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEntitlement } from '@/lib/billing/entitlement';
import {
  validateRuleInput,
  type AutoReplyRule,
  type RuleInput,
} from '@/lib/autoReply';
import {
  isAutomationAdmin,
  requireAutomationAdmin,
  requireAutomationMember,
} from '@/lib/automations';

export const dynamic = 'force-dynamic';

const RULE_COLUMNS =
  'id,workspace_id,name,enabled,dry_run,scope,channel_id,match_mode,keywords,keyword_mode,' +
  'reply_text,delay_seconds,max_age_minutes,daily_cap,per_post_cap,cooldown_minutes,' +
  'first_reply_only,escalate_keywords,priority,created_at,updated_at';

const REPLY_PROVIDERS = [
  'facebook', 'instagram', 'threads', 'mastodon', 'x', 'bluesky', 'youtube',
];

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

async function ruleInput(req: Request): Promise<RuleInput | null> {
  try {
    return (await req.json()) as RuleInput;
  } catch {
    return null;
  }
}

/** Channel must belong to this workspace; a rule may point at any workspace channel. */
async function channelBelongs(workspaceId: string, channelId: string | null): Promise<boolean> {
  if (!channelId) return true;
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('connected_channels')
    .select('id')
    .eq('id', channelId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return !!data;
}

/** List rules + settings + eligible channels for the editor. */
export async function GET() {
  const caller = await requireAutomationMember();
  if ('error' in caller) return caller.error;
  const { ctx } = caller;

  const admin = supabaseAdmin();
  const [settings, rules, channels, ent] = await Promise.all([
    admin
      .from('auto_reply_settings')
      .select('workspace_id,paused,dry_run')
      .eq('workspace_id', ctx.workspace.id)
      .maybeSingle(),
    admin
      .from('auto_reply_rules')
      .select(RULE_COLUMNS)
      .eq('workspace_id', ctx.workspace.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true }),
    admin
      .from('connected_channels')
      .select('id,provider,handle,display_name,status')
      .eq('workspace_id', ctx.workspace.id)
      .in('provider', REPLY_PROVIDERS)
      .order('provider'),
    getEntitlement(ctx.workspace.id),
  ]);

  if (settings.error || rules.error || channels.error) {
    return bad('Could not load auto-reply settings.', 500);
  }

  return Response.json({
    plan: ent.plan,
    paid: ent.plan !== 'free',
    canEdit: isAutomationAdmin(ctx.workspace.role),
    settings: settings.data ?? {
      workspace_id: ctx.workspace.id,
      paused: false,
      dry_run: false,
    },
    rules: (rules.data ?? []) as unknown as AutoReplyRule[],
    channels: channels.data ?? [],
  });
}

/** Create a rule. New rules start as a dry run so nothing fires by surprise. */
export async function POST(req: Request) {
  const caller = await requireAutomationAdmin();
  if ('error' in caller) return caller.error;
  const { ctx } = caller;

  const input = await ruleInput(req);
  if (!input) return bad('Body must be JSON.');
  const parsed = validateRuleInput(input);
  if (!parsed.ok) return bad(parsed.error);

  if (!(await channelBelongs(ctx.workspace.id, parsed.value.channel_id))) {
    return bad('That channel is not part of this workspace.');
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('auto_reply_rules')
    .insert({
      ...parsed.value,
      // New rules are log-only until the user explicitly flips them live.
      dry_run: true,
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
    })
    .select(RULE_COLUMNS)
    .single();

  if (error || !data) {
    return bad('Could not save the rule. Check the keyword and reply fields.', 500);
  }
  return Response.json({ rule: data }, { status: 201 });
}

/**
 * Update a rule. Sending only `{ id, enabled }` (or dry_run/priority) is a
 * quick toggle; sending the full form runs the same validation as creation.
 */
export async function PATCH(req: Request) {
  const caller = await requireAutomationAdmin();
  if ('error' in caller) return caller.error;
  const { ctx } = caller;

  const raw = (await ruleInput(req)) as (RuleInput & { id?: unknown; patch?: unknown }) | null;
  if (!raw || typeof raw.id !== 'string' || !raw.id) return bad('Body needs the rule id.');

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from('auto_reply_rules')
    .select('id')
    .eq('id', raw.id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();
  if (!existing) return bad('Rule not found.', 404);

  let update: Record<string, unknown>;
  const partial = raw.patch === true;
  if (partial) {
    update = {};
    if (typeof raw.enabled === 'boolean') update.enabled = raw.enabled;
    if (typeof raw.dry_run === 'boolean') update.dry_run = raw.dry_run;
    if (typeof raw.priority === 'number') {
      update.priority = Math.max(-100, Math.min(100, Math.round(raw.priority)));
    }
    if (!Object.keys(update).length) return bad('Nothing to update.');
  } else {
    const parsed = validateRuleInput(raw);
    if (!parsed.ok) return bad(parsed.error);
    if (!(await channelBelongs(ctx.workspace.id, parsed.value.channel_id))) {
      return bad('That channel is not part of this workspace.');
    }
    update = parsed.value;
  }

  const { data, error } = await admin
    .from('auto_reply_rules')
    .update(update)
    .eq('id', raw.id)
    .eq('workspace_id', ctx.workspace.id)
    .select(RULE_COLUMNS)
    .single();
  if (error || !data) return bad('Could not update the rule.', 500);
  return Response.json({ rule: data });
}

/** Delete a rule, its queued sends are cancelled at send time by the worker. */
export async function DELETE(req: Request) {
  const caller = await requireAutomationAdmin();
  if ('error' in caller) return caller.error;
  const { ctx } = caller;

  const raw = (await ruleInput(req)) as { id?: unknown } | null;
  if (!raw || typeof raw.id !== 'string' || !raw.id) return bad('Body needs the rule id.');

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('auto_reply_rules')
    .delete()
    .eq('id', raw.id)
    .eq('workspace_id', ctx.workspace.id);
  if (error) return bad('Could not delete the rule.', 500);
  return Response.json({ deleted: true });
}
