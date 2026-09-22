'use client';

import { useEffect, useState } from 'react';
import Composer from '@/components/Composer';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

interface Idea {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

const ideasKey = (workspaceId: string) => `sosial-ideas-${workspaceId}`;

function loadIdeas(workspaceId: string): Idea[] {
  try {
    const raw = localStorage.getItem(ideasKey(workspaceId));
    const list = raw ? (JSON.parse(raw) as Idea[]) : [];
    return Array.isArray(list) ? list.sort((a, b) => b.createdAt - a.createdAt) : [];
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

/**
 * Mobile-style Create hub: quick Post composer plus an Ideas inbox.
 * Posting an idea prefills the composer (remount applies the initial text).
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
  const [tab, setTab] = useState<'post' | 'ideas'>('post');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prefill, setPrefill] = useState<{ title: string; body: string; key: number } | null>(null);

  useEffect(() => {
    setIdeas(loadIdeas(workspaceId));
  }, [workspaceId]);

  const persist = (next: Idea[]) => {
    setIdeas(next);
    try {
      localStorage.setItem(ideasKey(workspaceId), JSON.stringify(next));
    } catch {
      /* private mode — ideas just won't persist */
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
    persist([idea, ...ideas]);
    setTitle('');
    setBody('');
  };

  const postIdea = (idea: Idea) => {
    setPrefill({ title: idea.title, body: idea.body, key: Date.now() });
    setTab('post');
  };

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Create</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">New post</h1>
      <p className="mt-1 text-sm text-muted">Catch the idea, then post it everywhere.</p>

      <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Create sections">
        {(['post', 'ideas'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              tab === t ? 'border-ink bg-ink text-white' : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            {t === 'post' ? 'Post' : `Ideas${ideas.length ? ` · ${ideas.length}` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'post' ? (
        <div className="card mt-4 overflow-hidden">
          <Composer
            key={prefill?.key ?? 'fresh'}
            channels={channels}
            workspaceId={workspaceId}
            userId={userId}
            role={role}
            initialTitle={prefill?.title ?? ''}
            initialBody={prefill?.body ?? ''}
          />
        </div>
      ) : (
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
                    onClick={() => persist(ideas.filter((x) => x.id !== idea.id))}
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
      )}
    </div>
  );
}
