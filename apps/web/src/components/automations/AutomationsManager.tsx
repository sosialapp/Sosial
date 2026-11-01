'use client';

/**
 * Auto-reply rule editor + activity log (p115).
 *
 * The worker owns matching and sending; this screen only writes rules and
 * explains what happened. The “Test” panel runs the exact same pure matcher
 * as apps/worker/src/autoReply.ts, so what it says here is what the worker
 * will do (subject to age/caps/cooldowns at delivery time).
 */

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  FlaskConical,
  LoaderCircle,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  channelLabel,
  matchesKeywords,
  providerCanReply,
  renderTemplate,
  replyLimit,
  validateRuleInput,
  DEFAULT_RULE,
  MATCH_MODES,
  SCOPES,
  type AutoReplyChannel,
  type AutoReplyEventRow,
  type AutoReplyRule,
  type AutoReplyScope,
  type AutoReplySettings,
  type RuleInput,
  type RuleValues,
} from '@/lib/autoReply';

interface Props {
  plan: string;
  canEdit: boolean;
  initialSettings: AutoReplySettings;
  initialRules: AutoReplyRule[];
  initialChannels: AutoReplyChannel[];
  initialEvents: AutoReplyEventRow[];
}

type Draft = Omit<RuleValues, 'keywords' | 'escalate_keywords'> & {
  keywordsText: string;
  escalateText: string;
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toDraft(rule: AutoReplyRule | null): Draft {
  const source = rule ?? { ...DEFAULT_RULE, keywords: [], escalate_keywords: [] };
  const { keywords, escalate_keywords, ...rest } = source as RuleValues;
  return {
    ...rest,
    keywordsText: (keywords ?? []).join(', '),
    escalateText: (escalate_keywords ?? []).join(', '),
  };
}

function draftInput(draft: Draft): RuleInput {
  const { keywordsText, escalateText, ...rest } = draft;
  return { ...rest, keywords: splitList(keywordsText), escalate_keywords: splitList(escalateText) };
}

function statusTone(status: AutoReplyEventRow['status']): 'success' | 'danger' | 'outline' | 'accent' {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'queued') return 'accent';
  return 'outline';
}

function stamp(value: string | null): string {
  if (!value) return '—';
  return value.slice(0, 16).replace('T', ' ');
}

