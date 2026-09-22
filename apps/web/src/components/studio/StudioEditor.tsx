'use client';

/**
 * StudioEditor — web port of mobile EditorScreen: top bar (back / name /
 * Save / Use in post), live canvas stage with dots, numbered step tabs
 * (01 Background · 02 Title · 03 Photo & socials · 04 Content · 05 Pages).
 */
import { useEffect, useRef, useState } from 'react';
import {
  blankPage,
  uid,
  type BackgroundStyle,
  type PfpStyle,
  type PostPage,
  type PostSizeId,
  type PostTitle,
  type StudioProject,
} from '@/lib/studio/model';
import { exportCanvasPng } from '@/lib/studio/exportPng';
import StudioCanvas from './StudioCanvas';
import { BackgroundStep, PhotoSocialsStep, TitleStep } from './steps1';
import { ContentStep, PagesStep } from './steps2';

type Step = 'background' | 'title' | 'photo' | 'content' | 'pages';

const STEPS: { id: Step; label: string }[] = [
  { id: 'background', label: 'Background' },
  { id: 'title', label: 'Title' },
  { id: 'photo', label: 'Photo & socials' },
  { id: 'content', label: 'Content' },
  { id: 'pages', label: 'Pages' },
];

function useStageWidth(max = 440): { ref: React.RefObject<HTMLDivElement | null>; width: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(max);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.min(max, Math.max(240, el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return { ref, width };
}

export default function StudioEditor({
  initial,
  onSave,
  onUsePng,
  onClose,
}: {
  initial: StudioProject;
  onSave: (p: StudioProject) => void;
  onUsePng: (blob: Blob, title: string, caption: string) => void;
  onClose: () => void;
}) {
  const [project, setProject] = useState<StudioProject>(initial);
  const [pageIndex, setPageIndex] = useState(0);
  const [step, setStep] = useState<Step>('background');
  const [exporting, setExporting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const { ref: stageRef, width: stageW } = useStageWidth(440);

  const page = project.pages[Math.min(pageIndex, project.pages.length - 1)];
  const ratio =
    ({ square: 1, portrait: 1.25, story: 16 / 9, landscape: 9 / 16, a4: 1.414 } as const)[project.sizeId] ?? 1.25;

  // Arrow keys flip pages (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') setPageIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setPageIndex((i) => i + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project.pages.length]);

  const patchPage = (patch: Partial<PostPage>) =>
    setProject((p) => ({ ...p, pages: p.pages.map((pg, i) => (i === pageIndex ? { ...pg, ...patch } : pg)) }));
  const patchBackground = (patch: Partial<BackgroundStyle>) =>
    patchPage({ background: { ...page.background, ...patch } });
  const patchTitle = (patch: Partial<PostTitle>) =>
    patchPage({ title: { ...page.title, ...patch } });
  const patchPfp = (patch: Partial<PfpStyle>) =>
    patchPage({ pfp: { ...page.pfp, ...patch } });

  const selectPage = (i: number) => setPageIndex(Math.max(0, Math.min(project.pages.length - 1, i)));
  const addPage = () => {
    setProject((p) => ({ ...p, pages: [...p.pages, blankPage()] }));
    setPageIndex(project.pages.length);
  };
  const duplicatePage = () => {
    const copy: PostPage = JSON.parse(JSON.stringify(page));
    copy.id = uid('page');
    setProject((p) => {
      const next = [...p.pages];
      next.splice(pageIndex + 1, 0, copy);
      return { ...p, pages: next };
    });
    setPageIndex(pageIndex + 1);
  };
  const deletePage = () => {
    if (project.pages.length <= 1) return;
    const id = page.id;
    setProject((p) => ({ ...p, pages: p.pages.filter((pg) => pg.id !== id) }));
    setPageIndex(Math.max(0, pageIndex - 1));
  };
  const movePage = (dir: -1 | 1) => {
    const j = pageIndex + dir;
    if (j < 0 || j >= project.pages.length) return;
    setProject((p) => {
      const next = [...p.pages];
      [next[pageIndex], next[j]] = [next[j], next[pageIndex]];
      return { ...p, pages: next };
    });
    setPageIndex(j);
  };

  /** Drop-to-reorder from the filmstrip (hold and drag). */
  const dropPageAt = (targetId: string) => {
    const from = project.pages.findIndex((pg) => pg.id === dragId);
    const to = project.pages.findIndex((pg) => pg.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0 || from === to) return;
    const curId = page.id;
    const next = [...project.pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setProject((p) => ({ ...p, pages: next }));
    setPageIndex(next.findIndex((pg) => pg.id === curId));
  };

  const doSave = () => {
    onSave(project);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const doUse = async () => {
    const node = canvasHostRef.current?.querySelector('[data-studio-canvas]') as HTMLElement | null;
    if (!node) return;
    setExporting(true);
    try {
      const blob = await exportCanvasPng(node, 1080);
      onUsePng(blob, page.title.text || project.name, page.caption ?? '');
    } finally {
      setExporting(false);
    }
  };

  if (!page) return null;

  return (
    <div className="card overflow-hidden">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to templates"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-lg"
        >
          ‹
        </button>
        <input
          value={project.name}
          onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
          aria-label="Design name"
          className="min-w-0 flex-1 bg-transparent font-display text-sm font-extrabold outline-none"
        />
        <button type="button" onClick={doSave} className="btn btn-ghost shrink-0 !px-3.5 !py-2 !text-xs">
          {savedFlash ? 'Saved ✓' : 'Save'}
        </button>
        <button type="button" onClick={doUse} disabled={exporting} className="btn btn-primary shrink-0 !px-3.5 !py-2 !text-xs">
          {exporting ? 'Rendering…' : 'Use in post'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        {/* stage */}
        <div className="flex flex-col items-center gap-2 border-b border-line bg-bone px-4 py-5 dark:bg-white/[0.02] lg:border-b-0 lg:border-r">
          <div ref={stageRef} className="w-full max-w-[440px]">
            <div ref={canvasHostRef}>
              <StudioCanvas page={page} ratio={ratio} width={stageW} watermark />
            </div>
          </div>
          {/* filmstrip — small previews, hold and drag to rearrange */}
          {project.pages.length > 1 ? (
            <div className="flex max-w-full gap-2 overflow-x-auto px-1 py-1">
              {project.pages.map((pg, i) => (
                <button
                  key={pg.id}
                  type="button"
                  draggable
                  onClick={() => selectPage(i)}
                  onDragStart={(e) => {
                    setDragId(pg.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropPageAt(pg.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  aria-label={`Page ${i + 1}${i === pageIndex ? ', current' : ''}`}
                  className={`shrink-0 cursor-grab overflow-hidden rounded-lg transition active:cursor-grabbing ${
                    i === pageIndex ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100'
                  } ${dragId === pg.id ? 'opacity-30' : ''}`}
                  style={{ width: 64 }}
                >
                  <StudioCanvas page={pg} ratio={ratio} width={64} watermark={false} frame={false} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => selectPage(pageIndex - 1)}
              disabled={pageIndex === 0 || project.pages.length < 2}
              aria-label="Previous page"
              className="text-lg font-bold text-muted transition hover:text-ink disabled:opacity-30"
            >
              ‹
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                {project.pages.map((pg, i) => (
                  <button
                    key={pg.id}
                    type="button"
                    onClick={() => selectPage(i)}
                    aria-label={`Page ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === pageIndex ? 'w-5 bg-accent' : 'w-1.5 bg-line'}`}
                  />
                ))}
              </div>
              {project.pages.length > 1 ? (
                <span className="text-xs font-bold text-muted">
                  {pageIndex + 1} / {project.pages.length}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => selectPage(pageIndex + 1)}
              disabled={pageIndex >= project.pages.length - 1 || project.pages.length < 2}
              aria-label="Next page"
              className="text-lg font-bold text-muted transition hover:text-ink disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button type="button" onClick={duplicatePage} className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-bold">
              Duplicate page
            </button>
            {project.pages.length > 1 ? (
              <button
                type="button"
                onClick={deletePage}
                className="rounded-xl border border-[#F0D9DA] bg-card px-3 py-1.5 text-xs font-bold text-[#9F2F2D] dark:text-[#f2a8a8]"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>

        {/* sheet */}
        <div className="min-w-0">
          <div className="flex border-b border-line px-2">
            {STEPS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStep(t.id)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2.5 text-xs font-bold transition ${
                  step === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <span className={`shrink-0 text-[11px] ${step === t.id ? 'text-ink' : 'text-faint'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate">
                  {t.id === 'photo' ? (
                    <>
                      <span className="hidden min-[1500px]:inline">Photo & socials</span>
                      <span className="min-[1500px]:hidden">Photo</span>
                    </>
                  ) : (
                    t.label
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4">
            {step === 'background' ? <BackgroundStep page={page} patchBackground={patchBackground} /> : null}
            {step === 'title' ? <TitleStep page={page} patchTitle={patchTitle} patchPage={patchPage} /> : null}
            {step === 'photo' ? <PhotoSocialsStep page={page} patchPfp={patchPfp} patchPage={patchPage} /> : null}
            {step === 'content' ? <ContentStep page={page} patchPage={patchPage} /> : null}
            {step === 'pages' ? (
              <PagesStep
                project={project}
                pageIndex={pageIndex}
                onSelect={selectPage}
                onAdd={addPage}
                onDuplicate={duplicatePage}
                onDelete={deletePage}
                onMove={movePage}
                onSize={(s) => setProject((p) => ({ ...p, sizeId: s }))}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
