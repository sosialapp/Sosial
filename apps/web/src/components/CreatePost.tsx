'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import PostBox, { type MediaItem, type Segment } from '@/components/PostBox';
import AiCard from '@/components/AiCard';
import SendIcon from '@/components/SendIcon';
import { GitBranch } from 'lucide-react';
import DateTimePicker from '@/components/DateTimePicker';
import StudioCanvas from '@/components/studio/StudioCanvas';
import { exportCanvasPng } from '@/lib/studio/exportPng';
import { POST_SIZES, type StudioProject } from '@/lib/studio/model';
import { providerMeta } from '@/lib/providers';
import { checkCompatibility, CAPABILITIES } from '@/lib/compat';
import { createChain, createPost, deletePost, mediaBlock, type ComposeMode } from '@/lib/posts';
import { leadTimeMessage, minQueueTime, queueTooSoon } from '@/lib/queue';
import { createClient } from '@/lib/supabase/client';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

/** Native reply-chains exist on these four channels only — same as the app. */
const THREAD_PROVIDERS = ['x', 'threads', 'mastodon', 'bluesky'];

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Branch mark, same glyph family as the mobile app's thread icon. */
function BranchIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return <GitBranch className={className} aria-hidden="true" />;
}

type RailTab = 'template' | 'preview' | 'ai';

function RailDesignTile({
  project,
  pageIndex,
  busyKey,
  onUse,
}: {
  project: StudioProject;
  pageIndex: number;
  busyKey: string | null;
  onUse: (project: StudioProject, pageIndex: number, node: HTMLElement | null) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const page = project.pages[pageIndex] ?? project.pages[0];
  const busy = busyKey === `${project.id}:${pageIndex}`;
  if (!page) return null;
  const ratio = POST_SIZES.find((s) => s.id === project.sizeId)?.ratio ?? 1.25;
  return (
    <article className="w-[148px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-paper">
      <button
        type="button"
        onClick={() => onUse(project, pageIndex, nodeRef.current)}
        disabled={busy}
        className="relative block w-full text-left"
        aria-label={`Use ${project.name} in this post`}
      >
        <div ref={nodeRef}>
          <StudioCanvas page={page} ratio={ratio} width={148} frame={false} />
        </div>
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-xs font-bold text-white">
            Rendering…
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/55 to-transparent px-2 pt-6 pb-2 text-xs font-extrabold text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100">
            Use design
          </span>
        )}
      </button>
      <p className="truncate px-2.5 pt-1.5 text-xs font-bold">{project.name}</p>
      <p className="truncate px-2.5 pb-2 text-[11px] text-muted">
        {project.pages.length} page{project.pages.length === 1 ? '' : 's'}
      </p>
    </article>
  );
}

import PostPreview from '@/components/studio/PostPreview';

/**
 * Right-rail switch: Template (text captions or canvas designs into the
 * composer) · Preview (this draft as each picked channel shows it) · AI
 * (the writer, as before).
 */
