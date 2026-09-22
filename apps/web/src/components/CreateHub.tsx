'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Composer from '@/components/Composer';
import DesignStudio from '@/components/DesignStudio';
import { exportDesignPng, type CanvasDesign } from '@/lib/canvasDesign';
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
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [prefill, setPrefill] = useState<{ title: string; body: string; key: number } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);

  useEffect(() => {
    setIdeas(readList<Idea>(ideasKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt));
    setTemplates(
      readList<Template>(templatesKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt),
    );
    setDesigns(
      readList<CanvasDesign>(designsKey(workspaceId)).sort((a, b) => b.createdAt - a.createdAt),
    );
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
          <DesignStudio
            designs={designs}
            onSave={saveDesign}
            onDelete={(id) => persistDesigns(designs.filter((x) => x.id !== id))}
            onUse={useDesign}
            busyId={renderingId}
          />

          <p className="eyebrow pt-1">Caption templates</p>
          <div className="card space-y-3 p-4 sm:p-5">
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
              className="field min-h-[84px] resize-y"
              aria-label="Template caption"
            />
            <button type="button" onClick={saveTemplate} className="btn btn-primary w-full sm:w-auto">
              Save template
            </button>
          </div>

          <p className="eyebrow pt-1">Starter templates</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {STARTERS.map((s) => (
              <article key={s.id} className="card flex flex-col p-4 sm:p-5">
                <p className="font-display font-extrabold">{s.name}</p>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-soft">{s.body}</p>
                <button type="button" onClick={() => useIntoComposer(s)} className="btn btn-ghost mt-3 w-full">
                  Use template
                </button>
              </article>
            ))}
          </div>

          {templates.length > 0 ? (
            <>
              <p className="eyebrow pt-1">Your templates</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((t) => (
                  <article key={t.id} className="card flex flex-col p-4 sm:p-5">
                    <p className="truncate font-display font-extrabold">{t.name}</p>
                    {t.body ? <p className="mt-1 line-clamp-3 flex-1 text-sm text-soft">{t.body}</p> : null}
                    <p className="mt-1 text-xs text-faint">{fmtDate(t.createdAt)}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => useIntoComposer(t)} className="btn btn-primary flex-1">
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => persistTemplates(templates.filter((x) => x.id !== t.id))}
                        className="btn btn-ghost"
                        aria-label={`Delete ${t.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
