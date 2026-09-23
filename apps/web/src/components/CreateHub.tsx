'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AiCard from '@/components/AiCard';
import CreatePost from '@/components/CreatePost';
import { EmojiInput, EmojiTextarea } from '@/components/Emoji';
import PostBox, { type MediaItem, type Segment } from '@/components/PostBox';
import StudioEditor from '@/components/studio/StudioEditor';
import StudioCanvas from '@/components/studio/StudioCanvas';
import { exportCanvasPng } from '@/lib/studio/exportPng';
import {
  POST_SIZES,
  blankPage,
  blankProject,
  uid,
  type StudioProject,
} from '@/lib/studio/model';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

interface IdeaMedia {
  url: string;
  kind: 'image' | 'video';
}

interface Idea {
  id: string;
  title: string;
  /** Part 1 body. */
  body: string;
  /** Extra thread parts when the idea was captured as a thread. */
  thread?: string[];
  /** Media per part (index 0 = part 1), persisted as data URLs. */
  media?: IdeaMedia[][];
  createdAt: number;
}

interface Template {
  id: string;
  name: string;
  title: string;
  body: string;
  createdAt: number;
  builtIn?: boolean;
}

type Tab = 'post' | 'ideas' | 'templates';

const ideasKey = (workspaceId: string) => `sosial-ideas-${workspaceId}`;
const templatesKey = (workspaceId: string) => `sosial-templates-${workspaceId}`;
const projectsKey = (workspaceId: string) => `sosial-studio-v2-${workspaceId}`;
const recentKey = (workspaceId: string) => `sosial-studio-recent-${workspaceId}`;

/** Starter studio projects — real multi-block designs, not mockups. */
function starterProjects(): StudioProject[] {
  const launch = blankProject('Launch card');
  launch.sizeId = 'portrait';
  launch.pages = [
    {
      ...blankPage(),
      background: { ...blankPage().background, type: 'dots', color: '#111111', patternColor: '#FFE45E', patternSize: 26, patternOpacity: 0.5, mixEnabled: false },
      title: { text: 'It’s live.', position: 'top', color: '#FFFFFF', size: 40, align: 'left', font: 'jakarta', bold: true, italic: false, subtitle: 'Everything you asked for, in one place.', subtitleSize: 15, subtitleColor: '#F5F1E8' },
      blocks: [
        { id: uid('b'), type: 'bullets', heading: 'What’s new', items: ['Faster than ever', 'Works everywhere', 'Free to try'], textColor: '#111111' },
      ],
      cardColor: '#FFFFFFF2',
      socials: [{ id: uid('s'), platform: 'instagram', handle: '@yourhandle', visible: true, font: 'jakarta', bold: true, italic: false }],
      caption: 'Big news, it’s live! #launch #newdrop',
    },
  ];
  const quote = blankProject('Quote card');
  quote.sizeId = 'square';
  quote.pages = [
    {
      ...blankPage(),
      background: { ...blankPage().background, type: 'solid', color: '#F5F1E8', patternColor: '#111111', patternSize: 22, patternOpacity: 0.12, mixEnabled: false },
      title: { text: '“Show up every day.”', position: 'top', color: '#111111', size: 36, align: 'center', font: 'playfair', bold: true, italic: false, subtitle: 'Consistency beats intensity.', subtitleSize: 15, subtitleColor: '#57534E' },
      blocks: [],
      pfp: { ...blankPage().pfp, hidden: true },
      socials: [],
      cardColor: '#FFFFFFF2',
    },
  ];
  const promo = blankProject('Promo card');
  promo.sizeId = 'story';
  promo.pages = [
    {
      ...blankPage(),
      background: { ...blankPage().background, type: 'stripes', color: '#7C2D12', patternColor: '#F97316', patternSize: 30, patternOpacity: 0.5, mixEnabled: false },
      title: { text: '20% off ends Sunday', position: 'top', color: '#FFFFFF', size: 38, align: 'left', font: 'jakarta', bold: true, italic: false, subtitle: '', subtitleSize: 15 },
      blocks: [
        { id: uid('b'), type: 'table', heading: 'Plans', items: [], table: [['Plan', 'Monthly', 'Yearly'], ['Starter', '$9', '$90'], ['Pro', '$19', '$190']], textColor: '#111111' },
      ],
      cardColor: '#FFFFFFF2',
      socials: [{ id: uid('s'), platform: 'tiktok', handle: '@yourhandle', visible: true, font: 'jakarta', bold: true, italic: false }],
      caption: 'One weekend only. #sale #promo',
    },
  ];
  return [launch, quote, promo];
}

