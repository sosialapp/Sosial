import { redirect } from 'next/navigation';
import AutomationsManager from '@/components/automations/AutomationsManager';
import CommunitySections from '@/components/CommunitySections';
import { getEntitlement } from '@/lib/billing/entitlement';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';
import { isAutomationAdmin } from '@/lib/automations';
import type { AutoReplyChannel, AutoReplyEventRow, AutoReplyRule, AutoReplySettings } from '@/lib/autoReply';

export const metadata = { title: 'Auto-replies' };
export const dynamic = 'force-dynamic';

const RULE_COLUMNS =
  'id,workspace_id,name,enabled,dry_run,scope,channel_id,match_mode,keywords,keyword_mode,' +
  'reply_text,delay_seconds,max_age_minutes,daily_cap,per_post_cap,cooldown_minutes,' +
  'first_reply_only,escalate_keywords,priority,created_at,updated_at';

const EVENT_COLUMNS =
  'id,workspace_id,rule_id,channel_id,target_kind,target_id,conversation_id,external_post_id,' +
  'external_id,author_key,target_preview,status,reason,reply_text,job_id,created_at,sent_at';

const REPLY_PROVIDERS = [
  'facebook', 'instagram', 'threads', 'mastodon', 'x', 'bluesky', 'youtube',
];

/**
 * Keyword auto-replies (p115). The rules are evaluated by the worker, so this
 * page is only the editor + the activity log that explains every decision.
 */
export default async function AutomationsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');

  const sb = await createClient();
  const [ent, settingsRes, rulesRes, channelsRes, eventsRes] = await Promise.all([
    getEntitlement(ctx.workspace.id),
    sb
      .from('auto_reply_settings')
      .select('workspace_id,paused,dry_run')
      .eq('workspace_id', ctx.workspace.id)
      .maybeSingle(),
    sb
      .from('auto_reply_rules')
      .select(RULE_COLUMNS)
      .eq('workspace_id', ctx.workspace.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true }),
    sb
      .from('connected_channels')
      .select('id,provider,handle,display_name,status,metadata')
      .eq('workspace_id', ctx.workspace.id)
      .in('provider', REPLY_PROVIDERS)
      .order('provider'),
    sb
      .from('auto_reply_events')
      .select(EVENT_COLUMNS)
      .eq('workspace_id', ctx.workspace.id)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const settings: AutoReplySettings = settingsRes.data ?? {
    workspace_id: ctx.workspace.id,
    paused: false,
    dry_run: false,
  };

  return (
    <div className="w-full pt-3 sm:px-2 sm:pt-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Community</h1>
      <p className="mt-0.5 hidden text-sm text-muted sm:block">Comments on your posts and your direct messages, in one place.</p>
      <div className="mt-3">
        <CommunitySections value="auto" />
      </div>
      <div className="mt-4">
        <AutomationsManager
          plan={ent.plan}
          canEdit={isAutomationAdmin(ctx.workspace.role)}
          initialSettings={settings}
          initialRules={(rulesRes.data ?? []) as unknown as AutoReplyRule[]}
          initialChannels={(channelsRes.data ?? []) as unknown as AutoReplyChannel[]}
          initialEvents={(eventsRes.data ?? []) as unknown as AutoReplyEventRow[]}
        />
      </div>
    </div>
  );
}
