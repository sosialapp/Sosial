'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GitBranch,
  CircleCheckBig,
  CircleX,
  Clock,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import AiCard from '@/components/AiCard';
import SafeImg from '@/components/SafeImg';
import { channelAvatar } from '@/lib/channelAvatar';
import CreatePost from '@/components/CreatePost';
import { EmojiInput, EmojiTextarea } from '@/components/Emoji';
import PostBox, { type MediaItem, type Segment } from '@/components/PostBox';
import PostList, { TAB_MATCH, type Tab as StatusTab } from '@/components/PostList';
import StudioEditor from '@/components/studio/StudioEditor';
import StudioCanvas from '@/components/studio/StudioCanvas';
import { exportCanvasPng } from '@/lib/studio/exportPng';
import { watermarkBlob } from '@/lib/studio/watermarkClient';
import {
  POST_SIZES,
  blankProject,
  type StudioProject,
} from '@/lib/studio/model';
import type { ConnectedChannel, MediaAssetRow, PostWithTargets, WorkspaceInfo } from '@/lib/types';
import { gridThumb } from '@/lib/media';
import { fetchPosts } from '@/lib/posts';
import { createClient } from '@/lib/supabase/client';
import {
  pushLibraryItem, tombstoneLibraryItem, pullLibraryRows,
  type LibraryKind, type LibraryRow,
} from '@/lib/librarySync';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';

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
  /** Which app created it, renders a small badge when foreign. */
  origin?: 'web' | 'mobile';
}

interface Template {
  id: string;
  name: string;
  title: string;
  body: string;
  createdAt: number;
  builtIn?: boolean;
  /** Which app created it, renders a small badge when foreign. */
  origin?: 'web' | 'mobile';
}

export type Tab = 'post' | 'templates' | 'ideas';

/** Canonical URL per hub tab, tab switches navigate so every tab is linkable. */
export const TAB_URL: Record<Tab, string> = {
  post: '/post',
  templates: '/post-templates',
  ideas: '/post-ideas',
};

interface HubHandoff {
  prefill?: { title: string; body: string; key: number; thread?: boolean; parts?: string[] };
  files?: File[] | null;
}

/**
 * Cross-tab handoff: tab switches are real navigations (fresh component),
 * so flows that hand content to the composer (template use, studio export,
 * idea posting) stash it here instead of component state. Consumed once on
 * the next mount. Ideas/templates/projects persist via localStorage and need
 * no handoff; draft edits travel via ?edit= and reload from the server.
 */
let hubHandoff: HubHandoff | null = null;

function takeHubHandoff(): HubHandoff | null {
  const h = hubHandoff;
  hubHandoff = null;
  return h;
}

const ideasKey = (workspaceId: string) => `sosial-ideas-${workspaceId}`;
const templatesKey = (workspaceId: string) => `sosial-templates-${workspaceId}`;
const projectsKey = (workspaceId: string) => `sosial-studio-v2-${workspaceId}`;
const recentKey = (workspaceId: string) => `sosial-studio-recent-${workspaceId}`;

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

const STATUS_ORDER: StatusTab[] = ['all', 'sent', 'failed', 'queue', 'drafts', 'approvals'];
const STATUS_PILL_KEY: Record<StatusTab, string> = {
  all: 'tabAll',
  queue: 'tabQueue',
  drafts: 'tabDrafts',
  approvals: 'tabApprovals',
  sent: 'tabSent',
  failed: 'tabFailed',
};
const STATUS_TITLE: Record<StatusTab, string> = {
  all: 'titleAllPosts',
  queue: 'tabQueue',
  drafts: 'tabDrafts',
  approvals: 'tabApprovals',
  sent: 'tabSent',
  failed: 'tabFailed',
};
const STATUS_PILL_ICON: Record<StatusTab, LucideIcon> = {
  all: LayoutGrid,
  queue: Clock,
  drafts: FileText,
  approvals: ClipboardCheck,
  sent: CircleCheckBig,
  failed: CircleX,
};

/* ---------------- cross-device library sync ---------------- */

type SyncMarks = { idea: number; template: number; project: number };
const syncMarksKey = (workspaceId: string) => `sosial-lib-sync-${workspaceId}`;

function readMarks(workspaceId: string): SyncMarks {
  try {
    const raw = localStorage.getItem(syncMarksKey(workspaceId));
    const m = raw ? (JSON.parse(raw) as Partial<SyncMarks>) : {};
    return { idea: Number(m.idea) || 0, template: Number(m.template) || 0, project: Number(m.project) || 0 };
  } catch {
    return { idea: 0, template: 0, project: 0 };
  }
}