function RailPanel({
  tab,
  onTab,
  tplKind,
  onTplKind,
  captions,
  designs,
  starterDesigns,
  onUseCaption,
  onUseDesign,
  designBusy,
  channels,
  picked,
  segs,
  ai,
}: {
  tab: RailTab;
  onTab: (t: RailTab) => void;
  tplKind: 'text' | 'design';
  onTplKind: (k: 'text' | 'design') => void;
  captions: { id: string; name: string; title: string; body: string }[];
  designs: StudioProject[];
  starterDesigns: StudioProject[];
  onUseCaption: (t: { title: string; body: string }) => void;
  onUseDesign: (project: StudioProject, pageIndex: number, node: HTMLElement | null) => void;
  designBusy: string | null;
  channels: ConnectedChannel[];
  picked: string[];
  segs: Segment[];
  ai: React.ReactNode;
}) {
  const head = segs[0];
  const body = (head?.body ?? '').trim();
  const media = head?.media ?? [];
  const shown = channels.filter((c) => picked.includes(c.id));
  return (
    <div className="card space-y-3 p-4 sm:p-5">
      <div className="flex rounded-full border border-line bg-paper p-1" role="group" aria-label="Studio panel">
        {(['template', 'preview', 'ai'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
              tab === t ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {t === 'ai' ? 'AI' : t}
          </button>
        ))}
      </div>

      {tab === 'ai' ? ai : null}

      {tab === 'template' ? (
        <div className="space-y-3">
          <div className="flex gap-1.5" role="group" aria-label="Template kind">
            {(['text', 'design'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onTplKind(k)}
                aria-pressed={tplKind === k}
                className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition ${
                  tplKind === k ? 'border-ink bg-paper text-ink' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {k === 'text' ? 'Template text' : 'Template design'}
              </button>
            ))}
          </div>
          {tplKind === 'text' ? (
            captions.length === 0 ? (
              <p className="text-sm text-muted">No caption templates yet — save one on the Templates tab.</p>
            ) : (
              <div className="max-h-[480px] space-y-2 overflow-y-auto">
                {captions.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-line bg-paper p-3">
                    <p className="truncate text-sm font-bold">{t.name}</p>
                    {t.body ? <p className="mt-0.5 line-clamp-2 text-xs text-soft">{t.body}</p> : null}
                    <button
                      type="button"
                      onClick={() => onUseCaption(t)}
                      className="btn btn-ghost mt-2 w-full !py-1.5 !text-xs"
                    >
                      Use caption
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : designs.length + starterDesigns.length === 0 ? (
            <p className="text-sm text-muted">No designs yet — make one on the Templates tab.</p>
          ) : (
            <div className="max-h-[480px] space-y-5 overflow-y-auto pb-1">
              {starterDesigns.length > 0 ? (
                <div>
                  <p className="eyebrow mb-2">Starter templates</p>
                  <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                    {starterDesigns.map((d) => (
                      <RailDesignTile key={d.id} project={d} pageIndex={0} busyKey={designBusy} onUse={onUseDesign} />
                    ))}
                  </div>
                </div>
              ) : null}
              {designs.length > 0 ? (
                <div>
                  <p className="eyebrow mb-2">Your templates</p>
                  <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                    {designs.map((d) => (
                      <RailDesignTile key={d.id} project={d} pageIndex={0} busyKey={designBusy} onUse={onUseDesign} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'preview' ? (
        <div className="space-y-3">
          {shown.length === 0 ? (
            <p className="text-sm text-muted">Pick a channel above to preview this post as they will see it.</p>
          ) : !body && media.length === 0 ? (
            <p className="text-sm text-muted">Write something (or attach media) to preview it here.</p>
          ) : (
            <div className="max-h-[520px] space-y-4 overflow-y-auto pb-1">
              {shown.map((c) => {
                const meta = providerMeta(c.provider);
                const img = media.find((m) => m.kind === 'image');
                const vid = !img ? media.find((m) => m.kind === 'video') : undefined;
                return (
                  <div key={c.id}>
                    <p className="mb-1.5 text-xs font-bold text-muted">
                      {c.display_name ?? meta.label}
                    </p>
                    <PostPreview
                      provider={c.provider}
                      handle={
                        c.handle
                          ? `@${String(c.handle).replace(/^@/, '')}`
                          : `@${(c.display_name ?? meta.label).replace(/^@/, '')}`
                      }
                      body={body}
                      imageUrl={img?.url}
                      videoUrl={vid?.url}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function toMediaItems(files: File[]): MediaItem[] {
  return files.map((file) => ({
    file,
    kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
    url: URL.createObjectURL(file),
  }));
}

/**
 * Create hub post tab: composer card (channel pills, inbox media with drag
 * reorder, thread link, dashboard-style mode row) + AI studio card bound to
 * the same channels and thread state.
 */
export default function CreatePost({
  channels,
  workspaceId,
  userId,
  role,
  initialTitle = '',
  initialBody = '',
  initialFiles = [],
  initialThread = false,
  initialParts,
  initialChannelIds,
  initialWhenIso = null,
  initialMediaParts,
  editingIds,
  onEdited,
  libraryCaptions = [],
  libraryDesigns = [],
  libraryStarterDesigns = [],
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
  initialTitle?: string;
  initialBody?: string;
  initialFiles?: File[];
  /** Idea prefill: open straight in thread mode. */
  initialThread?: boolean;
  /** Idea prefill: one body per thread part (part 1 may carry initialFiles). */
  initialParts?: string[];
  /** Draft edit: pre-select these channels (filtered to connected ones). */
  initialChannelIds?: string[];
  /** Draft edit: pre-fill the schedule time. */
  initialWhenIso?: string | null;
  /** Draft edit: remote media per part to reload into the composer. */
  initialMediaParts?: { url: string; kind: 'image' | 'video' }[][];
  /** Draft edit: previous post rows, deleted after the replacement saves. */
  editingIds?: string[];
  /** Draft edit: called after the replacement saves. */
  onEdited?: () => void;
  /** Library for the rail Template tab (passed from the hub — no duplication). */
  libraryCaptions?: { id: string; name: string; title: string; body: string }[];
  libraryDesigns?: StudioProject[];
  libraryStarterDesigns?: StudioProject[];
}) {
  const router = useRouter();
  const ready = useMemo(() => channels.filter((c) => c.status === 'connected'), [channels]);

  const initParts = initialParts && initialParts.length > 1 ? initialParts : null;

  /* ------------------------------ composer ------------------------------ */
  const [segs, setSegs] = useState<Segment[]>(() => {
    if (initParts) {
      return initParts.map((b, i) => ({
        body: b || (i === 0 ? initialTitle : ''),
        media: i === 0 ? toMediaItems(initialFiles) : [],
      }));
    }
    return [
      {
        body: initialBody || initialTitle,
        media: toMediaItems(initialFiles),
      },
    ];
  });
  const [picked, setPicked] = useState<string[]>(() => {
    if (initialChannelIds?.length) {
      const live = initialChannelIds.filter((id) => ready.some((c) => c.id === id));
      if (live.length) {
        // Editing a thread: drop channels that cannot carry a reply-chain.
        if (initialThread || (initialParts && initialParts.length > 1)) {
          const chainable = live.filter((id) => {
            const c = ready.find((x) => x.id === id);
            return c ? THREAD_PROVIDERS.includes(c.provider) : false;
          });
          if (chainable.length) return chainable;
        }
        return live;
      }
    }
    return ready.map((c) => c.id);
  });
  const [thread, setThread] = useState(Boolean(initialThread) || Boolean(initParts));
  const [parts, setParts] = useState(() => Math.max(3, initParts?.length ?? 3));
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [whenIso, setWhenIso] = useState<string | null>(
    initialWhenIso ?? new Date(minQueueTime()).toISOString(),
  );
  const [tz, setTz] = useState(deviceZone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  /** Right-rail switch + template sub-switch + per-design export busy key. */
  const [rail, setRail] = useState<'template' | 'preview' | 'ai'>('ai');
  const [tplKind, setTplKind] = useState<'text' | 'design'>('text');
  const [designBusy, setDesignBusy] = useState<string | null>(null);

  /** Rail Template/text: drop a caption into part 1, keeping its media. */
  function useRailCaption(t: { title: string; body: string }) {
    const text = [t.title.trim(), t.body.trim()].filter(Boolean).join('\n\n');
    setSegs((prev) => [{ body: text, media: prev[0]?.media ?? [] }]);
  }

  /** Rail Template/design: render the page to PNG and attach it to part 1. */
  async function useRailDesign(project: StudioProject, pageIndex: number, node: HTMLElement | null) {
    if (!node) return;
    const key = `${project.id}:${pageIndex}`;
    setDesignBusy(key);
    try {
      const blob = await exportCanvasPng(node, 1080);
      const file = new File([blob], `${project.name || 'design'}-p${pageIndex + 1}.png`, { type: 'image/png' });
      addFilesTo(0, [file]);
      setRail('preview');
    } finally {
      setDesignBusy(null);
    }
  }
  /** Post-now confirmation: validations pass first, then the channel list. */
  const [confirmNow, setConfirmNow] = useState(false);
  const nowConfirmed = useRef(false);

  /** Draft edit: reload the saved remote media into real Files so the normal
   *  upload path carries them on save. Runs once per mount (the host remounts
   *  per edit via key). Tolerates single failures. */
  useEffect(() => {
    if (!initialMediaParts?.some((items) => items.length)) return;
    let alive = true;
    setMediaLoading(true);
    (async () => {
      const loaded = await Promise.all(
        initialMediaParts.map(async (items, i) =>
          (
            await Promise.all(
              items.map(async (m, j) => {
                try {
                  const res = await fetch(m.url);
                  if (!res.ok) return null;
                  const blob = await res.blob();
                  const ext = m.kind === 'video' ? 'mp4' : 'jpg';
                  const file = new File(
                    [blob],
                    `draft-media-${i}-${j}.${ext}`,
                    { type: blob.type || (m.kind === 'video' ? 'video/mp4' : 'image/jpeg') },
                  );
                  return { file, kind: m.kind as 'image' | 'video', url: URL.createObjectURL(file) };
                } catch {
                  return null;
                }
              }),
            )
          ).filter((x): x is { file: File; kind: 'image' | 'video'; url: string } => Boolean(x)),
        ),
      );
      if (!alive) return;
      const total = loaded.reduce((n, arr) => n + arr.length, 0);
      if (total > 0) {
        setSegs((prev) =>
          prev.map((s, i) => ({ ...s, media: [...s.media, ...(loaded[i] ?? [])].slice(0, 10) })),
        );
      } else {
        setErr('Draft media could not be reloaded — re-attach it before saving.');
      }
      setMediaLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosenProviders = useMemo(
    () => Array.from(new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider))),
    [ready, picked],
  );
  const limit = useMemo(() => {
    const ls = ready.filter((c) => picked.includes(c.id)).map((c) => providerMeta(c.provider).limit);
    return ls.length ? Math.min(...ls) : 2200;
  }, [ready, picked]);

  /** Live per-channel verdicts — powers the grey pills + tap messages. */
  const compat = useMemo(() => {
    const chs = ready.filter((c) => picked.includes(c.id));
    return {
      providers: Array.from(new Set(chs.map((c) => c.provider))),
      issues: checkCompatibility(
        chs.map((c) => ({ provider: c.provider, metadata: c.metadata })),
        {
          thread,
          parts: segs.map((s) => ({ body: s.body, kinds: s.media.map((m) => m.kind) })),
        },
      ),
    };
  }, [ready, picked, segs, thread]);

  /**
   * Inline gating: a channel the draft can't satisfy renders grey with its
   * reason on tap (instead of a separate panel below). "Unselected" chips
   * judge the CURRENT draft — picking them mid-compose is allowed so the
   * user sees exactly what's missing and fixes it in place.
   */
  const allReady = useMemo(() => {
    const totalMedia = segs.reduce((n, s) => n + s.media.length, 0);
    const hasVideo = segs.some((s) => s.media.some((m) => m.kind === 'video'));
    const hasImage = segs.some((s) => s.media.some((m) => m.kind === 'image'));
    const chainOk = (p: string) => !thread || THREAD_PROVIDERS.includes(p);
    return ready.map((c) => {
      const cap = CAPABILITIES[c.provider as keyof typeof CAPABILITIES];
      const base = { id: c.id, chainOk: chainOk(c.provider), reason: '' as string };
      if (!base.chainOk) return { ...base, blocked: true, reason: 'Thread posts go to X, Threads, Mastodon and Bluesky only' };
      if (!cap) return { ...base, blocked: false, reason: '' };
      if (cap.requiresVideo && !hasVideo) {
        return { ...base, blocked: true, reason: `${cap.label} needs a video — this post has none attached.` };
      }
      if (cap.requiresMedia && totalMedia === 0) {
        return { ...base, blocked: true, reason: `${cap.label} needs a photo or video — text alone can't go there.` };
      }
      if (hasVideo && cap.supports.video === false) {
        return { ...base, blocked: true, reason: `${cap.label} doesn't take video — remove the video or drop the channel.` };
      }
      if (hasImage && cap.supports.image === false) {
        return { ...base, blocked: true, reason: `${cap.label} takes text and links only — remove the image or drop the channel.` };
      }
      return { ...base, blocked: false, reason: '' };
    });
  }, [ready, segs, thread]);

  /** Reasons for chips the user STILL tried to pick (grey + blocked). */
  const [chipNote, setChipNote] = useState<string | null>(null);
  const chipMeta = useMemo(() => new Map(allReady.map((x) => [x.id, x])), [allReady]);

  function toggle(id: string) {
    const info = chipMeta.get(id);
    if (info?.blocked) {
      setChipNote(info.reason || "This channel can't take the current draft.");
      return;
    }
    setChipNote(null);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setThreadMode(v: boolean) {
    setThread(v);
    if (v) {
      // Drop channels that cannot carry a reply-chain, and seed part 2.
      setPicked((prev) => prev.filter((id) => {
        const c = ready.find((x) => x.id === id);
        return c ? THREAD_PROVIDERS.includes(c.provider) : false;
      }));
      setSegs((prev) => {
        const need = Math.max(3, parts);
        const next = [...prev];
        while (next.length < need) next.push({ body: '', media: [] });
        return next.slice(0, need);
      });
    }
  }

  function setPartsCount(n: number) {
    const clamped = Math.max(3, Math.min(12, n));
    setParts(clamped);
    setSegs((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push({ body: '', media: [] });
      return next.slice(0, clamped);
    });
  }

  /* ------------------------- per-segment helpers ------------------------ */

  function addFilesTo(i: number, list: FileList | File[] | null) {
    if (!list) return;
    const next = toMediaItems(Array.from(list));
    setSegs((prev) =>
      prev.map((s, j) => (j === i ? { ...s, media: [...s.media, ...next].slice(0, 10) } : s)),
    );
  }

  function removeMediaFrom(i: number, mi: number) {
    setSegs((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const media = [...s.media];
        const [gone] = media.splice(mi, 1);
        if (gone?.file) URL.revokeObjectURL(gone.url);
        return { ...s, media };
      }),
    );
  }

  function reorderMediaIn(i: number, from: number, to: number) {
    setSegs((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const media = [...s.media];
        const [moved] = media.splice(from, 1);
        if (moved) media.splice(to, 0, moved);
        return { ...s, media };
      }),
    );
  }

  /* ------------------------------- submit ------------------------------- */

  async function submit(e: FormEvent | null, submitMode: ComposeMode) {
    e?.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr('Pick at least one channel.');
      return;
    }
    if (submitMode === 'schedule' && !whenIso) {
      setErr('Choose a date and time first.');
      return;
    }
    if (submitMode === 'schedule' && whenIso && queueTooSoon(whenIso)) {
      setErr(leadTimeMessage());
      return;
    }
    const live = segs.filter((s) => s.body.trim() || s.media.length > 0);
    if (live.length === 0) {
      setErr('Add a caption or some media first.');
      return;
    }
    // Media channels refuse text-only posts (only file-backed media uploads).
    const uploadable = (segs[0]?.media ?? []).filter((m) => Boolean(m.file));
    const blocked = mediaBlock(
      chosen.map((c) => c.provider),
      uploadable,
    );
    if (blocked) {
      setErr(blocked.message);
      return;
    }
    // Capability gate: per-channel blockers (limits, media, threads,
    // destinations). Drafts save freely — the panel still shows the issues.
    if (submitMode !== 'draft') {
      const blockers = compat.issues.filter((i) => i.level === 'error');
      if (blockers.length) {
        setErr(blockers.map((i) => i.message).join('\n'));
        return;
      }
    }
    // Post-now always confirms with the destination list after validating.
    if (submitMode === 'now' && !nowConfirmed.current) {
      setConfirmNow(true);
      return;
    }
    nowConfirmed.current = false;
    setBusy(true);
    try {
      const sb = createClient();
      if (!thread) {
        const s0 = segs[0];
        await createPost(sb, {
          workspaceId,
          userId,
          role,
          title: s0.body.trim().split('\n')[0].slice(0, 60),
          body: s0.body.trim(),
          mode: submitMode,
          scheduleIso: submitMode === 'schedule' ? whenIso : null,
          channels: chosen,
          files: s0.media
            .filter((m): m is MediaItem & { file: File } => Boolean(m.file))
            .map(({ file, kind }) => ({ file, kind })),
          timezone: tz,
        });
      } else {
        await createChain(sb, {
          workspaceId,
          userId,
          role,
          segments: live.map((s) => ({
            body: s.body.trim(),
            files: s.media
              .filter((m): m is MediaItem & { file: File } => Boolean(m.file))
              .map(({ file, kind }) => ({ file, kind })),
          })),
          mode: submitMode,
          startIso: submitMode === 'schedule' ? whenIso : null,
          gapMinutes: 0,
          channels: chosen,
        });
      }
      // Draft edit: the replacement saved — retire the original rows, then
      // hand back to a fresh composer.
      if (editingIds?.length) {
        await Promise.allSettled(editingIds.map((id) => deletePost(sb, id)));
        onEdited?.();
      }
      router.push('/queue');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save the post.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(e, mode)}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Left: composer */}
        <div className="min-w-0 xl:col-span-3">
          <section className="card p-5" aria-label="Create your post">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-extrabold tracking-tight">Create your post</p>
              {editingIds?.length ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-ink">
                  Editing draft{mediaLoading ? ' · loading media…' : ''}
                </span>
              ) : null}
              <span className="flex-1" />
              {/* Mode pill — top, dashboard style */}
              <div className="flex rounded-full border border-line bg-paper p-1" role="group" aria-label="Post mode">
                {(['now', 'schedule'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (m === 'schedule' && (!whenIso || queueTooSoon(whenIso))) {
                        setWhenIso(new Date(minQueueTime()).toISOString());
                      }
                      setMode(m);
                    }}
                    aria-pressed={mode === m}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      mode === m ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {m === 'now' ? 'Post now' : 'Schedule'}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule row — top, next to the title */}
            {mode === 'schedule' ? (
              <div className="mt-3">
                <DateTimePicker
                  value={whenIso}
                  timezone={tz}
                  onChange={setWhenIso}
                  onTimezoneChange={setTz}
                />
              </div>
            ) : null}

            {/* Channel pills — dashboard style; thread narrows the cast */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Channels">
              {ready.length === 0 ? (
                <p className="text-xs text-muted">
                  Nothing connected.{' '}
                  <Link href="/channels" className="font-bold text-ink hover:underline">
                    Connect a channel
                  </Link>
                </p>
              ) : (
                ready.map((c) => {
                  const info = chipMeta.get(c.id);
                  const blocked = !!info?.blocked;
                  const on = picked.includes(c.id) && !blocked;
                  const label = providerMeta(c.provider).label;
                  const rawHandle =
                    typeof c.handle === 'string' && c.handle.trim()
                      ? c.handle.trim().replace(/^@/, '')
                      : null;
                  const sub =
                    rawHandle ??
                    (c.display_name && c.display_name !== label ? c.display_name : null);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      title={blocked ? info?.reason : (c.display_name ?? label)}
                      className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-xs font-bold transition ${
                        blocked
                          ? 'cursor-not-allowed border-line bg-bone text-faint opacity-50'
                          : on
                            ? 'border-ink bg-paper text-ink'
                            : 'border-line bg-paper text-faint opacity-60 hover:opacity-100'
                      }`}
                    >
                      <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={30} />
                      <span className="min-w-0 leading-tight">
                        <span className="block">{label}</span>
                        {sub ? (
                          <span className="block truncate text-[10px] font-semibold text-muted">
                            {rawHandle ? `@${rawHandle}` : sub}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {thread ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
                <BranchIcon className="h-3 w-3" />
                Thread posts go to X, Threads, Mastodon and Bluesky — parts publish as one reply chain.
              </p>
            ) : null}

            {/* Part 1 — same box as every other part */}
            <div className="mt-3">
              <PostBox
                seg={segs[0] ?? { body: '', media: [] }}
                onChange={(body) => setSegs((prev) => prev.map((s, j) => (j === 0 ? { ...s, body } : s)))}
                onAddFiles={(list) => addFilesTo(0, list)}
                onRemoveMedia={(mi) => removeMediaFrom(0, mi)}
                onReorderMedia={(from, to) => reorderMediaIn(0, from, to)}
                placeholder="What's on your mind?"
                limit={limit}
                label="Post text"
              />
            </div>

            {/* Thread parts */}
            {thread ? (
              <div className="mt-2 space-y-2">
                {segs.slice(1).map((s, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-faint">
                          <BranchIcon className="h-3 w-3" />
                          Part {idx + 1}
                        </span>
                        <span className="flex-1" />
                        {segs.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => setSegs((prev) => prev.filter((_, j) => j !== idx))}
                            aria-label={`Remove part ${idx + 1}`}
                            className="text-[11px] font-bold text-muted transition hover:text-ink"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <PostBox
                        seg={s}
                        onChange={(body) => setSegs((prev) => prev.map((x, j) => (j === idx ? { ...x, body } : x)))}
                        onAddFiles={(list) => addFilesTo(idx, list)}
                        onRemoveMedia={(mi) => removeMediaFrom(idx, mi)}
                        onReorderMedia={(from, to) => reorderMediaIn(idx, from, to)}
                        placeholder={`Part ${idx + 1}…`}
                        rows={3}
                        limit={limit}
                        label={`Thread part ${idx + 1}`}
                      />
                    </div>
                  );
                })}
                {segs.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => setSegs((prev) => [...prev, { body: '', media: [] }])}
                    className="text-xs font-bold text-ink hover:underline"
                  >
                    + Add part
                  </button>
                ) : null}
              </div>
            ) : null}

            {err ? <p className="mt-3 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

            {chipNote ? (
              <p className="mt-3 rounded-xl bg-[#FDF6E7] px-3 py-2 text-xs font-bold text-amber-700">
                {chipNote}
              </p>
            ) : null}

            {confirmNow ? (
              <div
                className="fixed inset-0 z-[100] overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-label="Confirm post now"
              >
                <div
                  className="absolute inset-0 bg-ink/50"
                  onClick={() => {
                    nowConfirmed.current = false;
                    setConfirmNow(false);
                  }}
                  aria-hidden="true"
                />
                <div className="relative flex min-h-full items-center justify-center p-4">
                  <div className="relative my-auto w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]">
                    <h2 className="font-display text-lg font-extrabold tracking-tight">
                      Post now to {ready.filter((c) => picked.includes(c.id)).length} channel
                      {picked.length === 1 ? '' : 's'}?
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {ready
                        .filter((c) => picked.includes(c.id))
                        .map((c) => {
                          const label = providerMeta(c.provider).label;
                          const rawHandle =
                            typeof c.handle === 'string' && c.handle.trim()
                              ? c.handle.trim().replace(/^@/, '')
                              : null;
                          const sub =
                            rawHandle ??
                            (c.display_name && c.display_name !== label ? c.display_name : null);
                          return (
                            <li key={c.id} className="flex items-center gap-2.5">
                              <ChannelAvatar
                                provider={c.provider}
                                avatar={channelAvatar(c.metadata)}
                                size={30}
                              />
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block truncate text-sm font-bold">{label}</span>
                                {sub ? (
                                  <span className="block truncate text-xs text-muted">
                                    {rawHandle ? `@${rawHandle}` : sub}
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                    {(() => {
                      const snippet =
                        segs.find((s) => s.body.trim())?.body.trim().replace(/\s+/g, ' ') ?? '';
                      const parts = segs.filter((s) => s.body.trim() || s.media.length > 0).length;
                      if (!snippet) return null;
                      return (
                        <p className="mt-3 rounded-xl bg-paper-dim px-3 py-2 text-xs text-soft">
                          “{snippet.slice(0, 140)}
                          {snippet.length > 140 ? '…' : ''}”
                          {thread && parts > 1 ? ` (+${parts - 1} more parts)` : ''}
                        </p>
                      );
                    })()}
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          nowConfirmed.current = false;
                          setConfirmNow(false);
                        }}
                        className="btn btn-ghost flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          nowConfirmed.current = true;
                          setConfirmNow(false);
                          void submit(null, 'now');
                        }}
                        className="btn btn-primary flex-1"
                      >
                        Post now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* One row: thread link · save draft · post — aligned */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setThreadMode(!thread)}
                aria-pressed={thread}
                className="flex items-center gap-1.5 text-xs font-bold text-accent-ink transition hover:opacity-80"
              >
                <BranchIcon />
                {thread ? 'Turn off thread' : 'Post as thread'}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={(e) => submit(e, 'draft')}
                disabled={busy}
                className="text-xs font-bold text-muted transition hover:text-ink disabled:opacity-50"
              >
                Save draft
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary !py-1.5 !text-xs">
                {busy ? (
                  'Sending…'
                ) : (
                  <>
                    <SendIcon className="h-3.5 w-3.5" />
                    {mode === 'now' ? 'Post now' : 'Schedule post'}
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Right rail: Template / Preview / AI switch */}
        <div className="min-w-0 xl:col-span-2">
          <RailPanel
            tab={rail}
            onTab={setRail}
            tplKind={tplKind}
            onTplKind={setTplKind}
            captions={libraryCaptions}
            designs={libraryDesigns}
            starterDesigns={libraryStarterDesigns}
            onUseCaption={useRailCaption}
            onUseDesign={useRailDesign}
            designBusy={designBusy}
            channels={ready}
            picked={picked}
            segs={segs}
            ai={
              <AiCard
                providers={chosenProviders}
                thread={thread}
                onThreadChange={setThreadMode}
                parts={parts}
                onPartsChange={setPartsCount}
                onResult={(bodies) => {
                  setSegs((prev) => {
                    const next = bodies.map((b) => ({ body: b, media: [] as MediaItem[] }));
                    if (next[0]) next[0].media = prev[0]?.media ?? [];
                    return next;
                  });
                }}
                appliedNote="Applied to the composer — edit freely, then post."
              />
            }
          />
        </div>
      </div>
    </form>
  );
}
