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
  type MatchMode,
  type AutoReplySettings,
  type RuleInput,
  type RuleValues,
} from '@/lib/autoReply';
import { useT } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { automationMessages } from '@/lib/i18n/automations';

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
  const t = useT(automationMessages);
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

  const [testBody, setTestBody] = useState(() => t('demoBody'));
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
        setErr(json.error ?? t('errSave'));
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
      setNotice(creating ? t('noticeCreated') : t('noticeSaved'));
    } catch {
      setErr(t('errServer'));
    } finally {
      setBusy(false);
    }
  }, [draft, selected, t]);

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
        setErr(json.error ?? t('errUpdate'));
        return;
      }
      setRules((list) => list.map((r) => (r.id === json.rule!.id ? json.rule! : r)));
      if (selected === json.rule.id) setDraft(toDraft(json.rule));
    } catch {
      setErr(t('errServer'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rule: AutoReplyRule) => {
    if (!window.confirm(fill(t('confirmDelete'), { name: rule.name }))) return;
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
        setErr(json.error ?? t('errDelete'));
        return;
      }
      const next = rules.filter((r) => r.id !== rule.id);
      setRules(next);
      if (selected === rule.id) {
        if (next[0]) selectRule(next[0]);
        else startNew();
      }
    } catch {
      setErr(t('errServer'));
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
        setErr(json.error ?? t('errSwitches'));
        return;
      }
      setSettings(json.settings);
      setNotice(json.settings.paused ? t('noticePaused') : t('noticeActive'));
    } catch {
      setErr(t('errServer'));
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

  const ruleName = (id: string | null) => rules.find((r) => r.id === id)?.name ?? t('deletedRule');
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

  const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setSelected('new');
    setDraft({ ...toDraft(null), name: t(tpl.name), keywordsText: t(tpl.keywords), reply_text: t(tpl.reply), scope: tpl.scope });
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
        <div className="card overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-7 sm:p-9">
              <span className="pill bg-accent-soft text-accent-ink">{t('paidBadge')}</span>
              <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
                {t('paidTitle')}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                {t('paidBody')}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[t('paidF1'), t('paidF2'), t('paidF3')].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-[#346538] dark:text-[#8fd0a0]" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/billing" className="btn btn-bolt mt-6 inline-flex">
                <Zap className="h-4 w-4" aria-hidden="true" /> {t('seePlans')}
              </Link>
            </div>
            <div className="border-t border-line bg-surface p-6 md:border-l md:border-t-0">
              <ChatPreview
                name="Ana"
                body={t('demoBody')}
                reply={t('demoReply')}
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-end">
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
            {settings.paused ? t('statusPaused') : settings.dry_run ? t('statusLiveLog') : t('statusLive')}
          </span>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <ToggleRow
            label={t('repliesOn')}
            on={!settings.paused}
            disabled={!canEdit || busy}
            onToggle={() => saveSettings({ paused: !settings.paused })}
          />
          <ToggleRow
            label={t('dryRunAll')}
            on={settings.dry_run}
            disabled={!canEdit || busy}
            onToggle={() => saveSettings({ dry_run: !settings.dry_run })}
          />
          {!canEdit ? <Badge variant="outline">{t('readOnly')}</Badge> : null}
        </div>
      </div>

      {/* -------------------------------------------------- stats --- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Bot className="h-4 w-4" />} label={t('statLive')} value={liveRules} sub={fill(t('statOf'), { n: rules.length })} />
        <Stat icon={<Send className="h-4 w-4" />} label={t('statReplied')} value={counts.sent} sub={counts.queued ? fill(t('statQueued'), { n: counts.queued }) : t('statRecent')} />
        <Stat icon={<SkipForward className="h-4 w-4" />} label={t('statSkipped')} value={counts.skipped} sub={t('statWithReason')} />
        <Stat
          icon={<ShieldAlert className="h-4 w-4" />}
          label={t('statFailed')}
          value={counts.failed}
          sub={counts.failed ? t('statNeedsLook') : t('statAllClear')}
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
            <h2 className="eyebrow">{fill(t('rulesCount'), { n: rules.length })}</h2>
            <Button size="sm" variant="primary" disabled={!canEdit} onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> {t('newRule')}
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
                            {rule.scope === 'comments' ? t('scopeComments') : t('scopeDms')}
                            <span aria-hidden="true">·</span>
                            {ch ? (
                              <span className="flex min-w-0 items-center gap-1">
                                <BrandIcon provider={ch.provider as BrandProvider} className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{channelLabel(ch)}</span>
                              </span>
                            ) : (
                              t('allChannels')
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
                          label={fill(t(rule.enabled ? 'disableRule' : 'enableRule'), { name: rule.name })}
                          onToggle={() => toggle(rule, 'enabled')}
                        />
                      </div>
                      {rule.dry_run || !rule.enabled ? (
                        <div className="mt-2.5 flex gap-1.5 border-t border-line-soft pt-2.5">
                          {!rule.enabled ? <Badge variant="outline">{t('off')}</Badge> : null}
                          {rule.dry_run ? (
                            <Badge variant="accent">
                              <FlaskConical className="mr-1 inline h-3 w-3" aria-hidden="true" /> {t('dryRun')}
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
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t('templatesTitle')}
              </p>
              <div className="mt-2.5 space-y-1.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-left text-xs font-semibold transition hover:bg-line"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{t(tpl.name)}</span>
                      <span className="block truncate font-normal text-muted">{t(tpl.keywords)}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        {/* -------------------------------------------------- builder --- */}
        <section className="card overflow-hidden" aria-label={selected === 'new' ? t('newRule') : t('editRule')}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <input
              className="min-w-0 flex-1 bg-transparent font-display text-xl font-extrabold tracking-tight outline-none placeholder:text-muted/50"
              value={draft.name}
              disabled={!canEdit}
              placeholder={t('namePh')}
              aria-label={t('ruleName')}
              onChange={(e) => patch('name', e.target.value)}
            />
            <div className="flex items-center gap-2">
              {dirty ? <Badge variant="accent">{t('unsaved')}</Badge> : null}
              {selected === 'new' ? <Badge variant="outline">{t('badgeNew')}</Badge> : null}
              {current ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || busy}
                    onClick={() => toggle(current, 'dry_run')}
                  >
                    {current.dry_run ? <Play className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
                    {current.dry_run ? t('goLive') : t('dryRun')}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('deleteRule')}
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
                <Step n={1} title={t('step1')} hint={t('step1Hint')}>
                  <SegmentedPills
                    ariaLabel={t('where')}
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
                          {s.value === 'comments' ? t('scopeComments') : t('scopeMessages')}
                        </span>
                      ),
                    }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('channel')}>
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
                      {t('allChannels')}
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
                      {draft.scope === 'comments' ? t('noChannelsComments') : t('noChannelsDms')}{' '}
                      <Link href="/channels" className="font-bold underline">{t('connectOne')}</Link>
                    </p>
                  ) : null}
                </Step>

                {/* 2 · keywords */}
                <Step n={2} title={t('step2')} hint={t('step2Hint')}>
                  <input
                    className="field"
                    value={draft.keywordsText}
                    disabled={!canEdit}
                    placeholder={t('keywordsPh')}
                    aria-label={t('triggerWords')}
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
                      ariaLabel={t('allOrAny')}
                      size="sm"
                      value={draft.keyword_mode}
                      onChange={(v) => canEdit && patch('keyword_mode', v)}
                      options={[
                        { value: 'any' as const, label: t('anyWord'), disabled: !canEdit },
                        { value: 'all' as const, label: t('allWords'), disabled: !canEdit },
                      ]}
                    />
                    <SegmentedPills
                      ariaLabel={t('matching')}
                      size="sm"
                      value={draft.match_mode}
                      onChange={(v) => canEdit && patch('match_mode', v)}
                      options={MATCH_MODES.map((m) => ({ value: m.value, label: t(MATCH_LABEL[m.value]), title: t(`${MATCH_LABEL[m.value]}Hint`), disabled: !canEdit }))}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {t(`${MATCH_LABEL[draft.match_mode]}Hint`)}
                  </p>
                </Step>

                {/* 3 · reply */}
                <Step n={3} title={t('step3')} hint={t('step3Hint')}>
                  <div className="rounded-2xl border border-line bg-paper focus-within:border-ink">
                    <textarea
                      className="block min-h-[110px] w-full resize-y rounded-t-2xl bg-transparent px-4 py-3 text-sm outline-none"
                      value={draft.reply_text}
                      disabled={!canEdit}
                      aria-label={t('reply')}
                      placeholder={t('replyPh')}
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
                    {t('waitPre')}
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      className="field !w-20 !px-2 !py-1 !text-xs"
                      value={draft.delay_seconds}
                      disabled={!canEdit}
                      onChange={(e) => patch('delay_seconds', Number(e.target.value))}
                    />
                    {t('waitPost')}
                  </label>
                </Step>

                {/* 4 · guardrails */}
                <Step n={4} title={t('step4')} hint={t('step4Hint')} last>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <NumberField label={t('maxAge')} suffix={t('unitMin')} value={draft.max_age_minutes} min={1} max={10080} disabled={!canEdit} onChange={(v) => patch('max_age_minutes', v)} />
                    <NumberField label={t('dailyCap')} suffix={t('unitReplies')} value={draft.daily_cap} min={1} max={1000} disabled={!canEdit} onChange={(v) => patch('daily_cap', v)} />
                    <NumberField label={t('perPost')} suffix={t('unitReplies')} value={draft.per_post_cap} min={1} max={500} disabled={!canEdit} onChange={(v) => patch('per_post_cap', v)} />
                    <NumberField label={t('cooldown')} suffix={t('unitMin')} value={draft.cooldown_minutes} min={0} max={43200} disabled={!canEdit} onChange={(v) => patch('cooldown_minutes', v)} />
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-bold">
                      <Hand className="h-3.5 w-3.5" aria-hidden="true" /> {t('escalate')}
                    </span>
                    <input
                      className="field"
                      value={draft.escalateText}
                      disabled={!canEdit}
                      placeholder={t('escalatePh')}
                      onChange={(e) => patch('escalateText', e.target.value)}
                    />
                  </label>
                  <div className="mt-4 divide-y divide-line-soft rounded-2xl border border-line">
                    <ToggleRow
                      block
                      label={t('firstOnly')}
                      on={draft.first_reply_only}
                      disabled={!canEdit}
                      onToggle={() => patch('first_reply_only', !draft.first_reply_only)}
                    />
                    <ToggleRow
                      block
                      label={t('dryRunRule')}
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
                    <RotateCcw className="h-3.5 w-3.5" /> {t('reset')}
                  </Button>
                ) : null}
                <Button variant="primary" disabled={!canEdit || busy} onClick={save}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {selected === 'new' ? t('createRule') : t('saveChanges')}
                </Button>
              </div>
            </div>

            {/* ------------------------------------------------- test --- */}
            <aside className="space-y-4 border-t border-line bg-surface p-5 xl:border-l xl:border-t-0">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                <h3 className="text-sm font-bold">{t('tryIt')}</h3>
                <span className="text-[11px] text-muted">{t('tryItSub')}</span>
              </div>

              <ChatPreview
                name={testName || t('someone')}
                body={testBody}
                reply={testMatch && !testEscalated ? testReply : ''}
                provider={testProvider}
                state={testEscalated ? 'escalate' : testMatch ? 'match' : 'none'}
                overLimit={testOverLimit ? fill(t('overLimit'), { n: testReply.length, max: responseLimit }) : null}
              />

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold">{t('incoming')}</span>
                  <textarea className="field min-h-[72px] resize-y !text-sm" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold">{t('from')}</span>
                    <input className="field !py-2 !text-sm" value={testName} onChange={(e) => setTestName(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold">{t('on')}</span>
                    <select className="field !py-2 !text-sm" value={testChannel} onChange={(e) => setTestChannel(e.target.value)}>
                      <option value="">{t('shortestLimit')}</option>
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
                {t('sendNote')}
              </p>
            </aside>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- activity --- */}
      <section className="card overflow-hidden" aria-label={t('activity')}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <h2 className="text-sm font-bold">{t('activity')}</h2>
            <span className="text-[11px] text-muted">{t('activitySub')}</span>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedPills
              ariaLabel={t('filterActivity')}
              size="sm"
              value={eventFilter}
              onChange={setEventFilter}
              options={[
                { value: 'all' as const, label: fill(t('fAll'), { n: events.length }) },
                { value: 'sent' as const, label: fill(t('fSent'), { n: counts.sent }) },
                { value: 'queued' as const, label: fill(t('fQueued'), { n: counts.queued }) },
                { value: 'skipped' as const, label: fill(t('fSkipped'), { n: counts.skipped }) },
                { value: 'failed' as const, label: fill(t('fFailed'), { n: counts.failed }) },
              ]}
            />
            <Button size="icon" variant="ghost" aria-label={t('refreshActivity')} onClick={refreshEvents} disabled={busy}>
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
                        {event.target_kind === 'comment' ? t('kindComment') : t('kindDm')}
                        {ch ? ` · ${channelLabel(ch)}` : ''}
                      </span>
                      <Badge variant={statusTone(event.status)}>
                        {t(`status_${event.status}`)}
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
            <p className="mt-3 text-sm font-bold">{events.length ? t('emptyFilter') : t('emptyActivity')}</p>
            <p className="mt-1 max-w-sm text-xs text-muted">
              {t('emptyActivitySub')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type EventFilter = 'all' | 'sent' | 'queued' | 'skipped' | 'failed';

const VARIABLES = ['{{name}}', '{{first_name}}', '{{platform}}', '{{text}}'];

/** Template fields are dictionary keys. */
const TEMPLATES: { name: string; keywords: string; reply: string; scope: AutoReplyScope }[] = [
  { name: 'tplPriceName', keywords: 'tplPriceKeywords', reply: 'tplPriceReply', scope: 'comments' },
  { name: 'tplLinkName', keywords: 'tplLinkKeywords', reply: 'tplLinkReply', scope: 'comments' },
  { name: 'tplWelcomeName', keywords: 'tplWelcomeKeywords', reply: 'tplWelcomeReply', scope: 'messages' },
];

/** MATCH_MODES value → dictionary key (the hint is the same key + `Hint`). */
const MATCH_LABEL: Record<MatchMode, string> = { word: 'matchWord', contains: 'matchContains', exact: 'matchExact' };

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
  const t = useT(automationMessages);
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
            <Hand className="h-3.5 w-3.5" aria-hidden="true" /> {t('escalated')}
          </span>
        ) : state === 'match' ? (
          <span className="flex items-center gap-1 text-[#346538] dark:text-[#8fd0a0]">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t('matched')}
          </span>
        ) : (
          <span className="text-muted">{t('noMatch')}</span>
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