const asText = (v: unknown): string => (typeof v === 'string' ? v : '');
const asNum = (v: unknown, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

/** Portable media only, blob: URLs die with the session that made them. */
function portableMedia(url: unknown, kind: 'image' | 'video'): IdeaMedia | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  if (/^(https?:|data:image\/|data:video\/)/.test(url)) return { url, kind };
  return null;
}

/** Cloud row → web idea. Mobile and web ideas share title/body/thread text. */
function adaptIdea(r: LibraryRow): Idea | null {
  const d = (r.data ?? {}) as Record<string, unknown>;
  const title = asText(d.title) || r.title || 'Untitled';
  const body = asText(d.body);
  let thread: string[] | undefined;
  if (Array.isArray(d.thread)) {
    const parts = (d.thread as unknown[])
      .map((s) => (typeof s === 'string' ? s : asText((s as { text?: unknown })?.text)))
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) thread = parts;
  }
  const media: IdeaMedia[][] = [];
  if (Array.isArray(d.media)) {
    for (const part of d.media as unknown[]) {
      if (!Array.isArray(part)) continue;
      const items: IdeaMedia[] = [];
      for (const m of part as unknown[]) {
        const url = (m as { url?: unknown })?.url;
        const kind = (m as { kind?: unknown })?.kind === 'video' ? 'video' : 'image';
        const ok = portableMedia(url, kind as 'image' | 'video');
        if (ok) items.push(ok);
      }
      if (items.length > 0) media.push(items);
    }
  }
  for (const [u, k] of [
    [d.imageUri, 'image'],
    [d.videoUri, 'video'],
  ] as const) {
    const ok = portableMedia(u, k);
    if (ok) media.push([ok]);
  }
  return {
    id: r.client_id,
    title,
    body,
    thread,
    media: media.length > 0 ? media : undefined,
    createdAt: asNum(d.createdAt, Date.now()),
    origin: d._origin === 'mobile' ? 'mobile' : undefined,
  };
}

/** Cloud row → web template. Mobile rows (a `post` design object) become a
 *  text card with the design name, formats don't cross platforms. */
function adaptTemplate(r: LibraryRow): Template | null {
  const d = (r.data ?? {}) as Record<string, unknown>;
  if (d && typeof d.post === 'object' && d.post !== null) {
    const post = d.post as { name?: unknown };
    const name = asText(d.name) || r.title || 'Template';
    const title = asText(post.name) || name;
    return {
      id: r.client_id,
      name,
      title,
      body: '',
      createdAt: asNum(d.createdAt, Date.now()),
      origin: 'mobile',
    };
  }
  return {
    id: r.client_id,
    name: asText(d.name) || r.title || 'Template',
    title: asText(d.title),
    body: asText(d.body),
    createdAt: asNum(d.createdAt, Date.now()),
    origin: d._origin === 'mobile' ? 'mobile' : undefined,
  };
}

