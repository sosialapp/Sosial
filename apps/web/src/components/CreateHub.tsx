'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Composer from '@/components/Composer';
import DesignStudio, { DesignPreview } from '@/components/DesignStudio';
import { STARTER_DESIGNS, exportDesignPng, sizeOf, type CanvasDesign } from '@/lib/canvasDesign';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

interface Idea {
  id: string;
  title: string;
  body: string;
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
const designsKey = (workspaceId: string) => `sosial-designs-${workspaceId}`;
const recentKey = (workspaceId: string) => `sosial-design-recent-${workspaceId}`;

/** Starter content templates — one tap into the composer. */
const STARTERS: Template[] = [
  {
    id: 'starter-launch',
    name: 'Product launch',
    title: 'We just launched something new',
    body: 'Big news — it’s live! Here’s what’s new and why you’ll love it.\n\n#launch #newdrop',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-promo',
    name: 'Sale / promo',
    title: 'Sale is on — don’t miss out',
    body: 'For a limited time: get 20% off everything. Tap the link to shop before it ends.\n\n#sale #promo',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-bts',
    name: 'Behind the scenes',
    title: 'A peek behind the curtain',
    body: 'Here’s what we’ve been working on this week — the messy middle nobody usually sees.\n\n#behindthescenes #buildinpublic',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-event',
    name: 'Event reminder',
    title: 'Reminder: we go live soon',
    body: 'Don’t forget — we’re live this Friday at 6pm. Set a reminder and bring your questions.\n\n#live #event',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'starter-quote',
    name: 'Quote card',
    title: 'Quote of the week',
    body: '“Show up every day — the algorithm rewards consistency.”\n\n#motivation #quote',
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

/**
 * Mobile-style Create hub: quick Post composer, Ideas inbox, Templates.
 * Deep-linkable via ?tab=post|ideas|templates (the dock + popup targets it).
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
  const [designs, setDesigns] = useState<CanvasDesign[]>([]);
  const [recent, setRecent] = useState<CanvasDesign[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [prefill, setPrefill] = useState<{ title: string; body: string; key: number } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    setIdeas(readList<Idea>(ideasKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt));
    setTemplates(
      readList<Template>(templatesKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt),
    );
    setDesigns(
      readList<CanvasDesign>(designsKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt),
    );
    setRecent(readList<CanvasDesign>(recentKey(workspaceId)).slice(0, 12));
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

  const saveIdea = () => {
    if (!title.trim() && !body.trim()) return;
    const idea: Idea = {
      id: `idea_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || body.split('\n')[0].slice(0, 60) || 'Untitled idea',
      body,
      createdAt: Date.now(),
    };
    persistIdeas([idea, ...ideas]);
    setTitle('');
    setBody('');
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

  const persistDesigns = (next: CanvasDesign[]) => {
    setDesigns(next);
    try {
      localStorage.setItem(designsKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode — designs just won't persist */
    }
  };

  const persistRecent = (next: CanvasDesign[]) => {
    setRecent(next);
    try {
      localStorage.setItem(recentKey(workspaceId), JSON.stringify(next.slice(0, 12)));
    } catch {
      /* private mode */
    }
  };

  const renameDesign = () => {
    if (!renaming) return;
    const v = renaming.value.trim();
    if (v) persistDesigns(designs.map((d) => (d.id === renaming.id ? { ...d, name: v } : d)));
    setRenaming(null);
  };