/** Starter caption templates — one tap into the composer. */
const STARTERS: Template[] = [
  {
    id: 'starter-launch',
    name: 'Product launch',
    title: 'We just launched something new',
    body: 'Big news, it’s live! Here’s what’s new and why you’ll love it.\n\n#launch #newdrop',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-promo',
    name: 'Sale / promo',
    title: 'Sale is on. Don’t miss out',
    body: 'For a limited time: get 20% off everything. Tap the link to shop before it ends.\n\n#sale #promo',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-bts',
    name: 'Behind the scenes',
    title: 'A peek behind the curtain',
    body: 'Here’s what we’ve been working on this week: the messy middle nobody usually sees.\n\n#behindthescenes #buildinpublic',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-event',
    name: 'Event reminder',
    title: 'Reminder: we go live soon',
    body: 'Don’t forget: we’re live this Friday at 6pm. Set a reminder and bring your questions.\n\n#live #event',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-quote',
    name: 'Quote card',
    title: 'Quote of the week',
    body: '“Show up every day. The algorithm rewards consistency.”\n\n#motivation #quote',
    createdAt: 0,
    builtIn: true,
  },
];

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as T[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const fmtDate = (ts: number): string => {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

const TAB_LABEL: Record<Tab, string> = { post: 'Post', ideas: 'Ideas', templates: 'Templates' };

function useBoxWidth(fallback = 300): { ref: React.RefObject<HTMLDivElement | null>; width: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(120, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function ratioOf(project: StudioProject): number {
  return POST_SIZES.find((s) => s.id === project.sizeId)?.ratio ?? 1.25;
}

/**
 * Mobile-style Post hub: quick Post composer, Templates studio, Publish
 * (queue), Ideas inbox. Tab order mirrors the mobile Create screen.
 */
export default function CreateHub({
  channels,
  workspaceId,
  userId,
  role,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('post');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [recent, setRecent] = useState<{ project: StudioProject; pageIndex: number; at: number }[]>([]);
  const [editing, setEditing] = useState<StudioProject | null>(null);
  const [title, setTitle] = useState('');
  const [ideaSegs, setIdeaSegs] = useState<Segment[]>([{ body: '', media: [] }]);
  const [ideaThread, setIdeaThread] = useState(false);
  const [ideaParts, setIdeaParts] = useState(3);
  const [tplName, setTplName] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [prefill, setPrefill] = useState<{
    title: string;
    body: string;
    key: number;
    thread?: boolean;
    parts?: string[];
  } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [renderingKey, setRenderingKey] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    setIdeas(readList<Idea>(ideasKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt));
    setTemplates(
      readList<Template>(templatesKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt),
    );
    setProjects(
      readList<StudioProject>(projectsKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt),
    );
    setRecent(readList<{ project: StudioProject; pageIndex: number; at: number }>(recentKey(workspaceId)).slice(0, 12));
  }, [workspaceId]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'post' || t === 'ideas' || t === 'templates') setTab(t);
  }, [searchParams]);

  const persistIdeas = (next: Idea[]) => {
    setIdeas(next);
    try {
      localStorage.setItem(ideasKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode — ideas just won't persist */
    }
  };

  const persistTemplates = (next: Template[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(templatesKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode — templates just won't persist */
    }
  };

  const persistProjects = (next: StudioProject[]) => {
    setProjects(next);
    try {
      localStorage.setItem(projectsKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode / quota — designs just won't persist */
    }
  };

  const persistRecent = (next: { project: StudioProject; pageIndex: number; at: number }[]) => {
    setRecent(next);
    try {
      localStorage.setItem(recentKey(workspaceId), JSON.stringify(next.slice(0, 12)));
    } catch {
      /* private mode */
    }
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  /* ----------------------- idea editor helpers ----------------------- */

  function setIdeaThreadMode(v: boolean) {
    setIdeaThread(v);
    setIdeaSegs((prev) => {
      if (!v) return prev.slice(0, 1);
      const next = [...prev];
      while (next.length < 2) next.push({ body: '', media: [] });
      return next;
    });
  }

  function addFilesToIdea(i: number, list: FileList | null) {
    if (!list) return;
    const next: MediaItem[] = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    }));
    setIdeaSegs((prev) =>
      prev.map((s, j) => (j === i ? { ...s, media: [...s.media, ...next].slice(0, 10) } : s)),
    );
  }

  function removeMediaFromIdea(i: number, mi: number) {
    setIdeaSegs((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const media = [...s.media];
        const [gone] = media.splice(mi, 1);
        if (gone?.file) URL.revokeObjectURL(gone.url);
        return { ...s, media };
      }),
    );
  }

  function reorderMediaInIdea(i: number, from: number, to: number) {
    setIdeaSegs((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const media = [...s.media];
        const [moved] = media.splice(from, 1);
        if (moved) media.splice(to, 0, moved);
        return { ...s, media };
      }),
    );
  }

  const saveIdea = async () => {
    const p1 = ideaSegs[0];
    const hasText = title.trim() || ideaSegs.some((s) => s.body.trim());
    if (!hasText) return;
    const media = await Promise.all(
      ideaSegs.map((s) =>
        Promise.all(
          s.media.map(async (m) => ({
            url: m.file ? await fileToDataUrl(m.file).catch(() => m.url) : m.url,
            kind: m.kind,
          })),
        ),
      ),
    );
    const idea: Idea = {
      id: `idea_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || p1.body.split('\n')[0].slice(0, 60) || 'Untitled idea',
      body: p1.body,
      thread: ideaThread && ideaSegs.length > 1 ? ideaSegs.slice(1).map((s) => s.body) : undefined,
      media: media.some((m) => m.length) ? media : undefined,
      createdAt: Date.now(),
    };
    const next = [idea, ...ideas];
    setIdeas(next);
    try {
      localStorage.setItem(ideasKey(workspaceId), JSON.stringify(next));
    } catch {
      // Quota — retry without media so the text always survives.
      try {
        const slim = next.map((i) => ({ ...i, media: undefined }));
        localStorage.setItem(ideasKey(workspaceId), JSON.stringify(slim));
        setIdeas(slim as Idea[]);
      } catch {
        /* private mode — ideas just won't persist */
      }
    }
    setTitle('');
    setIdeaSegs([{ body: '', media: [] }]);
    setIdeaThread(false);
  };

  const saveTemplate = () => {
    if (!tplName.trim() || (!tplTitle.trim() && !tplBody.trim())) return;
    const tpl: Template = {
      id: `tpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: tplName.trim(),
      title: tplTitle.trim(),
      body: tplBody,
      createdAt: Date.now(),
    };
    persistTemplates([tpl, ...templates]);
    setTplName('');
    setTplTitle('');
    setTplBody('');
  };

  const useIntoComposer = (t: { title: string; body: string }) => {
    setPrefill({ title: t.title, body: t.body, key: Date.now() });
    setTab('post');
  };

  /** Export a studio page PNG and attach it to the composer. */
  const useStudioPage = async (
    project: StudioProject,
    pageIndex: number,
    node: HTMLElement | null,
    key: string,
  ) => {
    if (!node) return;
    setRenderingKey(key);
    try {
      const blob = await exportCanvasPng(node, 1080);
      const page = project.pages[pageIndex] ?? project.pages[0];
      const file = new File([blob], `${project.name || 'design'}-p${pageIndex + 1}.png`, { type: 'image/png' });
      setPendingFiles([file]);
      setPrefill({ title: page?.title.text || project.name, body: page?.caption ?? '', key: Date.now() });
      setEditing(null);
      setTab('post');
      persistRecent(
        [{ project, pageIndex, at: Date.now() }, ...recent.filter((r) => !(r.project.id === project.id && r.pageIndex === pageIndex))].slice(0, 12),
      );
    } catch {
      /* export toast lives here if this ever needs one */
    } finally {
      setRenderingKey(null);
    }
  };
  const saveEditing = (p: StudioProject) => {
    persistProjects(
      projects.some((x) => x.id === p.id)
        ? projects.map((x) => (x.id === p.id ? p : x))
        : [{ ...p, createdAt: Date.now() }, ...projects],
    );
  };

  const renameProject = () => {
    if (!renaming) return;
    const v = renaming.value.trim();
    if (v) persistProjects(projects.map((d) => (d.id === renaming.id ? { ...d, name: v } : d)));
    setRenaming(null);
  };

  /** Post this idea: prefill the composer, thread parts and media included. */
  const postIdea = async (idea: Idea) => {
    const files: File[] = [];
    for (const m of idea.media?.[0] ?? []) {
      try {
        const blob = await (await fetch(m.url)).blob();
        files.push(
          new File([blob], `idea.${m.kind === 'video' ? 'mp4' : 'png'}`, {
            type: m.kind === 'video' ? 'video/mp4' : 'image/png',
          }),
        );
      } catch {
        /* media no longer readable — post without it */
      }
    }
    const parts = [idea.body, ...(idea.thread ?? [])];
    setPendingFiles(files.length ? files : null);
    setPrefill({
      title: idea.title,
      body: idea.body,
      key: Date.now(),
      thread: (idea.thread?.length ?? 0) > 0,
      parts: parts.length > 1 ? parts : undefined,
    });
    setTab('post');
  };

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Post</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">New post</h1>
      <p className="mt-1 text-sm text-muted">Catch the idea, design the visual, then post it everywhere.</p>

      <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Post sections">
        {(['post', 'templates'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              tab === t ? 'border-accent bg-accent text-ink' : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
        <Link
          href="/queue"
          className="rounded-full border border-line bg-card px-4 py-2 text-xs font-bold text-muted transition hover:bg-paper"
        >
          Publish
        </Link>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ideas'}
          onClick={() => setTab('ideas')}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            tab === 'ideas' ? 'border-accent bg-accent text-ink' : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          {TAB_LABEL.ideas}
          {ideas.length ? ` · ${ideas.length}` : ''}
        </button>
      </div>

      {tab === 'post' ? (
        <div className="mt-4">
          <CreatePost
            key={`${prefill?.key ?? 'fresh'}-${pendingFiles ? pendingFiles.length : 0}`}
            channels={channels}
            workspaceId={workspaceId}
            userId={userId}
            role={role}
            initialTitle={prefill?.title ?? ''}
            initialBody={prefill?.body ?? ''}
            initialFiles={pendingFiles ?? undefined}
            initialThread={prefill?.thread}
            initialParts={prefill?.parts}
          />
        </div>
      ) : tab === 'ideas' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
            <div className="card space-y-3 p-4 sm:p-5">
              <p className="eyebrow">Jot it down</p>
              <EmojiInput
                value={title}
                onChange={setTitle}
                placeholder="Idea title…"
                className="field font-display font-bold"
                aria-label="Idea title"
              />
              <PostBox
                seg={ideaSegs[0] ?? { body: '', media: [] }}
                onChange={(v) => setIdeaSegs((prev) => prev.map((s, j) => (j === 0 ? { ...s, body: v } : s)))}
                onAddFiles={(list) => addFilesToIdea(0, list)}
                onRemoveMedia={(mi) => removeMediaFromIdea(0, mi)}
                onReorderMedia={(from, to) => reorderMediaInIdea(0, from, to)}
                placeholder="Describe the idea…"
                rows={4}
                limit={2200}
                label="Idea body"
              />
              {ideaThread ? (
                <div className="space-y-2">
                  {ideaSegs.slice(1).map((s, i) => {
                    const idx = i + 1;
                    return (
                      <div key={idx}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[11px] font-bold text-faint">Part {idx + 1}</span>
                          <span className="flex-1" />
                          <button
                            type="button"
                            onClick={() => setIdeaSegs((prev) => prev.filter((_, j) => j !== idx))}
                            aria-label={`Remove part ${idx + 1}`}
                            className="text-[11px] font-bold text-muted transition hover:text-ink"
                          >
                            Remove
                          </button>
                        </div>
                        <PostBox
                          seg={s}
                          onChange={(v) => setIdeaSegs((prev) => prev.map((x, j) => (j === idx ? { ...x, body: v } : x)))}
                          onAddFiles={(list) => addFilesToIdea(idx, list)}
                          onRemoveMedia={(mi) => removeMediaFromIdea(idx, mi)}
                          onReorderMedia={(from, to) => reorderMediaInIdea(idx, from, to)}
                          placeholder={`Part ${idx + 1}…`}
                          rows={3}
                          limit={2200}
                          label={`Idea thread part ${idx + 1}`}
                        />
                      </div>
                    );
                  })}
                  {ideaSegs.length < 8 ? (
                    <button
                      type="button"
                      onClick={() => setIdeaSegs((prev) => [...prev, { body: '', media: [] }])}
                      className="text-xs font-bold text-ink hover:underline"
                    >
                      + Add part
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIdeaThreadMode(!ideaThread)}
                  aria-pressed={ideaThread}
                  className="flex items-center gap-1.5 text-xs font-bold text-accent-ink transition hover:opacity-80"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                  {ideaThread ? 'Turn off thread' : 'Post as thread'}
                </button>
                <span className="flex-1" />
                <button type="button" onClick={() => void saveIdea()} className="btn btn-primary !py-1.5 !text-xs">
                  Save idea
                </button>
              </div>
            </div>

            {ideas.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="font-display text-base font-extrabold">No ideas yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                  Jot one above. Posting it later takes one tap.
                </p>
              </div>
            ) : (
              ideas.map((idea) => {
                const cover = idea.media?.[0]?.[0];
                const isThreadIdea = (idea.thread?.length ?? 0) > 0;
                return (
                  <article key={idea.id} className="card p-4 sm:p-5">
                    <div className="flex gap-3">
                      {cover ? (
                        <span className="block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-paper-dim">
                          {cover.kind === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cover.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <video src={cover.url} muted playsInline className="h-full w-full object-cover" />
                          )}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <p className="truncate font-display font-extrabold">{idea.title}</p>
                        {idea.body ? <p className="mt-1 line-clamp-2 text-sm text-soft">{idea.body}</p> : null}
                        <p className="mt-1 text-xs text-faint">
                          {fmtDate(idea.createdAt)}
                          {isThreadIdea ? ` · ${(idea.thread?.length ?? 0) + 1}-post thread` : ''}
                        </p>
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => void postIdea(idea)} className="btn btn-primary">
                        Post this idea
                      </button>
                      <button
                        type="button"
                        onClick={() => persistIdeas(ideas.filter((x) => x.id !== idea.id))}
                        className="btn btn-ghost"
                        aria-label={`Delete ${idea.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="min-w-0 xl:col-span-2" id="ai-card">
            <AiCard
              providers={channels.filter((c) => c.status === 'connected').map((c) => c.provider)}
              thread={ideaThread}
              onThreadChange={setIdeaThreadMode}
              parts={ideaParts}
              onPartsChange={(n) => {
                const clamped = Math.max(2, Math.min(8, n));
                setIdeaParts(clamped);
                setIdeaSegs((prev) => {
                  const next = [...prev];
                  while (next.length < clamped) next.push({ body: '', media: [] });
                  return next.slice(0, clamped);
                });
              }}
              onResult={(bodies) => {
                setIdeaSegs((prev) => {
                  const next = bodies.map((b) => ({ body: b, media: [] as MediaItem[] }));
                  if (next[0]) next[0].media = prev[0]?.media ?? [];
                  return next;
                });
                if (bodies.length > 1) setIdeaThread(true);
              }}
              appliedNote="Applied to your idea — edit freely, then save."
            />
          </div>
        </div>
      ) : editing ? (
        <div className="mt-4">
          <StudioEditor
            key={editing.id}
            initial={editing}
            onSave={(p) => {
              saveEditing(p);
              setEditing(p);
            }}
            onUsePng={(blobs, t, caption) => {
              const files = blobs.map(
                (b, i) => new File([b], `${editing.name || 'design'}-p${i + 1}.png`, { type: 'image/png' }),
              );
              setPendingFiles(files);
              setPrefill({ title: t, body: caption, key: Date.now() });
              persistRecent(
                [{ project: editing, pageIndex: 0, at: Date.now() }, ...recent.filter((r) => r.project.id !== editing.id)].slice(0, 12),
              );
              setEditing(null);
              setTab('post');
            }}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {/* Mobile-parity CTA — the editor opens beneath it (mobile opens a screen). */}
          <button
            type="button"
            onClick={() => setEditing(blankProject('Untitled design'))}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-4 font-display text-sm font-extrabold text-paper transition hover:opacity-90"
          >
            + New template design
          </button>

          {/* Starter templates — horizontal rail of live canvas miniatures. */}
          <p className="eyebrow pt-1">Starter templates</p>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {starterProjects().map((s) => (
              <StarterTile
                key={s.id}
                project={s}
                busy={renderingKey === s.id}
                onOpen={() => setEditing(structuredClone(s))}
                onUse={(node) => useStudioPage(s, 0, node, s.id)}
              />
            ))}
          </div>

          {/* Your templates — two-column masonry with ••• menus. */}
          {projects.length > 0 ? (
            <>
              <p className="eyebrow pt-1">Your templates</p>
              <div className="columns-2 gap-3 xl:columns-3">
                {projects.map((d) => (
                  <div key={d.id} className="mb-3 break-inside-avoid">
                    <ProjectTile
                      project={d}
                      pageIndex={0}
                      busy={renderingKey === d.id}
                      onOpen={() => setEditing(structuredClone(d))}
                      onUse={(node) => useStudioPage(d, 0, node, d.id)}
                      onMenu={() => setMenuFor(menuFor === d.id ? null : d.id)}
                      menuOpen={menuFor === d.id}
                      onRename={() => {
                        setRenaming({ id: d.id, value: d.name });
                        setMenuFor(null);
                      }}
                      onDuplicate={() => {
                        persistProjects([{ ...structuredClone(d), id: `design_${Date.now().toString(36)}`, name: `${d.name} copy`, createdAt: Date.now() }, ...projects]);
                        setMenuFor(null);
                      }}
                      onDelete={() => {
                        persistProjects(projects.filter((x) => x.id !== d.id));
                        setMenuFor(null);
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* Recent — designs used lately, most recent first. */}
          {recent.length > 0 ? (
            <>
              <p className="eyebrow pt-1">Recent</p>
              <div className="columns-2 gap-3 xl:columns-3">
                {recent.map((r, i) => (
                  <div key={`${r.project.id}-${r.pageIndex}-${i}`} className="mb-3 break-inside-avoid">
                    <ProjectTile
                      project={r.project}
                      pageIndex={r.pageIndex}
                      busy={false}
                      onOpen={() => setEditing(structuredClone(r.project))}
                      onUse={(node) => useStudioPage(r.project, r.pageIndex, node, `${r.project.id}:${r.pageIndex}`)}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* Caption starters — collapsed, secondary to the canvas library. */}
          <details className="card p-4 sm:p-5">
            <summary className="cursor-pointer list-none font-display text-sm font-extrabold [&::-webkit-details-marker]:hidden">
              Caption starters <span aria-hidden="true" className="text-faint">·</span>{' '}
              <span className="text-xs font-medium text-muted">tap to browse</span>
            </summary>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {STARTERS.map((s) => (
                  <article key={s.id} className="rounded-2xl border border-line bg-paper p-3.5">
                    <p className="truncate text-sm font-bold">{s.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-soft">{s.body}</p>
                    <button type="button" onClick={() => useIntoComposer(s)} className="btn btn-ghost mt-2.5 w-full !py-1.5 !text-xs">
                      Use caption
                    </button>
                  </article>
                ))}
              </div>
              <div className="space-y-2 rounded-2xl border border-line bg-paper p-3.5">
                <p className="eyebrow">Save your own</p>
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Template name… e.g. Friday promo"
                  className="field font-display font-bold"
                  aria-label="Template name"
                />
                <EmojiInput
                  value={tplTitle}
                  onChange={setTplTitle}
                  placeholder="Post title…"
                  className="field"
                  aria-label="Template post title"
                />
                <EmojiTextarea
                  value={tplBody}
                  onChange={setTplBody}
                  placeholder="Caption…"
                  rows={3}
                  className="field min-h-[72px] resize-y"
                  aria-label="Template caption"
                />
                <button type="button" onClick={saveTemplate} className="btn btn-primary w-full sm:w-auto">
                  Save template
                </button>
              </div>
              {templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{t.name}</p>
                        {t.body ? <p className="truncate text-xs text-muted">{t.body}</p> : null}
                      </div>
                      <button type="button" onClick={() => useIntoComposer(t)} className="btn btn-ghost shrink-0 !px-3 !py-1.5 !text-xs">
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => persistTemplates(templates.filter((x) => x.id !== t.id))}
                        className="btn btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
                        aria-label={`Delete ${t.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>

          {/* Rename dialog — mobile parity. */}
          {renaming ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setRenaming(null)} className="absolute inset-0 cursor-default bg-black/40" />
              <div className="card relative w-full max-w-xs p-5">
                <p className="font-display text-base font-extrabold">Rename</p>
                <input
                  value={renaming.value}
                  onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameProject();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  autoFocus
                  className="field mt-3"
                  aria-label="Template name"
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={renameProject} className="btn btn-primary flex-1">
                    Save
                  </button>
                  <button type="button" onClick={() => setRenaming(null)} className="btn btn-ghost">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Starter rail tile — fixed width, live miniature. Tap to open it in the canvas editor. */
function StarterTile({
  project,
  busy,
  onOpen,
  onUse,
}: {
  project: StudioProject;
  busy: boolean;
  onOpen: () => void;
  onUse: (node: HTMLElement | null) => void;
}) {
  const { ref, width } = useBoxWidth(190);
  const nodeRef = useRef<HTMLDivElement>(null);
  const page = project.pages[0];
  if (!page) return null;
  return (
    <article className="w-[190px] shrink-0 snap-start">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Edit ${project.name}`}>
        <div ref={nodeRef} className="relative">
          <div ref={ref}>
            <StudioCanvas page={page} ratio={ratioOf(project)} width={width} frame={false} />
          </div>
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-white">
            STARTER
          </span>
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/35 text-xs font-bold text-white">
              Rendering…
            </span>
          ) : null}
        </div>
      </button>
      <div className="mt-2 flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{project.name}</p>
          <p className="truncate text-xs text-muted">Template · {project.pages.length} page{project.pages.length === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          onClick={() => onUse(nodeRef.current)}
          disabled={busy}
          className="btn btn-primary shrink-0 !px-3 !py-1.5 !text-xs"
          aria-label={`Use ${project.name} in a post`}
        >
          {busy ? '…' : 'Use'}
        </button>
      </div>
    </article>
  );
}

/** Gallery tile: live miniature + name/meta + ••• menu (mobile parity). */
function ProjectTile({
  project,
  pageIndex,
  busy,
  onOpen,
  onUse,
  onMenu,
  menuOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: StudioProject;
  pageIndex: number;
  busy: boolean;
  onOpen: () => void;
  onUse: (node: HTMLElement | null) => void;
  onMenu?: () => void;
  menuOpen?: boolean;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const { ref, width } = useBoxWidth(300);
  const nodeRef = useRef<HTMLDivElement>(null);
  const page = project.pages[pageIndex] ?? project.pages[0];
  if (!page) return null;
  return (
    <article className="relative">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${project.name}`}>
        <div ref={nodeRef}>
          <div ref={ref}>
            <StudioCanvas page={page} ratio={ratioOf(project)} width={width} frame={false} />
          </div>
        </div>
      </button>
      <div className="mt-2 flex items-center gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{project.name}</p>
          <p className="truncate text-xs text-muted">
            Template · {project.pages.length} page{project.pages.length === 1 ? '' : 's'}
          </p>
        </div>
        {onMenu ? (
          <button
            type="button"
            onClick={onMenu}
            aria-label={`Menu for ${project.name}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:bg-bone"
          >
            •••
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUse(nodeRef.current)}
            disabled={busy}
            className="btn btn-primary shrink-0 !px-3 !py-1.5 !text-xs"
          >
            {busy ? '…' : 'Use'}
          </button>
        )}
      </div>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-2 top-2 z-20 w-40 rounded-xl border border-line bg-card p-1 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]"
        >
          <button type="button" role="menuitem" onClick={() => { onUse(nodeRef.current); onMenu?.(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
            Use template
          </button>
          {onRename ? (
            <button type="button" role="menuitem" onClick={onRename} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
              Rename
            </button>
          ) : null}
          {onDuplicate ? (
            <button type="button" role="menuitem" onClick={onDuplicate} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
              Duplicate
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" role="menuitem" onClick={onDelete} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#9F2F2D] hover:bg-[#FDEBEC] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]">
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/35 text-xs font-bold text-white">
          Rendering…
        </span>
      ) : null}
    </article>
  );
}
