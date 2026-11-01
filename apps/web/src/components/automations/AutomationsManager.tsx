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
  Bot,
  Check,
  ChevronRight,
  Clock,
  CornerDownRight,
  FlaskConical,
  Hand,
  LoaderCircle,
  Mail,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SegmentedPills from '@/components/ui/segmented-pills';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
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
  const channelById = (id: string | null) => initialChannels.find((c) => c.id === id) ?? null;

  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const counts = useMemo(() => {
    const c = { sent: 0, queued: 0, skipped: 0, failed: 0 };
    for (const e of events) {
      if (e.status === 'sent') c.sent += 1;
      else if (e.status === 'queued') c.queued += 1;
      else if (e.status === 'failed') c.failed += 1;
      else c.skipped += 1;
    }
    return c;
  }, [events]);
  const visibleEvents = events.filter((e) =>
    eventFilter === 'all'
      ? true
      : eventFilter === 'skipped'
        ? e.status === 'skipped' || e.status === 'canceled'
        : e.status === eventFilter,
  );
  const liveRules = rules.filter((r) => r.enabled && !r.dry_run).length;

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setSelected('new');
    setDraft({ ...toDraft(null), name: t.name, keywordsText: t.keywords, reply_text: t.reply, scope: t.scope });
    setDirty(true);
    setErr(null);
    setNotice(null);
  };

  const insertVariable = (token: string) => {
    const text = draft.reply_text;
    patch('reply_text', `${text}${text && !/\s$/.test(text) ? ' ' : ''}${token}`);
  };

  if (!paid) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <div className="card overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-7 sm:p-9">
              <span className="pill bg-accent-soft text-accent-ink">Paid plans</span>
              <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
                Answer the same question once, forever.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Set a keyword like “price”, write what to send back, and Sosial replies to matching
                comments and DMs, with caps, cooldowns and a full log of every decision.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {['Comments and DMs on 7 networks', 'Escalation words always go to a human', 'Dry run to test before going live'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-[#346538] dark:text-[#8fd0a0]" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/billing" className="btn btn-bolt mt-6 inline-flex">
                <Zap className="h-4 w-4" aria-hidden="true" /> See plans
              </Link>
            </div>
            <div className="border-t border-line bg-surface p-6 md:border-l md:border-t-0">
              <ChatPreview
                name="Ana"
                body="Do you have a price list?"
                reply="Hi Ana! Our price list is here: sosial.app/prices"
                provider="instagram"
                state="match"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------- header --- */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <Header />
        <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="relative flex h-2.5 w-2.5">
              {!settings.paused ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4caf50] opacity-60" />
              ) : null}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  settings.paused ? 'bg-[#D9534F]' : 'bg-[#4caf50]'
                }`}
              />
            </span>
            {settings.paused ? 'Paused' : settings.dry_run ? 'Live · log only' : 'Live'}
          </span>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <ToggleRow
            label="Replies on"
            on={!settings.paused}
            disabled={!canEdit || busy}
            onToggle={() => saveSettings({ paused: !settings.paused })}
          />
          <ToggleRow
            label="Dry run all"
            on={settings.dry_run}
            disabled={!canEdit || busy}
            onToggle={() => saveSettings({ dry_run: !settings.dry_run })}
          />
          {!canEdit ? <Badge variant="outline">Read-only</Badge> : null}
        </div>
      </div>

      {/* -------------------------------------------------- stats --- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Bot className="h-4 w-4" />} label="Live rules" value={liveRules} sub={`of ${rules.length}`} />
        <Stat icon={<Send className="h-4 w-4" />} label="Replied" value={counts.sent} sub={counts.queued ? `${counts.queued} queued` : 'recent'} />
        <Stat icon={<SkipForward className="h-4 w-4" />} label="Skipped" value={counts.skipped} sub="with a reason" />
        <Stat
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Failed"
          value={counts.failed}
          sub={counts.failed ? 'needs a look' : 'all clear'}
          danger={counts.failed > 0}
        />
      </div>

      {err ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-[#FDEBEC] px-4 py-3 text-sm font-semibold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{err}</span>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-[#EDF3EC] px-4 py-3 text-sm font-semibold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ------------------------------------------------ rule list --- */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:h-fit">
          <div className="flex items-center justify-between px-1">
            <h2 className="eyebrow">Rules · {rules.length}</h2>
            <Button size="sm" variant="primary" disabled={!canEdit} onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> New rule
            </Button>
          </div>

          {rules.length ? (
            <ul className="space-y-2">
              {rules.map((rule) => {
                const active = rule.id === selected;
                const ch = channelById(rule.channel_id);
                return (
                  <li key={rule.id}>
                    <div
                      className={`group rounded-2xl border p-3.5 transition ${
                        active
                          ? 'border-ink bg-card shadow-[0_1px_0_0_var(--color-ink)]'
                          : 'border-line bg-card hover:border-ink/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => selectRule(rule)}
                          className="min-w-0 flex-1 text-left"
                          aria-current={active ? 'true' : undefined}
                        >
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                            {rule.scope === 'comments' ? (
                              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {rule.scope === 'comments' ? 'Comments' : 'DMs'}
                            <span aria-hidden="true">·</span>
                            {ch ? (
                              <span className="flex min-w-0 items-center gap-1">
                                <BrandIcon provider={ch.provider as BrandProvider} className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{channelLabel(ch)}</span>
                              </span>
                            ) : (
                              'All channels'
                            )}
                          </span>
                          <span className="mt-1 block truncate text-sm font-bold">{rule.name}</span>
                          <span className="mt-2 flex flex-wrap gap-1">
                            {rule.keywords.slice(0, 3).map((k) => (
                              <span key={k} className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-soft">
                                {k}
                              </span>
                            ))}
                            {rule.keywords.length > 3 ? (
                              <span className="px-1 py-0.5 text-[11px] font-semibold text-muted">+{rule.keywords.length - 3}</span>
                            ) : null}
                          </span>
                        </button>
                        <Switch
                          on={rule.enabled}
                          disabled={!canEdit || busy}
                          label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                          onToggle={() => toggle(rule, 'enabled')}
                        />
                      </div>
                      {rule.dry_run || !rule.enabled ? (
                        <div className="mt-2.5 flex gap-1.5 border-t border-line-soft pt-2.5">
                          {!rule.enabled ? <Badge variant="outline">Off</Badge> : null}
                          {rule.dry_run ? (
                            <Badge variant="accent">
                              <FlaskConical className="mr-1 inline h-3 w-3" aria-hidden="true" /> Dry run
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {canEdit && rules.length < 2 ? (
            <div className="rounded-2xl border border-dashed border-line p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Start from a template
              </p>
              <div className="mt-2.5 space-y-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-left text-xs font-semibold transition hover:bg-line"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{t.name}</span>
                      <span className="block truncate font-normal text-muted">{t.keywords}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        {/* -------------------------------------------------- builder --- */}
        <section className="card overflow-hidden" aria-label={selected === 'new' ? 'New rule' : 'Edit rule'}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <input
              className="min-w-0 flex-1 bg-transparent font-display text-xl font-extrabold tracking-tight outline-none placeholder:text-muted/50"
              value={draft.name}
              disabled={!canEdit}
              placeholder="Name this rule"
              aria-label="Rule name"
              onChange={(e) => patch('name', e.target.value)}
            />
            <div className="flex items-center gap-2">
              {dirty ? <Badge variant="accent">Unsaved</Badge> : null}
              {selected === 'new' ? <Badge variant="outline">New</Badge> : null}
              {current ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || busy}
                    onClick={() => toggle(current, 'dry_run')}
                  >
                    {current.dry_run ? <Play className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
                    {current.dry_run ? 'Go live' : 'Dry run'}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete rule"
                    disabled={!canEdit || busy}
                    onClick={() => remove(current)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-5">
              <ol className="relative space-y-1">
                {/* 1 · trigger */}
                <Step n={1} title="When someone writes" hint="Pick where the rule listens.">
                  <SegmentedPills
                    ariaLabel="Where"
                    className="w-fit"
                    value={draft.scope}
                    onChange={(v) => {
                      if (!canEdit) return;
                      setDraft((d) => ({ ...d, scope: v as AutoReplyScope, channel_id: null }));
                      setDirty(true);
                      setNotice(null);
                    }}
                    options={SCOPES.map((s) => ({
                      value: s.value,
                      disabled: !canEdit,
                      label: (
                        <span className="flex items-center gap-1.5">
                          {s.value === 'comments' ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                          {s.label}
                        </span>
                      ),
                    }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Channel">
                    <ChannelChip
                      active={!draft.channel_id}
                      disabled={!canEdit}
                      onClick={() => patch('channel_id', null)}
                    >
                      <span className="flex -space-x-1">
                        {Array.from(new Set(scopeChannels.map((c) => c.provider)))
                          .slice(0, 4)
                          .map((p) => (
                            <BrandIcon key={p} provider={p as BrandProvider} className="h-4 w-4 rounded-full ring-2 ring-card" />
                          ))}
                      </span>
                      All channels
                    </ChannelChip>
                    {scopeChannels.map((ch) => (
                      <ChannelChip
                        key={ch.id}
                        active={draft.channel_id === ch.id}
                        disabled={!canEdit}
                        onClick={() => patch('channel_id', ch.id)}
                      >
                        <BrandIcon provider={ch.provider as BrandProvider} className="h-4 w-4" />
                        {channelLabel(ch)}
                      </ChannelChip>
                    ))}
                  </div>
                  {scopeChannels.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      No connected channel can reply to {draft.scope === 'comments' ? 'comments' : 'DMs'} yet.{' '}
                      <Link href="/channels" className="font-bold underline">Connect one</Link>
                    </p>
                  ) : null}
                </Step>

                {/* 2 · keywords */}
                <Step n={2} title="And it contains" hint="Separate words with commas.">
                  <input
                    className="field"
                    value={draft.keywordsText}
                    disabled={!canEdit}
                    placeholder="price, how much, cost"
                    aria-label="Trigger words"
                    onChange={(e) => patch('keywordsText', e.target.value)}
                  />
                  {keywordList.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {keywordList.map((k, i) => (
                        <span key={`${k}-${i}`} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-ink">
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <SegmentedPills
                      ariaLabel="All or any"
                      size="sm"
                      value={draft.keyword_mode}
                      onChange={(v) => canEdit && patch('keyword_mode', v)}
                      options={[
                        { value: 'any' as const, label: 'Any word', disabled: !canEdit },
                        { value: 'all' as const, label: 'All words', disabled: !canEdit },
                      ]}
                    />
                    <SegmentedPills
                      ariaLabel="Matching"
                      size="sm"
                      value={draft.match_mode}
                      onChange={(v) => canEdit && patch('match_mode', v)}
                      options={MATCH_MODES.map((m) => ({ value: m.value, label: m.label, title: m.hint, disabled: !canEdit }))}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {MATCH_MODES.find((m) => m.value === draft.match_mode)?.hint}
                  </p>
                </Step>

                {/* 3 · reply */}
                <Step n={3} title="Reply with" hint="Variables fill in per person.">
                  <div className="rounded-2xl border border-line bg-paper focus-within:border-ink">
                    <textarea
                      className="block min-h-[110px] w-full resize-y rounded-t-2xl bg-transparent px-4 py-3 text-sm outline-none"
                      value={draft.reply_text}
                      disabled={!canEdit}
                      aria-label="Reply"
                      placeholder={'Hi {{name}}, our price list is here: https://…'}
                      onChange={(e) => patch('reply_text', e.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {VARIABLES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => insertVariable(v)}
                            className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-soft transition hover:bg-line disabled:opacity-50"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <span
                        className={`text-[11px] font-semibold tabular-nums ${
                          draft.reply_text.length > responseLimit ? 'text-[#9F2F2D] dark:text-[#f2a8a8]' : 'text-muted'
                        }`}
                      >
                        {draft.reply_text.length} / {responseLimit}
                      </span>
                    </div>
                  </div>
                  <label className="mt-3 flex w-fit items-center gap-2 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Wait
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      className="field !w-20 !px-2 !py-1 !text-xs"
                      value={draft.delay_seconds}
                      disabled={!canEdit}
                      onChange={(e) => patch('delay_seconds', Number(e.target.value))}
                    />
                    seconds first, so a teammate can answer.
                  </label>
                </Step>

                {/* 4 · guardrails */}
                <Step n={4} title="Guardrails" hint="Checked again at send time." last>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <NumberField label="Max age" suffix="min" value={draft.max_age_minutes} min={1} max={10080} disabled={!canEdit} onChange={(v) => patch('max_age_minutes', v)} />
                    <NumberField label="Daily cap" suffix="replies" value={draft.daily_cap} min={1} max={1000} disabled={!canEdit} onChange={(v) => patch('daily_cap', v)} />
                    <NumberField label="Per post" suffix="replies" value={draft.per_post_cap} min={1} max={500} disabled={!canEdit} onChange={(v) => patch('per_post_cap', v)} />
                    <NumberField label="Cooldown" suffix="min" value={draft.cooldown_minutes} min={0} max={43200} disabled={!canEdit} onChange={(v) => patch('cooldown_minutes', v)} />
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-bold">
                      <Hand className="h-3.5 w-3.5" aria-hidden="true" /> Hand to a human when it mentions
                    </span>
                    <input
                      className="field"
                      value={draft.escalateText}
                      disabled={!canEdit}
                      placeholder="refund, lawyer, scam, stop"
                      onChange={(e) => patch('escalateText', e.target.value)}
                    />
                  </label>
                  <div className="mt-4 divide-y divide-line-soft rounded-2xl border border-line">
                    <ToggleRow
                      block
                      label="Only answer the first message in a DM"
                      on={draft.first_reply_only}
                      disabled={!canEdit}
                      onToggle={() => patch('first_reply_only', !draft.first_reply_only)}
                    />
                    <ToggleRow
                      block
                      label="Dry run this rule (log only, nothing is sent)"
                      on={draft.dry_run}
                      disabled={!canEdit}
                      onToggle={() => patch('dry_run', !draft.dry_run)}
                    />
                  </div>
                </Step>
              </ol>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
                {selected !== 'new' ? (
                  <Button variant="ghost" size="sm" onClick={() => current && selectRule(current)} disabled={!dirty || busy}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                ) : null}
                <Button variant="primary" disabled={!canEdit || busy} onClick={save}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {selected === 'new' ? 'Create rule' : 'Save changes'}
                </Button>
              </div>
            </div>

            {/* ------------------------------------------------- test --- */}
            <aside className="space-y-4 border-t border-line bg-surface p-5 xl:border-l xl:border-t-0">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                <h3 className="text-sm font-bold">Try it</h3>
                <span className="text-[11px] text-muted">same matcher as the worker</span>
              </div>

              <ChatPreview
                name={testName || 'Someone'}
                body={testBody}
                reply={testMatch && !testEscalated ? testReply : ''}
                provider={testProvider}
                state={testEscalated ? 'escalate' : testMatch ? 'match' : 'none'}
                overLimit={testOverLimit ? `${testReply.length} characters, over the ${responseLimit} limit.` : null}
              />

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold">Incoming message</span>
                  <textarea className="field min-h-[72px] resize-y !text-sm" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold">From</span>
                    <input className="field !py-2 !text-sm" value={testName} onChange={(e) => setTestName(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold">On</span>
                    <select className="field !py-2 !text-sm" value={testChannel} onChange={(e) => setTestChannel(e.target.value)}>
                      <option value="">Shortest limit</option>
                      {initialChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channelLabel(ch)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                Age, caps, cooldowns and “a teammate replied first” are checked when the reply is
                actually sent, so a match here can still be skipped.
              </p>
            </aside>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- activity --- */}
      <section className="card overflow-hidden" aria-label="Recent activity">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <h2 className="text-sm font-bold">Activity</h2>
            <span className="text-[11px] text-muted">every decision, including skips</span>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedPills
              ariaLabel="Filter activity"
              size="sm"
              value={eventFilter}
              onChange={setEventFilter}
              options={[
                { value: 'all' as const, label: `All ${events.length}` },
                { value: 'sent' as const, label: `Sent ${counts.sent}` },
                { value: 'queued' as const, label: `Queued ${counts.queued}` },
                { value: 'skipped' as const, label: `Skipped ${counts.skipped}` },
                { value: 'failed' as const, label: `Failed ${counts.failed}` },
              ]}
            />
            <Button size="icon" variant="ghost" aria-label="Refresh activity" onClick={refreshEvents} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {visibleEvents.length ? (
          <ul className="divide-y divide-line-soft">
            {visibleEvents.map((event) => {
              const ch = channelById(event.channel_id);
              return (
                <li key={event.id} className="flex gap-3 px-5 py-3.5">
                  <span className="mt-0.5 shrink-0">
                    {ch ? (
                      <BrandIcon provider={ch.provider as BrandProvider} className="h-7 w-7" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface">
                        {event.target_kind === 'comment' ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-bold">{ruleName(event.rule_id)}</span>
                      <span className="text-muted">
                        {event.target_kind === 'comment' ? 'comment' : 'DM'}
                        {ch ? ` · ${channelLabel(ch)}` : ''}
                      </span>
                      <Badge variant={statusTone(event.status)} className="capitalize">
                        {event.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-soft">“{event.target_preview || '—'}”</p>
                    {event.reply_text ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                        <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="line-clamp-2">{event.reply_text}</span>
                      </p>
                    ) : null}
                    {event.reason ? <p className="mt-1 text-[11px] italic text-muted">{event.reason}</p> : null}
                  </div>
                  <time className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted" dateTime={event.created_at}>
                    {stamp(event.created_at)}
                  </time>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold">{events.length ? 'Nothing in this filter' : 'No activity yet'}</p>
            <p className="mt-1 max-w-sm text-xs text-muted">
              Once a comment or DM matches, every decision shows up here, including the skips and why.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type EventFilter = 'all' | 'sent' | 'queued' | 'skipped' | 'failed';

const VARIABLES = ['{{name}}', '{{first_name}}', '{{platform}}', '{{text}}'];

const TEMPLATES: { name: string; keywords: string; reply: string; scope: AutoReplyScope }[] = [
  {
    name: 'Price questions',
    keywords: 'price, how much, cost',
    reply: 'Hi {{first_name}}! Our prices are here: https://',
    scope: 'comments',
  },
  {
    name: 'Link please',
    keywords: 'link, where to buy, shop',
    reply: 'Hey {{first_name}}, here you go: https://',
    scope: 'comments',
  },
  {
    name: 'Welcome DM',
    keywords: 'hi, hello, hey',
    reply: 'Hi {{first_name}}, thanks for the message! We usually answer within a few hours.',
    scope: 'messages',
  },
];

function Header() {
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Auto-replies</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Pick keywords like “price”, write the answer, and Sosial replies to comments and DMs. Every
        match is logged, including the ones we deliberately skip.
      </p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className="card p-4">
      <span className={`flex items-center gap-1.5 text-xs font-semibold ${danger ? 'text-[#9F2F2D] dark:text-[#f2a8a8]' : 'text-muted'}`}>
        {icon}
        {label}
      </span>
      <span className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-extrabold tabular-nums">{value}</span>
        <span className="text-[11px] text-muted">{sub}</span>
      </span>
    </div>
  );
}

function Step({
  n,
  title,
  hint,
  last,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-6">
      {!last ? <span className="absolute left-[13px] top-8 bottom-0 w-px bg-line" aria-hidden="true" /> : null}
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-extrabold text-paper">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-bold">{title}</h3>
          <span className="text-[11px] text-muted">{hint}</span>
        </div>
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  );
}

function ChannelChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-soft hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  );
}

function Switch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  );
}

function ToggleRow({
  label,
  on,
  disabled,
  block,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  block?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 ${block ? 'justify-between px-4 py-3' : ''}`}>
      <span className={block ? 'text-sm' : 'text-xs font-semibold'}>{label}</span>
      <Switch on={on} disabled={disabled} label={label} onToggle={onToggle} />
    </div>
  );
}

function ChatPreview({
  name,
  body,
  reply,
  provider,
  state,
  overLimit,
}: {
  name: string;
  body: string;
  reply: string;
  provider: string;
  state: 'match' | 'escalate' | 'none';
  overLimit?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold uppercase">
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-bold">
            {name}
            <BrandIcon provider={provider as BrandProvider} className="h-3.5 w-3.5" />
          </span>
          <p className="mt-1 w-fit max-w-full break-words rounded-2xl rounded-tl-md bg-surface px-3 py-2 text-sm">
            {body || '…'}
          </p>
        </div>
      </div>

      <div className="my-3 flex items-center gap-2 text-[11px] font-bold">
        <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
        {state === 'escalate' ? (
          <span className="flex items-center gap-1 text-[#9F2F2D] dark:text-[#f2a8a8]">
            <Hand className="h-3.5 w-3.5" aria-hidden="true" /> Escalated to a human
          </span>
        ) : state === 'match' ? (
          <span className="flex items-center gap-1 text-[#346538] dark:text-[#8fd0a0]">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Trigger matched
          </span>
        ) : (
          <span className="text-muted">No match, ignored</span>
        )}
        <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
      </div>

      {reply ? (
        <div className="flex justify-end">
          <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-accent px-3 py-2 text-sm text-on-accent">
            {reply}
          </p>
        </div>
      ) : null}
      {overLimit ? <p className="mt-2 text-right text-[11px] font-semibold text-[#9F2F2D] dark:text-[#f2a8a8]">{overLimit}</p> : null}
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
    <label className="block rounded-2xl border border-line px-3 py-2.5 focus-within:border-ink">
      <span className="block text-[11px] font-semibold text-muted">{label}</span>
      <span className="mt-0.5 flex items-baseline gap-1.5">
        <input
          type="number"
          className="w-full min-w-0 bg-transparent font-display text-lg font-extrabold tabular-nums outline-none"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="shrink-0 text-[11px] text-muted">{suffix}</span>
      </span>
    </label>
  );
}