export default function AutomationsManager({
  plan,
  canEdit,
  initialSettings,
  initialRules,
  initialChannels,
  initialEvents,
}: Props) {
  const paid = plan !== 'free';

  const [settings, setSettings] = useState(initialSettings);
  const [rules, setRules] = useState(initialRules);
  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState<string | 'new'>(initialRules[0]?.id ?? 'new');
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialRules[0] ?? null));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [testBody, setTestBody] = useState('Do you have a price list?');
  const [testName, setTestName] = useState('Ana');
  const [testChannel, setTestChannel] = useState(initialChannels[0]?.id ?? '');

  const current = selected === 'new' ? null : rules.find((r) => r.id === selected) ?? null;

  const scopeChannels = useMemo(
    () =>
      initialChannels.filter((ch) =>
        providerCanReply(draft.scope === 'comments' ? 'comment' : 'message', ch.provider),
      ),
    [initialChannels, draft.scope],
  );

  const draftProviders = useMemo(() => {
    const picked = draft.channel_id
      ? scopeChannels.filter((ch) => ch.id === draft.channel_id)
      : scopeChannels;
    const list = (picked.length ? picked : scopeChannels).map((ch) => ch.provider);
    return list.length ? list : ['instagram'];
  }, [draft.channel_id, scopeChannels]);

  const responseLimit = Math.min(
    ...draftProviders.map((p) => replyLimit(draft.scope === 'comments' ? 'comment' : 'message', p)),
  );

  const keywordList = splitList(draft.keywordsText);
  const escalateList = splitList(draft.escalateText);
  const testProvider = initialChannels.find((ch) => ch.id === testChannel)?.provider ?? draftProviders[0];
  const testMatch = matchesKeywords(
    testBody,
    keywordList,
    draft.match_mode,
    draft.keyword_mode,
  );
  const testEscalated = matchesKeywords(testBody, escalateList, 'word', 'any');
  const testReply = renderTemplate(draft.reply_text, {
    name: testName,
    handle: testName,
    platform: testProvider,
    body: testBody,
  });
  const testOverLimit = testReply.length > responseLimit;

  const selectRule = (rule: AutoReplyRule) => {
    setSelected(rule.id);
    setDraft(toDraft(rule));
    setDirty(false);
    setErr(null);
    setNotice(null);
  };

  const startNew = () => {
    setSelected('new');
    setDraft(toDraft(null));
    setDirty(false);
    setErr(null);
    setNotice(null);
  };

  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setNotice(null);
  };

  const save = useCallback(async () => {
    const parsed = validateRuleInput(draftInput(draft));
    if (!parsed.ok) {
      setErr(parsed.error);
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const creating = selected === 'new';
      const res = await fetch('/api/automations', {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creating ? parsed.value : { ...parsed.value, id: selected }),
      });
      const json = (await res.json()) as { rule?: AutoReplyRule; error?: string };
      if (!res.ok || !json.rule) {
        setErr(json.error ?? 'Could not save the rule.');
        return;
      }
      const saved = json.rule;
      setRules((list) => {
        const next = list.filter((r) => r.id !== saved.id);
        return [...next, saved].sort((a, b) => b.priority - a.priority);
      });
      setSelected(saved.id);
      setDraft(toDraft(saved));
      setDirty(false);
      setNotice(creating ? 'Rule created. It is a dry run until you switch that off.' : 'Rule saved.');
    } catch {
      setErr('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }, [draft, selected]);

  const toggle = async (rule: AutoReplyRule, key: 'enabled' | 'dry_run') => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, patch: true, [key]: !rule[key] }),
      });
      const json = (await res.json()) as { rule?: AutoReplyRule; error?: string };
      if (!res.ok || !json.rule) {
        setErr(json.error ?? 'Could not update the rule.');
        return;
      }
      setRules((list) => list.map((r) => (r.id === json.rule!.id ? json.rule! : r)));
      if (selected === json.rule.id) setDraft(toDraft(json.rule));
    } catch {
      setErr('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rule: AutoReplyRule) => {
    if (!window.confirm(`Delete “${rule.name}”? Queued replies are cancelled at send time.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/automations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(json.error ?? 'Could not delete the rule.');
        return;
      }
      const next = rules.filter((r) => r.id !== rule.id);
      setRules(next);
      if (selected === rule.id) {
        if (next[0]) selectRule(next[0]);
        else startNew();
      }
    } catch {
      setErr('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (patchSettings: Partial<Pick<AutoReplySettings, 'paused' | 'dry_run'>>) => {
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch('/api/automations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchSettings),
      });
      const json = (await res.json()) as { settings?: AutoReplySettings; error?: string };
      if (!res.ok || !json.settings) {
        setErr(json.error ?? 'Could not save the switches.');
        return;
      }
      setSettings(json.settings);
      setNotice(json.settings.paused ? 'All auto-replies are paused.' : 'Auto-replies are active.');
    } catch {
      setErr('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const refreshEvents = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/automations/events?limit=60');
      const json = (await res.json()) as { events?: AutoReplyEventRow[] };
      if (res.ok) setEvents(json.events ?? []);
    } catch {
      /* keep the last list */
    } finally {
      setBusy(false);
    }
  };

  const ruleName = (id: string | null) => rules.find((r) => r.id === id)?.name ?? 'Deleted rule';

  if (!paid) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Header paused={settings.paused} />
        <div className="card p-8 text-center">
          <Bot className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl font-semibold">Auto-replies are a paid feature</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Set a keyword like “price”, choose what to send back, and let the worker answer comments
            and DMs for you. Upgrade to turn it on.
          </p>
          <Link href="/billing" className="btn btn-primary mt-5 inline-flex">
            See plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header paused={settings.paused} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={settings.paused ? 'bolt' : 'outline'}
          size="sm"
          disabled={!canEdit || busy}
          onClick={() => saveSettings({ paused: !settings.paused })}
        >
          {settings.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {settings.paused ? 'Resume all' : 'Pause all'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canEdit || busy}
          onClick={() => saveSettings({ dry_run: !settings.dry_run })}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {settings.dry_run ? 'Dry run is on' : 'Dry run all'}
        </Button>
        {settings.paused ? (
          <Badge variant="danger">Paused</Badge>
        ) : (
          <Badge variant="success">Live</Badge>
        )}
        {settings.dry_run ? <Badge variant="outline">Log only</Badge> : null}
        {!canEdit ? <Badge variant="outline">Read-only for your role</Badge> : null}
      </div>

      {err ? (
        <div className="card flex items-start gap-3 border-[#F0C9C9] p-4 text-sm text-[#9F2F2D] dark:border-[#4a2a2a] dark:text-[#f2a8a8]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{err}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="card flex items-start gap-3 p-4 text-sm text-soft">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ------------------------------------------------ rule list --- */}
        <section className="card h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="eyebrow">Rules</h2>
            <Button size="sm" variant="ghost" disabled={!canEdit} onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
          {rules.length ? (
            <ul className="divide-y divide-line">
              {rules.map((rule) => {
                const active = rule.id === selected;
                return (
                  <li key={rule.id}>
                    <button
                      type="button"
                      onClick={() => selectRule(rule)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        active ? 'bg-paper' : 'hover:bg-paper'
                      }`}
                    >
                      <span className="mt-0.5 text-muted">
                        {rule.scope === 'comments' ? (
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Mail className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{rule.name}</span>
                          {!rule.enabled ? <Badge variant="outline">Off</Badge> : null}
                          {rule.dry_run ? <Badge variant="outline">Dry</Badge> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {rule.keywords.slice(0, 3).join(', ')}
                          {rule.keywords.length > 3 ? ` +${rule.keywords.length - 3}` : ''}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted">
                          {rule.channel_id
                            ? channelLabel(
                                initialChannels.find((c) => c.id === rule.channel_id) ?? {
                                  id: rule.channel_id,
                                  provider: 'unknown',
                                  handle: null,
                                  display_name: null,
                                  status: '',
                                },
                              )
                            : 'All channels'}
                        </span>
                      </span>
                      <ChevronRight
                        className={`mt-1 h-4 w-4 shrink-0 ${active ? 'text-ink' : 'text-muted'}`}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted">
              No rules yet. Start with “price” and a short reply.
            </div>
          )}
        </section>

        {/* -------------------------------------------------- editor --- */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted" aria-hidden="true" />
              <h2 className="eyebrow">{selected === 'new' ? 'New rule' : 'Edit rule'}</h2>
              {dirty ? <Badge variant="accent">Unsaved</Badge> : null}
            </div>
            <div className="flex items-center gap-2">
              {current ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || busy}
                    onClick={() => toggle(current, 'enabled')}
                  >
                    {current.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || busy}
                    onClick={() => toggle(current, 'dry_run')}
                  >
                    {current.dry_run ? 'Go live' : 'Dry run'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete rule"
                    disabled={!canEdit || busy}
                    onClick={() => remove(current)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="eyebrow mb-1 block">Rule name</span>
                  <input
                    className="field"
                    value={draft.name}
                    disabled={!canEdit}
                    placeholder="Price questions"
                    onChange={(e) => patch('name', e.target.value)}
                  />
                </label>

                <div>
                  <span className="eyebrow mb-1 block">Where</span>
                  <div className="flex gap-2">
                    {SCOPES.map((scope) => (
                      <button
                        key={scope.value}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                          patch('scope', scope.value as AutoReplyScope);
                          patch('channel_id', null);
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm ${
                          draft.scope === scope.value
                            ? 'border-ink bg-ink text-paper'
                            : 'border-line bg-paper text-soft'
                        }`}
                      >
                        {scope.value === 'comments' ? (
                          <MessageCircle className="h-4 w-4" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        {scope.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="eyebrow mb-1 block">Channel</span>
                  <select
                    className="field"
                    value={draft.channel_id ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => patch('channel_id', e.target.value || null)}
                  >
                    <option value="">All eligible channels</option>
                    {scopeChannels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {channelLabel(ch)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-3 rounded-2xl border border-line bg-paper p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <label className="block">
                    <span className="eyebrow mb-1 block">Trigger words</span>
                    <input
                      className="field"
                      value={draft.keywordsText}
                      disabled={!canEdit}
                      placeholder="price, how much, cost"
                      onChange={(e) => patch('keywordsText', e.target.value)}
                    />
                    <span className="mt-1 block text-[11px] text-muted">
                      Separate with commas. Whole words by default, so “price” will not fire on
                      “pricing”.
                    </span>
                  </label>
                  <label className="block">
                    <span className="eyebrow mb-1 block">All or any</span>
                    <select
                      className="field"
                      value={draft.keyword_mode}
                      disabled={!canEdit}
                      onChange={(e) => patch('keyword_mode', e.target.value === 'all' ? 'all' : 'any')}
                    >
                      <option value="any">Any word</option>
                      <option value="all">All words</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <label className="block">
                    <span className="eyebrow mb-1 block">Matching</span>
                    <select
                      className="field"
                      value={draft.match_mode}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patch(
                          'match_mode',
                          e.target.value === 'exact'
                            ? 'exact'
                            : e.target.value === 'contains'
                              ? 'contains'
                              : 'word',
                        )
                      }
                    >
                      {MATCH_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px] text-muted">
                      {MATCH_MODES.find((m) => m.value === draft.match_mode)?.hint}
                    </span>
                  </label>
                  <label className="block">
                    <span className="eyebrow mb-1 block">Delay</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={3600}
                        className="field"
                        value={draft.delay_seconds}
                        disabled={!canEdit}
                        onChange={(e) => patch('delay_seconds', Number(e.target.value))}
                      />
                      <span className="text-xs text-muted">sec</span>
                    </div>
                    <span className="mt-1 block text-[11px] text-muted">
                      Gives a teammate time to answer first.
                    </span>
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="eyebrow mb-1 block">Reply</span>
                <textarea
                  className="field min-h-[110px] resize-y"
                  value={draft.reply_text}
                  disabled={!canEdit}
                  placeholder={'Hi {{name}}, our price list is here: https://…'}
                  onChange={(e) => patch('reply_text', e.target.value)}
                />
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                  <span>
                    Variables: {'{{name}}'}, {'{{first_name}}'}, {'{{platform}}'}, {'{{text}}'}.
                  </span>
                  <span className={draft.reply_text.length > responseLimit ? 'text-[#9F2F2D] dark:text-[#f2a8a8]' : ''}>
                    {draft.reply_text.length} / {responseLimit}
                  </span>
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField
                  label="Max age"
                  suffix="min"
                  value={draft.max_age_minutes}
                  min={1}
                  max={10080}
                  disabled={!canEdit}
                  onChange={(v) => patch('max_age_minutes', v)}
                />
                <NumberField
                  label="Daily cap"
                  suffix="replies"
                  value={draft.daily_cap}
                  min={1}
                  max={1000}
                  disabled={!canEdit}
                  onChange={(v) => patch('daily_cap', v)}
                />
                <NumberField
                  label="Per post"
                  suffix="replies"
                  value={draft.per_post_cap}
                  min={1}
                  max={500}
                  disabled={!canEdit}
                  onChange={(v) => patch('per_post_cap', v)}
                />
                <NumberField
                  label="Cooldown"
                  suffix="min"
                  value={draft.cooldown_minutes}
                  min={0}
                  max={43200}
                  disabled={!canEdit}
                  onChange={(v) => patch('cooldown_minutes', v)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow mb-1 block">Escalate to a human</span>
                  <input
                    className="field"
                    value={draft.escalateText}
                    disabled={!canEdit}
                    placeholder="refund, lawyer, scam, stop"
                    onChange={(e) => patch('escalateText', e.target.value)}
                  />
                  <span className="mt-1 block text-[11px] text-muted">
                    These always skip the auto-reply.
                  </span>
                </label>
                <div className="space-y-2 self-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.first_reply_only}
                      disabled={!canEdit}
                      onChange={(e) => patch('first_reply_only', e.target.checked)}
                    />
                    Only answer the first message in a DM
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.dry_run}
                      disabled={!canEdit}
                      onChange={(e) => patch('dry_run', e.target.checked)}
                    />
                    Dry run this rule (log only)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
                {selected !== 'new' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => current && selectRule(current)}
                    disabled={!dirty || busy}
                  >
                    Reset
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" disabled={!canEdit || busy} onClick={save}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {selected === 'new' ? 'Create rule' : 'Save changes'}
                </Button>
              </div>
            </div>

            {/* ------------------------------------------------- test --- */}
            <aside className="space-y-3 rounded-2xl border border-line bg-paper p-4">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-muted" aria-hidden="true" />
                <h3 className="eyebrow">Test this rule</h3>
              </div>
              <label className="block">
                <span className="eyebrow mb-1 block">Name</span>
                <input
                  className="field"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1 block">Comment or DM</span>
                <textarea
                  className="field min-h-[90px] resize-y"
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1 block">Channel</span>
                <select
                  className="field"
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value)}
                >
                  <option value="">Shortest limit</option>
                  {initialChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {channelLabel(ch)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-line bg-paper-dim p-3 text-sm">
                {testEscalated ? (
                  <p className="flex items-start gap-2 text-[#9F2F2D] dark:text-[#f2a8a8]">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    Escalation word found: a human gets this one.
                  </p>
                ) : testMatch ? (
                  <p className="flex items-center gap-2 text-[#346538]">
                    <Check className="h-4 w-4" /> Trigger matched.
                  </p>
                ) : (
                  <p className="text-muted">No match. This message would be ignored.</p>
                )}
                {testReply ? (
                  <div className="mt-2 border-t border-line pt-2">
                    <span className="eyebrow">Reply preview</span>
                    <p className="mt-1 whitespace-pre-wrap break-words text-ink">{testReply}</p>
                    {testOverLimit ? (
                      <p className="mt-2 text-xs text-[#9F2F2D] dark:text-[#f2a8a8]">
                        {testReply.length} characters, over the {responseLimit} limit for this channel.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className="text-[11px] text-muted">
                Age, caps, cooldowns and “a teammate replied first” are checked when the reply is
                actually sent, so a match here can still be skipped.
              </p>
            </aside>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- activity --- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted" aria-hidden="true" />
            <h2 className="eyebrow">Recent activity</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={refreshEvents} disabled={busy}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
        {events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="px-5 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {stamp(event.created_at)}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="block font-medium">{ruleName(event.rule_id)}</span>
                      <span className="text-muted">
                        {event.target_kind === 'comment' ? 'Comment' : 'DM'}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-3 py-3">
                      <span className="line-clamp-2 text-xs text-soft">
                        {event.target_preview || '—'}
                      </span>
                      {event.reply_text ? (
                        <span className="mt-1 line-clamp-2 block text-[11px] text-muted">
                          → {event.reply_text}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusTone(event.status)}>{event.status}</Badge>
                    </td>
                    <td className="max-w-[280px] px-5 py-3 text-xs text-muted">
                      {event.reason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted">
            Nothing yet. Once a comment or DM matches, every decision shows up here, including the
            skips.
          </div>
        )}
      </section>
    </div>
  );
}

function Header({ paused }: { paused: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link
          href="/community"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Community
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Auto-replies
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pick keywords like “price”, write the answer, and the worker replies to comments and DMs.
          Every match is logged, including the ones we deliberately skip and why.
        </p>
      </div>
      <Badge variant={paused ? 'danger' : 'success'}>{paused ? 'Paused' : 'Active'}</Badge>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="field"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="shrink-0 text-[11px] text-muted">{suffix}</span>
      </div>
    </label>
  );
}