/** Cloud row → web studio project (web-origin rows only; validated). */
function adaptProject(r: LibraryRow): StudioProject | null {
  const d = (r.data ?? {}) as Record<string, unknown>;
  if (typeof d.id !== 'string' || !Array.isArray(d.pages)) return null;
  return d as unknown as StudioProject;
}

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
  initialPosts,
  initialTab,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
  initialPosts: PostWithTargets[];
  /** Tab from the route path (/post-templates → templates). The URL is the source of truth. */
  initialTab: Tab;
}) {
  const router = useRouter();
  const tr = useT(appMessages);
  const searchParams = useSearchParams();
  // Tab switches navigate (colocated per-tab URLs), no tab state to drift.
  const tab = initialTab;
  const goTab = (t: Tab) => {
    if (t !== tab) router.push(TAB_URL[t], { scroll: false });
  };
  // /post hosts the composer plus the status lists (?filter=), the URL is
  // the source of truth. ?edit= always means the composer.
  // Filter switches stay fully client-side: the server already sent every
  // post, so pushing a route (full server refetch ≈2s) for a view change is
  // pure waste. replaceState keeps the URL shareable with zero round-trips;
  // a popstate listener re-syncs when the user goes back/forward.
  const [filterSel, setFilterSel] = useState<string | null>(null); // null = follow URL
  useEffect(() => {
    const onPop = () => setFilterSel(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const goFilter = (s: StatusTab | null) => {
    window.history.replaceState(null, '', s ? `/post?filter=${s}` : '/post');
    setFilterSel(s ?? '');
  };
  const rawFilter = filterSel ?? searchParams.get('filter');
  const filterView: StatusTab | null =
    rawFilter === 'all' ||
    rawFilter === 'queue' ||
    rawFilter === 'drafts' ||
    rawFilter === 'approvals' ||
    rawFilter === 'sent' ||
    rawFilter === 'failed'
      ? rawFilter
      : null;
  const editId = searchParams.get('edit');
  const view: 'create' | 'templates' | 'ideas' | StatusTab =
    tab === 'templates'
      ? 'templates'
      : tab === 'ideas'
        ? 'ideas'
        : editId
          ? 'create'
          : (filterView ?? 'create');
  const statusView: StatusTab | null =
    view !== 'create' && view !== 'templates' && view !== 'ideas' ? view : null;
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
  /** Draft edit: a draft (or whole chain) loaded back into the composer. */
  const [draftEdit, setDraftEdit] = useState<{
    key: number;
    postIds: string[];
    bodies: string[];
    channelIds: string[];
    whenIso: string | null;
    threadsTopic: string;
    /** Existing assets per part: id kept for the save, url only for preview. */
    mediaParts: { mediaId: string; url?: string; kind: 'image' | 'video' }[][];
    /**
     * Set once the edit has been saved: the old rows are deleted, so they must
     * not be deleted again on a re-submit. Retiring (instead of nulling) keeps
     * the composer's React key stable, so the publish monitor that is on
     * screen survives the save instead of being unmounted mid-poll.
     */
    retired?: boolean;
  } | null>(null);
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
    // Cross-device sync: adopt cloud rows newer than our watermark, drop
    // tombstoned locals, and push locals the cloud has never seen. Skips
    // nothing when offline, the local lists stand.
    void (async () => {
      try {
        const sb = createClient();
        const rows = await pullLibraryRows(sb, workspaceId);
        if (!rows) return;
        const marks = readMarks(workspaceId);
        const nextMarks = { ...marks };
        const byKind = (k: LibraryKind) => rows.filter((r) => r.kind === k);

        const merge = <T extends { id: string }>(
          kind: LibraryKind,
          local: T[],
          adapt: (r: LibraryRow) => T | null,
        ): T[] => {
          const merged = [...local];
          const cloudIds = new Set(byKind(kind).map((r) => r.client_id));
          for (const r of byKind(kind)) {
            const ts = Date.parse(r.updated_at) || 0;
            if (ts <= marks[kind]) continue;
            const i = merged.findIndex((x) => x.id === r.client_id);
            if (r.deleted_at) {
              if (i >= 0) merged.splice(i, 1);
            } else {
              const adapted = adapt(r);
              if (adapted) {
                if (i >= 0) merged[i] = adapted;
                else merged.push(adapted);
              }
            }
            if (ts > nextMarks[kind]) nextMarks[kind] = ts;
          }
          for (const item of local) {
            if (!cloudIds.has(item.id)) {
              const label =
                (item as { title?: unknown }).title ?? (item as { name?: unknown }).name;
              void pushLibraryItem(
                sb,
                workspaceId,
                kind,
                item.id,
                typeof label === 'string' ? label : '',
                item as unknown as Record<string, unknown>,
              );
            }
          }
          return merged;
        };

        const mergedIdeas = merge('idea', readList<Idea>(ideasKey(workspaceId)), adaptIdea);
        const mergedTemplates = merge('template', readList<Template>(templatesKey(workspaceId)), adaptTemplate);
        const mergedProjects = merge('project', readList<StudioProject>(projectsKey(workspaceId)), adaptProject);
        try {
          localStorage.setItem(ideasKey(workspaceId), JSON.stringify(mergedIdeas));
          localStorage.setItem(templatesKey(workspaceId), JSON.stringify(mergedTemplates));
          localStorage.setItem(projectsKey(workspaceId), JSON.stringify(mergedProjects));
          localStorage.setItem(syncMarksKey(workspaceId), JSON.stringify(nextMarks));
        } catch {
          /* private mode, merged lists just won't persist */
        }
        setIdeas(mergedIdeas.sort((a, b) => b.createdAt - a.createdAt));
        setTemplates(mergedTemplates.sort((a, b) => b.createdAt - a.createdAt));
        setProjects(mergedProjects.sort((a, b) => b.createdAt - a.createdAt));
      } catch {
        /* offline, local lists stand */
      }
    })();
  }, [workspaceId]);

  // Channel avatars for the publish list (photo + logo per target channel).
  const avatarRecord = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const c of channels) {
      const a = channelAvatar(c.metadata);
      if (a) rec[c.id] = a;
    }
    return rec;
  }, [channels]);

  // Cross-tab handoff from template use / studio export / idea posting.
  useEffect(() => {
    const h = takeHubHandoff();
    if (!h) return;
    if (h.prefill) setPrefill(h.prefill);
    if (h.files !== undefined) setPendingFiles(h.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushAll = (kind: LibraryKind, items: { id: string; title?: string; name?: string }[]) => {
    try {
      const sb = createClient();
      for (const item of items) {
        void pushLibraryItem(
          sb,
          workspaceId,
          kind,
          item.id,
          item.title ?? item.name ?? '',
          item as unknown as Record<string, unknown>,
        );
      }
    } catch {
      /* offline, the next save or mount re-pushes */
    }
  };

  const tombstone = (kind: LibraryKind, id: string) => {
    try {
      void tombstoneLibraryItem(createClient(), workspaceId, kind, id);
    } catch {
      /* offline */
    }
  };

  const persistIdeas = (next: Idea[]) => {
    setIdeas(next);
    try {
      localStorage.setItem(ideasKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode, ideas just won't persist */
    }
    pushAll('idea', next);
  };

  const persistTemplates = (next: Template[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(templatesKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode, templates just won't persist */
    }
    pushAll('template', next);
  };

  const persistProjects = (next: StudioProject[]) => {
    setProjects(next);
    try {
      localStorage.setItem(projectsKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode / quota, designs just won't persist */
    }
    pushAll('project', next);
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

  function addFilesToIdea(i: number, list: FileList | File[] | null) {
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
    let finalList = next;
    try {
      localStorage.setItem(ideasKey(workspaceId), JSON.stringify(next));
    } catch {
      // Quota, retry without media so the text always survives.
      try {
        const slim = next.map((i) => ({ ...i, media: undefined }));
        localStorage.setItem(ideasKey(workspaceId), JSON.stringify(slim));
        setIdeas(slim as Idea[]);
        finalList = slim as Idea[];
      } catch {
        /* private mode, ideas just won't persist */
      }
    }
    pushAll('idea', finalList);
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
    hubHandoff = { prefill: { title: t.title, body: t.body, key: Date.now() } };
    goTab('post');
  };

  /** A stale client list (visited /post before creating the draft) can miss
   *  the row the Edit click refers to. Fetch once from the server, then retry
   *  with the fresh rows instead of silently doing nothing. */
  async function refreshEdit(postId: string) {
    try {
      const rows = await fetchPosts(createClient(), workspaceId);
      if (rows.some((p) => p.id === postId)) startEdit(postId, rows, false);
    } catch {}
  }

  /** Load a draft (or a whole chain, ordered) back into the composer for
   *  editing. Saving replaces the original rows. */
  const startEdit = (postId: string, all = initialPosts, retry = true): boolean => {
    const head = all.find((p) => p.id === postId);
    if (!head) {
      if (retry) void refreshEdit(postId);
      return false;
    }
    const parts = head.chain_id
      ? all
          .filter((p) => p.chain_id === head.chain_id)
          .sort((a, b) => a.chain_position - b.chain_position)
      : [head];
    const targetsOf = (p: PostWithTargets) => p.post_targets ?? [];
    const bodies = parts.map((p) => p.body || '');
    const mediaParts = parts.map((p) =>
      [...(p.post_media ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((m) => m.media_assets)
        .filter((m): m is MediaAssetRow => Boolean(m))
        // Carry the asset id even when signing failed: the edit links the
        // existing row on save, so a dead preview URL can never lose media.
        // signed_url preferred, thumb_url is the same object at lower res.
        .map((m) => ({
          mediaId: m.id,
          url: m.signed_url ?? m.thumb_url,
          kind: m.kind,
        })),
    );
    const channelIds = Array.from(
      new Set(parts.flatMap((p) => targetsOf(p).map((t) => t.channel_id))),
    );
    const threadsTopic = String(
      parts
        .flatMap(targetsOf)
        .find((t) => t.provider === 'threads')?.options?.threadsTopic ?? '',
    );
    setPrefill(null);
    setPendingFiles(null);
    setDraftEdit({
      key: Date.now(),
      postIds: parts.map((p) => p.id),
      bodies,
      channelIds,
      whenIso: head.scheduled_at,
      threadsTopic,
      mediaParts,
    });
    // Edits belong to the composer. On /post the filter is client-side, so
    // switching back must not navigate: a server round-trip remounts the hub
    // (dropping draftEdit) and resets scroll to the top. Only leave another
    // tab through the router.
    if (view !== 'create') {
      if (tab === 'post') {
        window.history.replaceState(null, '', '/post');
        setFilterSel('');
      } else {
        router.push('/post', { scroll: false });
      }
    }
    return true;
  };

  // Bring the loaded draft into view after the composer mounts; editing from a
  // long drafts list otherwise looks like nothing happened.
  useEffect(() => {
    if (!draftEdit) return;
    document.getElementById('post-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [draftEdit]);

  /** Deep link from the standalone queue page: /post?edit=<postId>. The old
   *  one-shot ref guard made every SECOND deep-link edit a silent no-op —
   *  the ref never reset, so new edit ids were swallowed. Track the last
   *  consumed id instead: a fresh id always re-opens the composer. */
  const lastEditId = useRef<string | null>(null);
  useEffect(() => {
    const id = searchParams.get('edit');
    if (!id || lastEditId.current === id) return;
    // Draft edits belong to the composer, bounce there with the id intact,
    // then load regardless (same-route replaces don't remount to re-run us).
    if (initialTab !== 'post' || filterView) {
      router.replace(`/post?edit=${encodeURIComponent(id)}`);
    }
    // Only consume the id once it actually loaded: marking it first made a
    // transient miss (posts not ready yet) a permanent no-op.
    if (startEdit(id)) lastEditId.current = id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialPosts]);

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
      const blob = await watermarkBlob(await exportCanvasPng(node, 2160));
      const page = project.pages[pageIndex] ?? project.pages[0];
      const file = new File([blob], `${project.name || 'design'}-p${pageIndex + 1}.png`, { type: 'image/png' });
      hubHandoff = {
        files: [file],
        prefill: { title: page?.title.text || project.name, body: page?.caption ?? '', key: Date.now() },
      };
      setEditing(null);
      goTab('post');
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
        /* media no longer readable, post without it */
      }
    }
    const parts = [idea.body, ...(idea.thread ?? [])];
    hubHandoff = {
      files: files.length ? files : null,
      prefill: {
        title: idea.title,
        body: idea.body,
        key: Date.now(),
        thread: (idea.thread?.length ?? 0) > 0,
        parts: parts.length > 1 ? parts : undefined,
      },
    };
    goTab('post');
  };

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      {statusView ? (
        <>
          <p className="eyebrow">{tr('hubPosts')}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {tr(STATUS_TITLE[statusView])}
          </h1>
        </>
      ) : (
        <>
          <p className="eyebrow">{tr('hubEyebrow')}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{tr('cNewPost')}</h1>
          <p className="mt-1 text-sm text-muted">{tr('hubSub')}</p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label={tr('hubEyebrow')}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'create' || statusView !== null}
          onClick={() => router.push('/post', { scroll: false })}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            view === 'create' || statusView !== null
              ? 'border-accent bg-accent text-on-accent'
              : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          {tr('hubTabPost')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'templates'}
          onClick={() => router.push('/post-templates', { scroll: false })}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            view === 'templates'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          {tr('hubTabTemplates')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'ideas'}
          onClick={() => router.push('/post-ideas', { scroll: false })}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            view === 'ideas'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          {tr('hubTabIdeas')}
          {ideas.length ? ` · ${ideas.length}` : ''}
        </button>
      </div>
      {(view === 'create' || statusView !== null) && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label={tr('filters')}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'create'}
            onClick={() => goFilter(null)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              view === 'create'
                ? 'border-accent bg-accent text-on-accent'
                : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            {tr('cNewPost')}
          </button>
          {STATUS_ORDER.map((s) => {
            const count = initialPosts.filter((p) => TAB_MATCH[s](p.status)).length;
            const Icon = STATUS_PILL_ICON[s];
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={statusView === s}
                onClick={() => goFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${
                  statusView === s
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line bg-card text-muted hover:bg-paper'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tr(STATUS_PILL_KEY[s])}
                {count > 0 && <span className="opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {view === 'create' ? (
        <div id="post-composer" className="mt-4 scroll-mt-24">
          <CreatePost
            key={`${prefill?.key ?? 'fresh'}-${draftEdit?.key ?? 0}-${pendingFiles ? pendingFiles.length : 0}`}
            channels={channels}
            workspaceId={workspaceId}
            userId={userId}
            role={role}
            initialTitle={prefill?.title ?? ''}
            initialBody={prefill?.body ?? draftEdit?.bodies[0] ?? ''}
            initialFiles={pendingFiles ?? undefined}
            initialThread={prefill?.thread ?? (draftEdit ? draftEdit.bodies.length > 1 : undefined)}
            initialParts={
              prefill?.parts ??
              (draftEdit && draftEdit.bodies.length > 1 ? draftEdit.bodies : undefined)
            }
            initialChannelIds={draftEdit?.channelIds}
            initialWhenIso={draftEdit?.whenIso ?? null}
            initialThreadsTopic={draftEdit?.threadsTopic}
            initialMediaParts={draftEdit?.mediaParts}
            editingIds={draftEdit?.retired ? undefined : draftEdit?.postIds}
            onEdited={() =>
              // Retire (don't null): nulling changes the composer key, which
              // remounts it and kills the publish monitor while the post is
              // still queued. The saved rows are gone; only the id list
              // matters now, and the retired flag drops that.
              setDraftEdit((d) => (d ? { ...d, retired: true } : null))
            }
            libraryCaptions={templates}
            libraryDesigns={projects}
          />
        </div>
      ) : view === 'ideas' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
            <div className="card space-y-3 p-4 sm:p-5">
              <p className="eyebrow">{tr('hubJot')}</p>
              <EmojiInput
                value={title}
                onChange={setTitle}
                placeholder={tr('hubIdeaTitlePh')}
                className="field font-display font-bold"
                aria-label={tr('hubIdeaTitle')}
              />
              <PostBox
                seg={ideaSegs[0] ?? { body: '', media: [] }}
                onChange={(v) => setIdeaSegs((prev) => prev.map((s, j) => (j === 0 ? { ...s, body: v } : s)))}
                onAddFiles={(list) => addFilesToIdea(0, list)}
                onRemoveMedia={(mi) => removeMediaFromIdea(0, mi)}
                onReorderMedia={(from, to) => reorderMediaInIdea(0, from, to)}
                placeholder={tr('hubIdeaBodyPh')}
                rows={4}
                limit={2200}
                label={tr('hubIdeaBody')}
              />
              {ideaThread ? (
                <div className="space-y-2">
                  {ideaSegs.slice(1).map((s, i) => {
                    const idx = i + 1;
                    return (
                      <div key={idx}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[11px] font-bold text-faint">{fill(tr('hubPartN'), { n: idx + 1 })}</span>
                          <span className="flex-1" />
                          <button
                            type="button"
                            onClick={() => setIdeaSegs((prev) => prev.filter((_, j) => j !== idx))}
                            aria-label={fill(tr('hubRemovePartN'), { n: idx + 1 })}
                            className="text-[11px] font-bold text-muted transition hover:text-ink"
                          >
                            {tr('hubRemove')}
                          </button>
                        </div>
                        <PostBox
                          seg={s}
                          onChange={(v) => setIdeaSegs((prev) => prev.map((x, j) => (j === idx ? { ...x, body: v } : x)))}
                          onAddFiles={(list) => addFilesToIdea(idx, list)}
                          onRemoveMedia={(mi) => removeMediaFromIdea(idx, mi)}
                          onReorderMedia={(from, to) => reorderMediaInIdea(idx, from, to)}
                          placeholder={fill(tr('hubPartPh'), { n: idx + 1 })}
                          rows={3}
                          limit={2200}
                          label={fill(tr('hubIdeaThreadLbl'), { n: idx + 1 })}
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
                      {tr('hubAddPart')}
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
                  <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                {ideaThread ? tr('threadOn') : tr('threadOff')}
                </button>
                <span className="flex-1" />
                <button type="button" onClick={() => void saveIdea()} className="btn btn-primary !py-1.5 !text-xs">
                  {tr('hubSaveIdea')}
                </button>
              </div>
            </div>

            {ideas.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="font-display text-base font-extrabold">{tr('hubNoIdeas')}</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                  {tr('hubNoIdeasSub')}
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
                            <SafeImg
                              src={gridThumb(cover.url)}
                              alt=""
                              className="h-full w-full object-cover"
                              fallback={
                                <span className="flex h-full w-full items-center justify-center text-ink/40">
                                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              }
                            />
                          ) : (
                            <video src={cover.url} muted playsInline className="h-full w-full object-cover" />
                          )}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <p className="truncate font-display font-extrabold">
                          {idea.title}
                          {idea.origin === 'mobile' ? (
                            <span className="pill ml-2 bg-surface text-soft">{tr('hubFromMobile')}</span>
                          ) : null}
                        </p>
                        {idea.body ? <p className="mt-1 line-clamp-2 text-sm text-soft">{idea.body}</p> : null}
                        <p className="mt-1 text-xs text-faint">
                          {fmtDate(idea.createdAt)}
                          {isThreadIdea ? ` · ${fill(tr('hubNThread'), { n: (idea.thread?.length ?? 0) + 1 })}` : ''}
                        </p>
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => void postIdea(idea)} className="btn btn-primary">
                        {tr('hubPostThisIdea')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          tombstone('idea', idea.id);
                          persistIdeas(ideas.filter((x) => x.id !== idea.id));
                        }}
                        className="btn btn-ghost"
                        aria-label={`${tr('deleteLbl')}: ${idea.title}`}
                      >
                        {tr('deleteLbl')}
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
                const clamped = Math.max(3, Math.min(12, n));
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
              appliedNote={tr('hubAppliedNote')}
            />
          </div>
        </div>
      ) : statusView ? (
        <div className="mt-4">
          <PostList
            key={statusView}
            posts={initialPosts}
            role={role}
            userId={userId}
            workspaceId={workspaceId}
            onEdit={startEdit}
            avatars={avatarRecord}
            channels={channels}
            initialTab={statusView}
            hideChrome
          />
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
              hubHandoff = { files, prefill: { title: t, body: caption, key: Date.now() } };
              persistRecent(
                [{ project: editing, pageIndex: 0, at: Date.now() }, ...recent.filter((r) => r.project.id !== editing.id)].slice(0, 12),
              );
              setEditing(null);
              goTab('post');
            }}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {/* Mobile-parity CTA, the editor opens beneath it (mobile opens a screen). */}
          <button
            type="button"
            onClick={() => setEditing(blankProject(tr('hubUntitledIdea')))}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-4 font-display text-sm font-extrabold text-paper transition hover:opacity-90"
          >
            {tr('hubNewDesign')}
          </button>

          {/* Your templates, two-column masonry with ••• menus. */}
          {projects.length > 0 ? (
            <>
              <p className="eyebrow pt-1">{tr('hubYourTemplates')}</p>
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
                        persistProjects([{ ...structuredClone(d), id: `design_${Date.now().toString(36)}`, name: fill(tr('hubDesignCopy'), { name: d.name }), createdAt: Date.now() }, ...projects]);
                        setMenuFor(null);
                      }}
                      onDelete={() => {
                        tombstone('project', d.id);
                        persistProjects(projects.filter((x) => x.id !== d.id));
                        setMenuFor(null);
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* Recent, designs used lately, most recent first. */}
          {recent.length > 0 ? (
            <>
              <p className="eyebrow pt-1">{tr('hubRecent')}</p>
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

          {/* Save your own caption templates. */}
          <details className="card p-4 sm:p-5">
            <summary className="cursor-pointer list-none font-display text-sm font-extrabold [&::-webkit-details-marker]:hidden">
              {tr('hubCaptionTpl')} <span aria-hidden="true" className="text-faint">·</span>{' '}
              <span className="text-xs font-medium text-muted">{tr('hubTapBrowse')}</span>
            </summary>
            <div className="mt-4 space-y-3">
              {templates.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {templates.map((s) => (
                    <article key={s.id} className="rounded-2xl border border-line bg-paper p-3.5">
                      <p className="truncate text-sm font-bold">{s.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-soft">{s.body}</p>
                      <button type="button" onClick={() => useIntoComposer(s)} className="btn btn-ghost mt-2.5 w-full !py-1.5 !text-xs">
                        {tr('hubUse')}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">{tr('hubNoCaptionTpl')}</p>
              )}
              <div className="space-y-2 rounded-2xl border border-line bg-paper p-3.5">
                <p className="eyebrow">{tr('hubSaveOwn')}</p>
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder={tr('hubTplNamePh')}
                  className="field font-display font-bold"
                  aria-label={tr('hubTplName')}
                />
                <EmojiInput
                  value={tplTitle}
                  onChange={setTplTitle}
                  placeholder={tr('hubTplTitlePh')}
                  className="field"
                  aria-label={tr('hubTplTitle')}
                />
                <EmojiTextarea
                  value={tplBody}
                  onChange={setTplBody}
                  placeholder={tr('hubTplCaptionPh')}
                  rows={3}
                  className="field min-h-[72px] resize-y"
                  aria-label={tr('hubTplCaption')}
                />
                <button type="button" onClick={saveTemplate} className="btn btn-primary w-full sm:w-auto">
                  {tr('hubSaveTpl')}
                </button>
              </div>
              {templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {tpl.name}
                          {tpl.origin === 'mobile' ? (
                            <span className="pill ml-2 bg-surface text-soft">{tr('hubFromMobile')}</span>
                          ) : null}
                        </p>
                        {tpl.body ? <p className="truncate text-xs text-muted">{tpl.body}</p> : null}
                        {tpl.origin === 'mobile' && !tpl.body ? (
                          <p className="truncate text-xs text-muted">{tr('hubSavedMobile')}</p>
                        ) : null}
                      </div>
                      {tpl.origin === 'mobile' && !tpl.body ? (
                        <button
                          type="button"
                          onClick={() => {
                            const idea: Idea = {
                              id: `idea_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                              title: tpl.title || tpl.name,
                              body: tpl.title && tpl.title !== tpl.name ? `${tpl.title}` : '',
                              createdAt: Date.now(),
                            };
                            persistIdeas([idea, ...ideas]);
                            goTab('ideas');
                          }}
                          className="btn btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
                        >
                          {tr('hubSaveAsIdea')}
                        </button>
                      ) : (
                        <button type="button" onClick={() => useIntoComposer(tpl)} className="btn btn-ghost shrink-0 !px-3 !py-1.5 !text-xs">
                          {tr('hubUse')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          tombstone('template', tpl.id);
                          persistTemplates(templates.filter((x) => x.id !== tpl.id));
                        }}
                        className="btn btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
                        aria-label={`${tr('deleteLbl')}: ${tpl.name}`}
                      >
                        {tr('deleteLbl')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>

          {/* Rename dialog, mobile parity. */}
          {renaming ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setRenaming(null)} className="absolute inset-0 cursor-default bg-black/40" />
              <div className="card relative w-full max-w-xs p-5">
                <p className="font-display text-base font-extrabold">{tr('hubRename')}</p>
                <input
                  value={renaming.value}
                  onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameProject();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  autoFocus
                  className="field mt-3"
                  aria-label={tr('hubTplName')}
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={renameProject} className="btn btn-primary flex-1">
                    {tr('hubSave')}
                  </button>
                  <button type="button" onClick={() => setRenaming(null)} className="btn btn-ghost">
                    {tr('cancel')}
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
  const tr = useT(appMessages);
  const { ref, width } = useBoxWidth(300);
  const nodeRef = useRef<HTMLDivElement>(null);
  const page = project.pages[pageIndex] ?? project.pages[0];
  if (!page) return null;
  return (
    <article className="relative">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={fill(tr('hubOpen'), { name: project.name })}>
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
            {fill(tr('hubTplMeta'), { n: project.pages.length })}
          </p>
        </div>
        {onMenu ? (
          <button
            type="button"
            onClick={onMenu}
            aria-label={fill(tr('hubMenuFor'), { name: project.name })}
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
            {busy ? '…' : tr('hubUse')}
          </button>
        )}
      </div>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-2 top-2 z-20 w-40 rounded-xl border border-line bg-card p-1 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]"
        >
          <button type="button" role="menuitem" onClick={() => { onUse(nodeRef.current); onMenu?.(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
            {tr('hubUseTemplate')}
          </button>
          {onRename ? (
            <button type="button" role="menuitem" onClick={onRename} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
              {tr('hubRename')}
            </button>
          ) : null}
          {onDuplicate ? (
            <button type="button" role="menuitem" onClick={onDuplicate} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
              {tr('hubDuplicate')}
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" role="menuitem" onClick={onDelete} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#9F2F2D] hover:bg-[#FDEBEC] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]">
              {tr('deleteLbl')}
            </button>
          ) : null}
        </div>
      ) : null}
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/35 text-xs font-bold text-white">
          {tr('hubRendering')}
        </span>
      ) : null}
    </article>
  );
}
