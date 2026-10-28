'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';
import { checkCompatibility, CAPABILITIES } from '@/lib/compat';
import { createClient } from '@/lib/supabase/client';
import { createPost, createChain, mediaBlock, type ComposeMode } from '@/lib/posts';
import { minQueueTime, queueTooSoon } from '@/lib/queue';
import { generateSocial, withHashtags } from '@/lib/ai';
import { BrandIcon } from '@/components/BrandIcon';
import SafeImg from '@/components/SafeImg';
import { CheckIcon } from '@/components/StatusIcons';
import DateTimePicker from '@/components/DateTimePicker';
import SegmentedPills from '@/components/ui/segmented-pills';
import { EmojiInput, EmojiTextarea } from '@/components/Emoji';
import { providerMeta } from '@/lib/providers';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const MODES: { id: ComposeMode; key: string }[] = [
  { id: 'draft', key: 'cSaveDraft' },
  { id: 'schedule', key: 'cSchedule' },
  { id: 'now', key: 'cPublishNow' },
];

const TONES = ['auto', 'bold', 'funny', 'professional', 'friendly'] as const;

type Kind = 'single' | 'chain';

interface Seg {
  key: number;
  body: string;
}

export default function Composer({
  channels,
  workspaceId,
  userId,
  role,
  initialTitle = '',
  initialBody = '',
  initialFiles = [],
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
  /** Prefill for "post this idea", parent remounts (key) to apply. */
  initialTitle?: string;
  initialBody?: string;
  /** Files attached by a design template, parent remounts (key) to apply. */
  initialFiles?: File[];
}) {
  const router = useRouter();
  const t = useT(appMessages);
  const isMember = role === 'member';
  const ready = channels.filter((c) => c.status === 'connected');
  const [kind, setKind] = useState<Kind>('single');
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [mode, setMode] = useState<ComposeMode>('now');
  const [whenIso, setWhenIso] = useState<string | null>(() => new Date(minQueueTime()).toISOString());
  const [tz, setTz] = useState(deviceZone);
  // TikTok never starts picked here (and can't be picked, see allReady).
  const [picked, setPicked] = useState<string[]>(() =>
    ready.filter((c) => c.provider !== 'tiktok').map((c) => c.id),
  );
  const [files, setFiles] = useState<{ file: File; kind: 'image' | 'video'; url: string }[]>(() =>
    initialFiles.map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Chain state: lead + 2 follower parts; the prefill (if any) seeds part 1.
  const segKey = useRef(3);
  const [segments, setSegments] = useState<Seg[]>(() => [
    { key: 0, body: initialBody },
    { key: 1, body: '' },
    { key: 2, body: '' },
  ]);
  const [gap, setGap] = useState(10);

  // AI assist.
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<string>('auto');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  /** Live per-channel verdicts (Phase 0 engine), panel display + submit gates. */
  const compat = useMemo(() => {
    const chs = ready.filter((c) => picked.includes(c.id));
    const headKinds = files.map((f) => f.kind);
    const parts =
      kind === 'chain'
        ? segments.map((s, i) => ({ body: s.body, kinds: i === 0 ? headKinds : [] }))
        : [{ body, kinds: headKinds }];
    return {
      providers: Array.from(new Set(chs.map((c) => c.provider))),
      issues: checkCompatibility(
        chs.map((c) => ({ provider: c.provider, metadata: c.metadata })),
        { thread: kind === 'chain', parts, title },
      ),
    };
  }, [ready, picked, files, segments, body, title, kind]);

  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(
    () => () => {
      for (const f of filesRef.current) URL.revokeObjectURL(f.url);
    },
    [],
  );

  /**
   * Inline gating: chips the draft can't satisfy render grey and explain on
   * tap, the standalone panel is gone.
   */
  const allReady = useMemo(() => {
    const totalMedia = files.length;
    const hasVideo = files.some((f) => f.kind === 'video');
    const hasImage = files.some((f) => f.kind === 'image');
    return ready.map((c) => {
      const cap = CAPABILITIES[c.provider as keyof typeof CAPABILITIES];
      const base = { id: c.id, reason: '' as string };
      // TikTok needs its own settings panel (audience, interactions,
      // disclosure), which only the Create composer has.
      if (c.provider === 'tiktok') return { ...base, blocked: true, reason: t('cTikTokUseCreate') };
      if (!cap) return { ...base, blocked: false };
      if (cap.requiresVideo && !hasVideo) {
        return { ...base, blocked: true, reason: fill(t('capNeedsVideo'), { label: cap.label }) };
      }
      if (cap.requiresMedia && totalMedia === 0) {
        return { ...base, blocked: true, reason: fill(t('capNeedsMedia'), { label: cap.label }) };
      }
      if (hasVideo && cap.supports.video === false) {
        return { ...base, blocked: true, reason: fill(t('capNoVideo'), { label: cap.label }) };
      }
      if (hasImage && cap.supports.image === false) {
        return { ...base, blocked: true, reason: fill(t('capNoImage'), { label: cap.label }) };
      }
      return { ...base, blocked: false };
    });
  }, [ready, files, t]);
  const [chipNote, setChipNote] = useState<string | null>(null);
  const chipMeta = useMemo(() => new Map(allReady.map((x) => [x.id, x])), [allReady]);

  function toggle(id: string) {
    const info = chipMeta.get(id);
    if (info?.blocked) {
      setChipNote(info.reason || t('cChipDefault'));
      return;
    }
    setChipNote(null);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  }

  function removeFile(i: number) {
    setFiles((prev) => {
      const next = [...prev];
      const [gone] = next.splice(i, 1);
      if (gone) URL.revokeObjectURL(gone.url);
      return next;
    });
  }

  function setSegBody(key: number, v: string) {
    setSegments((prev) => prev.map((s) => (s.key === key ? { ...s, body: v } : s)));
  }

  function addSeg() {
    setSegments((prev) => (prev.length >= 8 ? prev : [...prev, { key: segKey.current++, body: '' }]));
  }

  function removeSeg(key: number) {
    setSegments((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  function moveSeg(key: number, dir: -1 | 1) {
    setSegments((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const chosenProviders = Array.from(
    new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider)),
  );
  const strictest = Math.min(
    2200,
    ...ready.filter((c) => picked.includes(c.id)).map((c) => providerMeta(c.provider).limit),
  );

  async function runAi() {
    setAiErr(null);
    const topicTrim = topic.trim();
    if (!topicTrim) {
      setAiErr(t('cErrTopic'));
      return;
    }
    if (!chosenProviders.length) {
      setAiErr(t('cErrPickChannel'));
      return;
    }
    const chain = kind === 'chain';
    setAiBusy(true);
    try {
      const sb = createClient();
      const variants = await generateSocial(sb, {
        topic: topicTrim,
        platforms: chosenProviders,
        thread: chain,
        parts: chain ? segments.length : 1,
        tone,
        hashtags: true,
      });
      const v = variants[0];
      if (chain) {
        setSegments(v.posts.map((p) => ({ key: segKey.current++, body: withHashtags(p, v.hashtags) })));
      } else {
        setBody(withHashtags(v.posts[0] ?? '', v.hashtags));
      }
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : t('cErrAi'));
    } finally {
      setAiBusy(false);
    }
  }

  const submitLabel =
    isMember && mode === 'now'
      ? t('cSendApproval')
      : kind === 'chain'
        ? `${MODES.find((m) => m.id === mode)?.key ? t(MODES.find((m) => m.id === mode)!.key) : ''} ${t('cChainSuffix')}`
        : MODES.find((m) => m.id === mode)?.key
          ? t(MODES.find((m) => m.id === mode)!.key)
          : '';

  async function submitSingle(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr(t('cErrPick'));
      return;
    }
    if (mode === 'schedule' && !whenIso) {
      setErr(t('cErrDate'));
      return;
    }
    if (mode === 'schedule' && whenIso && queueTooSoon(whenIso)) {
      setErr(t('leadTime'));
      return;
    }
    if (!body.trim() && !title.trim() && files.length === 0) {
      setErr(t('cErrContent'));
      return;
    }
    const blockedSingle = mediaBlock(
      chosen.map((c) => c.provider),
      files,
    );
    if (blockedSingle) {
      setErr(blockedSingle.message);
      return;
    }
    // Drafts save freely; anything else must clear the capability gate.
    if (mode !== 'draft') {
      const singleBlockers = compat.issues.filter((i) => i.level === 'error');
      if (singleBlockers.length) {
        setErr(singleBlockers.map((i) => i.message).join('\n'));
        return;
      }
    }
    setBusy(true);
    try {
      const sb = createClient();
      await createPost(sb, {
        workspaceId,
        userId,
        role,
        title,
        body,
        mode,
        scheduleIso: whenIso,
        channels: chosen,
        files,
        timezone: tz,
      });
      router.push('/queue');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('cErrSavePost'));
      setBusy(false);
    }
  }

  async function submitChain(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr(t('cErrPick'));
      return;
    }
    if (mode === 'schedule' && !whenIso) {
      setErr(t('cErrStart'));
      return;
    }
    if (mode === 'schedule' && whenIso && queueTooSoon(whenIso)) {
      setErr(t('leadTime'));
      return;
    }
    const liveIdx = segments.map((_, i) => i).filter((i) => segments[i].body.trim());
    const payload =
      liveIdx.length > 0
        ? liveIdx.map((i, k) => ({ body: segments[i].body, files: k === 0 ? files : [] }))
        : files.length > 0
          ? [{ body: '', files }]
          : null;
    if (!payload) {
      setErr(t('cErrChainPart'));
      return;
    }
    // Media rides on part 1, the media channels judge the chain by it.
    const blockedChain = mediaBlock(
      chosen.map((c) => c.provider),
      files,
    );
    if (blockedChain) {
      setErr(blockedChain.message);
      return;
    }
    if (mode !== 'draft') {
      const chainBlockers = compat.issues.filter((i) => i.level === 'error');
      if (chainBlockers.length) {
        setErr(chainBlockers.map((i) => i.message).join('\n'));
        return;
      }
    }
    setBusy(true);
    try {
      const sb = createClient();
      await createChain(sb, {
        workspaceId,
        userId,
        role,
        segments: payload,
        mode,
        startIso: whenIso,
        gapMinutes: gap,
        channels: chosen,
        timezone: tz,
      });
      router.push('/queue');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('cErrSaveChain'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={kind === 'chain' ? submitChain : submitSingle} className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="eyebrow">{t('cEyebrow')}</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            {kind === 'chain' ? t('cNewChain') : t('cNewPost')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedPills
            ariaLabel={t('cNewPost')}
            role="tablist"
            variant="accent"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'single', label: t('cSingle') },
              { value: 'chain', label: t('cChain') },
            ]}
          />
          <button className="btn btn-bolt" disabled={busy} type="submit">
            {busy ? t('cSaving') : submitLabel}
          </button>
        </div>
      </header>

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          {kind === 'single' ? (
            <>
              <EmojiInput
                className="field font-display text-lg font-bold"
                placeholder={t('cTitlePh')}
                value={title}
                onChange={setTitle}
              />
              <EmojiTextarea
                className="field min-h-[240px] resize-y leading-relaxed"
                placeholder={t('cBodyPh')}
                value={body}
                onChange={setBody}
              />
              <p className="text-xs text-faint">
                {fill(t('cChars'), { n: body.length.toLocaleString(), max: strictest.toLocaleString() })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                {fill(t('cChainIntro'), {
                  when: mode === 'draft' ? t('cChainDraftWhen') : fill(t('cChainGapWhen'), { n: gap }),
                })}
              </p>
              {segments.map((s, i) => (
                <div key={s.key} className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="eyebrow">
                      {fill(t('cPart'), { n: i + 1 })}
                      {i === 0 && files.length > 0 ? t('cCarriesMedia') : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        title={t('cMoveUp')}
                        onClick={() => moveSeg(s.key, -1)}
                        disabled={i === 0}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title={t('cMoveDown')}
                        onClick={() => moveSeg(s.key, 1)}
                        disabled={i === segments.length - 1}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        title={t('cRemovePart')}
                        onClick={() => removeSeg(s.key)}
                        disabled={segments.length <= 1}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper disabled:opacity-30"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                  <EmojiTextarea
                    className="field min-h-[120px] resize-y leading-relaxed"
                    placeholder={
                      i === 0
                        ? t('cHookPh')
                        : i === segments.length - 1
                          ? t('cLandingPh')
                          : t('cBuildPh')
                    }
                    value={s.body}
                    onChange={(v) => setSegBody(s.key, v)}
                  />
                  <p className="mt-1 text-xs text-faint">
                    {fill(t('cChars'), { n: s.body.length.toLocaleString(), max: strictest.toLocaleString() })}
                  </p>
                </div>
              ))}
              {segments.length < 8 && (
                <button type="button" onClick={addSeg} className="btn btn-ghost w-full">
                  {fill(t('cAddPart'), { n: segments.length })}
                </button>
              )}
            </>
          )}

          <div>
            <p className="eyebrow mb-2">{t('cMedia')}{kind === 'chain' ? t('cMediaChain') : ''}</p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card px-4 py-6 text-center hover:bg-paper">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <span className="text-sm font-semibold text-soft">{t('cAddMedia')}</span>
              <span className="mt-1 text-xs text-faint">{t('cUpTo10')}</span>
            </label>

            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {files.map((f, i) => (
                  <div
                    key={`${f.file.name}-${i}`}
                    className="relative overflow-hidden rounded-xl border border-line bg-bone"
                  >
                    {f.kind === 'video' ? (
                      <video src={f.url} muted playsInline className="h-24 w-full object-cover" />
                    ) : (
                      <SafeImg src={f.url} alt={f.file.name} className="h-24 w-full object-cover" />
                    )}
                    {f.kind === 'video' && (
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        VIDEO
                      </span>
                    )}
                    <button
                      type="button"
                      title={t('cRemove')}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                      onClick={() => removeFile(i)}
                    >
                      ×
                    </button>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                      {f.file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-5 lg:w-80">
          <div className="card space-y-3 p-4" data-tour="composer-ai">
            <p className="eyebrow">{t('cAiCaptions')}</p>
            <EmojiTextarea
              className="field min-h-[72px] resize-y text-sm"
              placeholder={t('cAiTopicPh')}
              value={topic}
              onChange={setTopic}
            />
            <div className="flex items-center gap-2">
              <select
                className="field !w-auto flex-1 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                aria-label={t('cTone')}
              >
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {t(`tone${tone[0].toUpperCase()}${tone.slice(1)}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={runAi}
                disabled={aiBusy}
                className="btn btn-bolt shrink-0 !px-4 !py-2 !text-xs"
              >
                {aiBusy ? t('cWriting') : kind === 'chain' ? fill(t('cWriteN'), { n: segments.length }) : t('cWriteCaption')}
              </button>
            </div>
            {aiErr && <p className="text-xs text-[#9F2F2D] dark:text-[#f2a8a8]">{aiErr}</p>}
            <p className="text-xs text-faint">
              {fill(t('cAiNote'), {
                max: strictest.toLocaleString(),
                what: kind === 'chain' ? t('cAiParts') : t('cAiCaption'),
              })}
            </p>
          </div>

          <div className="card p-4" data-tour="composer-channels">
            <p className="eyebrow mb-3">{t('cChannels')}</p>
            {ready.length === 0 ? (
              <p className="text-sm text-muted">
                {t('cNoChannels')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {ready.map((c) => {
                  const meta = providerMeta(c.provider);
                  const info = chipMeta.get(c.id);
                  const blocked = !!info?.blocked;
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      title={blocked ? info?.reason : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        blocked
                          ? 'cursor-not-allowed border-line bg-bone text-faint opacity-50'
                          : on
                            ? 'border-ink bg-paper-dim'
                            : 'border-line bg-paper hover:bg-bone'
                      }`}
                    >
                      <BrandIcon provider={c.provider} className="h-6 w-6 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{meta.label}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.handle ? `@${c.handle}` : c.display_name ?? c.external_id} ·{' '}
                          {fill(t('cCharsShort'), { n: meta.limit.toLocaleString() })}
                        </span>
                      </span>
                      <span className={`inline-flex ${on && !blocked ? 'text-ink' : 'text-faint'}`}>
                        {on && !blocked ? <CheckIcon size={14} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {chipNote ? (
            <p className="rounded-xl bg-[#FDF6E7] px-3 py-2 text-xs font-bold text-amber-700">
              {chipNote}
            </p>
          ) : null}

          <div className="card p-4" data-tour="composer-when">
            <p className="eyebrow mb-3">{t('cWhen')}</p>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    // Flipping to schedule always lands on a valid time -
                    // fresh default when empty, refreshed when gone stale.
                    if (m.id === 'schedule' && (!whenIso || queueTooSoon(whenIso))) {
                      setWhenIso(new Date(minQueueTime()).toISOString());
                    }
                    setMode(m.id);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    mode === m.id ? 'bg-accent text-on-accent' : 'bg-surface text-soft hover:bg-line'
                  }`}
                >
                  {t(m.key)}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <div className="mt-3">
                <p className="text-xs font-bold text-muted">
                  {kind === 'chain' ? t('cPartGoesAt') : t('cGoesOutAt')}
                </p>
                <div className="mt-1">
                  <DateTimePicker
                    value={whenIso}
                    timezone={tz}
                    onChange={setWhenIso}
                    onTimezoneChange={setTz}
                  />
                </div>
              </div>
            )}
            {kind === 'chain' && mode !== 'draft' && (
              <label className="mt-3 block text-xs font-bold text-muted">
                {t('cGapLabel')}
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={1440}
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
                />
              </label>
            )}
            {mode === 'now' && (
              <p className="mt-3 text-xs text-muted">
                {isMember
                  ? t('cNowMember')
                  : kind === 'chain'
                    ? t('cNowChain')
                    : t('cNowSingle')}
              </p>
            )}
            {mode === 'draft' && (
              <p className="mt-3 text-xs text-muted">{t('cDraftNote')}</p>
            )}
            {isMember && mode !== 'draft' && (
              <p className="mt-3 rounded-lg bg-paper-dim px-2.5 py-2 text-xs text-ink">
                {t('cMemberNote')}
              </p>
            )}
          </div>

          <p className="text-xs text-faint">
            {t('cWorkspaceNote')}
          </p>
        </aside>
      </div>
    </form>
  );
}