  const saveDesign = (d: Omit<CanvasDesign, 'id' | 'createdAt'>) => {
    const rec: CanvasDesign = {
      ...d,
      id: `design_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    persistDesigns([rec, ...designs]);
  };

  /** Render the design to PNG and attach it to the composer with its copy. */
  const useDesign = async (d: CanvasDesign) => {
    setRenderingId(d.id);
    try {
      const blob = await exportDesignPng(d);
      const file = new File([blob], `${d.name || 'design'}.png`, { type: 'image/png' });
      setPendingFiles([file]);
      setPrefill({ title: d.title, body: d.body, key: Date.now() });
      setTab('post');
      // Track usage for the Recent rail (dedupe by id, cap 12).
      if (d.id !== 'draft') {
        const stamp = { ...d, createdAt: Date.now() };
        persistRecent([stamp, ...recent.filter((x) => x.id !== d.id)].slice(0, 12));
      }
    } catch {
      /* export toast lives here if this ever needs one */
    } finally {
      setRenderingId(null);
    }
  };

  const postIdea = (idea: Idea) => useIntoComposer(idea);

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Create</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">New post</h1>
      <p className="mt-1 text-sm text-muted">Catch the idea, start from a template, then post it everywhere.</p>

      <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Create sections">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              tab === t ? 'border-accent bg-accent text-white' : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            {TAB_LABEL[t]}
            {t === 'ideas' && ideas.length ? ` · ${ideas.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'post' ? (
        <div className="card mt-4 overflow-hidden">
          <Composer
            key={`${prefill?.key ?? 'fresh'}-${pendingFiles ? pendingFiles.length : 0}`}
            channels={channels}
            workspaceId={workspaceId}
            userId={userId}
            role={role}
            initialTitle={prefill?.title ?? ''}
            initialBody={prefill?.body ?? ''}
            initialFiles={pendingFiles ?? undefined}
          />
        </div>
      ) : tab === 'ideas' ? (
        <div className="mt-4 space-y-3">
          <div className="card space-y-3 p-4 sm:p-5">
            <p className="eyebrow">Jot it down</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Idea title…"
              className="field font-display font-bold"
              aria-label="Idea title"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the idea…"
              rows={3}
              className="field min-h-[84px] resize-y"
              aria-label="Idea body"
            />
            <button type="button" onClick={saveIdea} className="btn btn-primary w-full sm:w-auto">
              Save idea
            </button>
          </div>

          {ideas.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="font-display text-base font-extrabold">No ideas yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                Jot one above — posting it later takes one tap.
              </p>
            </div>
          ) : (
            ideas.map((idea) => (
              <article key={idea.id} className="card p-4 sm:p-5">
                <p className="truncate font-display font-extrabold">{idea.title}</p>
                {idea.body ? <p className="mt-1 line-clamp-2 text-sm text-soft">{idea.body}</p> : null}
                <p className="mt-1 text-xs text-faint">{fmtDate(idea.createdAt)}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => postIdea(idea)} className="btn btn-primary">
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
            ))
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {/* Mobile-parity CTA — the editor opens beneath it (mobile opens a screen). */}
          <button
            type="button"
            onClick={() => setEditorOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-accent px-5 py-4 font-display text-sm font-extrabold text-white transition hover:brightness-110"
          >
            + New template design
            <span aria-hidden="true">{editorOpen ? '↑' : '→'}</span>
          </button>
          {editorOpen ? (
            <DesignStudio onSave={saveDesign} onUse={useDesign} busyId={renderingId} />
          ) : null}

          {/* Starter templates — horizontal rail of canvas miniatures. */}
          {STARTER_DESIGNS.length > 0 ? (
            <>
              <p className="eyebrow pt-1">Starter templates</p>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {STARTER_DESIGNS.map((s) => (
                  <DesignTile
                    key={s.id}
                    design={s}
                    kind="Template"
                    builtIn
                    busy={renderingId === s.id}
                    onUse={() => useDesign(s)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {/* Your templates — two-column masonry with ••• menus. */}
          {designs.length > 0 ? (
            <>
              <p className="eyebrow pt-1">Your templates</p>
              <div className="columns-2 gap-3 xl:columns-3">
                {designs.map((d) => (
                  <div key={d.id} className="mb-3 break-inside-avoid">
                    <DesignTile
                      design={d}
                      kind="Template"
                      busy={renderingId === d.id}
                      onUse={() => useDesign(d)}
                      onMenu={() => setMenuFor(menuFor === d.id ? null : d.id)}
                      menuOpen={menuFor === d.id}
                      onRename={() => {
                        setRenaming({ id: d.id, value: d.name });
                        setMenuFor(null);
                      }}
                      onDuplicate={() => {
                        persistDesigns([
                          { ...d, id: `design_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: `${d.name} copy`, createdAt: Date.now() },
                          ...designs,
                        ]);
                        setMenuFor(null);
                      }}
                      onDelete={() => {
                        persistDesigns(designs.filter((x) => x.id !== d.id));
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
                {recent.map((d, i) => (
                  <div key={`${d.id}-${i}`} className="mb-3 break-inside-avoid">
                    <DesignTile
                      design={d}
                      kind="Design"
                      busy={renderingId === d.id}
                      onUse={() => useDesign(d)}
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
                <input
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                  placeholder="Post title…"
                  className="field"
                  aria-label="Template post title"
                />
                <textarea
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
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
                    if (e.key === 'Enter') renameDesign();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  autoFocus
                  className="field mt-3"
                  aria-label="Template name"
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={renameDesign} className="btn btn-primary flex-1">
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

/** One template tile: canvas miniature + name/meta + ••• menu (mobile parity). */
function DesignTile({
  design,
  kind,
  builtIn,
  busy,
  onUse,
  onMenu,
  menuOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  design: CanvasDesign;
  kind: 'Template' | 'Design';
  builtIn?: boolean;
  busy: boolean;
  onUse: () => void;
  onMenu?: () => void;
  menuOpen?: boolean;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="relative">
      <button
        type="button"
        onClick={onUse}
        disabled={busy}
        className="block w-full text-left"
        aria-label={`Use ${design.name}`}
      >
        <div className="relative">
          <DesignPreview design={design} />
          {builtIn ? (
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-white">
              STARTER
            </span>
          ) : null}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/35 text-xs font-bold text-white">
              Rendering…
            </span>
          ) : null}
        </div>
      </button>
      <div className="mt-2 flex items-center gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{design.name}</p>
          <p className="truncate text-xs text-muted">
            {kind} · {sizeOf(design).label}
          </p>
        </div>
        {onMenu ? (
          <button
            type="button"
            onClick={onMenu}
            aria-label={`Menu for ${design.name}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:bg-bone"
          >
            •••
          </button>
        ) : null}
      </div>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-2 top-2 z-20 w-40 rounded-xl border border-line bg-card p-1 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]"
        >
          <button type="button" role="menuitem" onClick={() => { onUse(); onMenu?.(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-bone dark:hover:bg-white/5">
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
    </article>
  );
}
