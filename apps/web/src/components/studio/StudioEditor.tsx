'use client';

/**
 * StudioEditor — web port of mobile EditorScreen: top bar (back / name /
 * undo / redo / Download all / Save / Use in post), live canvas stage with a
 * vertical page pager beside it, numbered step tabs
 * (01 Background · 02 Title · 03 Photo & socials · 04 Content · 05 Pages).
 * Every page renders offscreen so exports and "Use in post" capture all pages.
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
import AiStudioPanel from './AiStudioPanel';
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

/** One grounded hint per step, shown under the sheet so the panel never ends bare. */
const STEP_TIPS: Record<Step, string> = {
  background: 'Pick a preset, then tune the pattern size and opacity to keep text readable.',
  title: 'Keep titles under 6 words — big text and lots of whitespace win the swipe.',
  photo: 'Square photos crop best; Center focus keeps faces in frame.',
  content: 'One idea per card. Turn on AI generate to write the copy for you.',
  pages: 'Hook and takeaway cards stay text-only — put the detail in the middle.',
};
const AI_TIP = 'Rough thoughts are enough — a phrase works. Your design stays untouched.';

type Exporting = null | 'use' | 'all' | 'page';

function useStageWidth(max = 420): { ref: React.RefObject<HTMLDivElement | null>; width: number } {
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
  /** Fired by "Use in post" with every page rendered at export size. */
  onUsePng: (blobs: Blob[], title: string, caption: string) => void;
  onClose: () => void;
}) {
  const [project, setProject] = useState<StudioProject>(initial);
  const [pageIndex, setPageIndex] = useState(0);
  const [step, setStep] = useState<Step>('background');
  const [exporting, setExporting] = useState<Exporting>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [past, setPast] = useState<StudioProject[]>([]);
  const [future, setFuture] = useState<StudioProject[]>([]);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const exportHostRef = useRef<HTMLDivElement>(null);
  const { ref: stageRef, width: stageW } = useStageWidth(420);

  const page = project.pages[Math.min(pageIndex, project.pages.length - 1)];
  const ratio =
    ({ square: 1, portrait: 1.25, story: 16 / 9, landscape: 9 / 16, a4: 1.414 } as const)[project.sizeId] ?? 1.25;

  /* ------------------------------ history ------------------------------- */

  const commit = (updater: (p: StudioProject) => StudioProject) => {
    setPast((ps) => [...ps.slice(-59), project]);
    setFuture([]);
    setProject(updater(project));
  };

  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast((ps) => ps.slice(0, -1));
    setFuture((f) => [project, ...f]);
    setProject(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((ps) => [...ps, project]);
    setProject(next);
  };

  // Ctrl/Cmd+Z undo · Ctrl+Shift+Z / Ctrl+Y redo (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, project]);

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

  /* ------------------------------ mutations ----------------------------- */

  const patchPage = (patch: Partial<PostPage>) =>
    commit((p) => ({ ...p, pages: p.pages.map((pg, i) => (i === pageIndex ? { ...pg, ...patch } : pg)) }));
  const patchBackground = (patch: Partial<BackgroundStyle>) =>
    patchPage({ background: { ...page.background, ...patch } });
  const patchTitle = (patch: Partial<PostTitle>) =>
    patchPage({ title: { ...page.title, ...patch } });
  const patchPfp = (patch: Partial<PfpStyle>) =>
    patchPage({ pfp: { ...page.pfp, ...patch } });

  const selectPage = (i: number) => setPageIndex(Math.max(0, Math.min(project.pages.length - 1, i)));
  const addPage = () => {
    commit((p) => ({ ...p, pages: [...p.pages, blankPage()] }));
    setPageIndex(project.pages.length);
  };
  const duplicatePage = () => {
    const copy: PostPage = JSON.parse(JSON.stringify(page));
    copy.id = uid('page');
    commit((p) => {
      const next = [...p.pages];
      next.splice(pageIndex + 1, 0, copy);
      return { ...p, pages: next };
    });
    setPageIndex(pageIndex + 1);
  };
  const deletePage = () => {
    if (project.pages.length <= 1) return;
    const id = page.id;
    commit((p) => ({ ...p, pages: p.pages.filter((pg) => pg.id !== id) }));
    setPageIndex(Math.max(0, pageIndex - 1));
  };
  const movePage = (dir: -1 | 1) => {
    const j = pageIndex + dir;
    if (j < 0 || j >= project.pages.length) return;
    commit((p) => {
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
    commit((p) => ({ ...p, pages: next }));
    setPageIndex(next.findIndex((pg) => pg.id === curId));
  };

  /** Swap in AI-written cards — design cloned from the current page. */
  const applyAi = (pages: PostPage[]) => {
    commit((p) => ({ ...p, pages }));
    setPageIndex(0);
    setStep('content');
  };

  /* ------------------------------ exports ------------------------------- */

  /** Every page renders offscreen; pick one node and rasterise at 1080. */
  const exportPagePng = async (i: number): Promise<Blob | null> => {
    const host = exportHostRef.current;
    if (!host) return null;
    const node = host.querySelector<HTMLElement>(`[data-export-page="${i}"] [data-studio-canvas]`);
    if (!node) return null;
    return exportCanvasPng(node, 1080);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const baseName = () => project.name.trim() || 'design';
  const fileName = (i: number) => `${baseName()}-p${i + 1}.png`;

  const doSave = () => {
    onSave(project);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const doDownloadPage = async () => {
    setExporting('page');
    setExportErr(null);
    try {
      // Capture the canvas the user actually sees.
      const node =
        canvasHostRef.current?.querySelector<HTMLElement>('[data-studio-canvas]') ?? null;
      const blob = node ? await exportCanvasPng(node, 1080) : await exportPagePng(pageIndex);
      if (blob) downloadBlob(blob, fileName(pageIndex));
      else setExportErr('Could not render that page. Try again.');
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Export failed. Try again.');
    } finally {
      setExporting(null);
    }
  };

  const doDownloadAll = async () => {
    setExporting('all');
    setExportErr(null);
    try {
      let ok = 0;
      for (let i = 0; i < project.pages.length; i++) {
        const blob = await exportPagePng(i);
        if (blob) {
          downloadBlob(blob, fileName(i));
          ok++;
        }
        await new Promise((r) => setTimeout(r, 350));
      }
      if (ok === 0) setExportErr('Could not render the pages. Try again.');
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Export failed. Try again.');
    } finally {
      setExporting(null);
    }
  };

  /** Render EVERY page, then hand all PNGs to the composer. */
  const doUse = async () => {
    setExporting('use');
    setExportErr(null);
    try {
      const blobs: Blob[] = [];
      for (let i = 0; i < project.pages.length; i++) {
        const blob = await exportPagePng(i);
        if (blob) blobs.push(blob);
      }
      if (blobs.length) {
        onUsePng(blobs, page.title.text || project.name, page.caption ?? '');
      } else {
        setExportErr('Could not render the pages. Try again.');
      }
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Export failed. Try again.');
    } finally {
      setExporting(null);
    }
  };

  if (!page) return null;

  const filmstrip = (
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
  );

  const busy = exporting !== null;
  const busyLabel =
    exporting === 'use' ? 'Rendering…' : exporting === 'all' ? 'Exporting…' : 'Saving PNG…';

  return (
    <div className="card overflow-hidden">
      {/* offscreen render host — every page, for exports */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', left: -99999, top: 0, width: 440, opacity: 0, pointerEvents: 'none' }}
      >
        <div ref={exportHostRef}>
          {project.pages.map((pg, i) => (
            <div key={pg.id} data-export-page={i}>
              <StudioCanvas page={pg} ratio={ratio} width={440} frame={false} />
            </div>
          ))}
        </div>
      </div>

      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
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
          onChange={(e) => commit((p) => ({ ...p, name: e.target.value }))}
          aria-label="Design name"
          className="min-w-0 flex-1 bg-transparent font-display text-sm font-extrabold outline-none"
        />
        <button
          type="button"
          onClick={undo}
          disabled={!past.length}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink disabled:opacity-30"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 4.5 4 8l3.5 3.5" />
            <path d="M4 8h8a4 4 0 0 1 0 8h-3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!future.length}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink disabled:opacity-30"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12.5 4.5 3.5 3.5-3.5 3.5" />
            <path d="M16 8H8a4 4 0 0 0 0 8h3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          aria-pressed={aiOpen}
          className={`btn shrink-0 !px-3.5 !py-2 !text-xs ${
            aiOpen ? 'btn-primary' : 'btn-ghost'
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M10 1.5 11.8 8.2 18.5 10 11.8 11.8 10 18.5 8.2 11.8 1.5 10 8.2 8.2 10 1.5Z" />
          </svg>
          AI
        </button>
        <button
          type="button"
          onClick={doDownloadAll}
          disabled={busy}
          className="btn btn-ghost shrink-0 !px-3.5 !py-2 !text-xs"
        >
          {exporting === 'all' ? 'Exporting…' : 'Download all'}
        </button>
        <button type="button" onClick={doSave} className="btn btn-ghost shrink-0 !px-3.5 !py-2 !text-xs">
          {savedFlash ? 'Saved ✓' : 'Save'}
        </button>
        <button type="button" onClick={doUse} disabled={busy} className="btn btn-primary shrink-0 !px-3.5 !py-2 !text-xs">
          {exporting === 'use' ? 'Rendering…' : 'Use in post'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        {/* stage */}
        <div className="flex flex-col items-center gap-2 border-b border-line bg-bone px-4 py-4 dark:bg-white/[0.02] lg:border-b-0 lg:border-r">
          {/* Page actions — top, icon only */}
          <div className="flex w-full max-w-[420px] flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={duplicatePage}
              aria-label="Duplicate page"
              title="Duplicate page"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-soft transition hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
                <path d="M13 4.5H5.5a2 2 0 0 0-2 2V14" />
              </svg>
            </button>
            {project.pages.length > 1 ? (
              <button
                type="button"
                onClick={deletePage}
                aria-label="Delete page"
                title="Delete page"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F0D9DA] bg-card text-[#9F2F2D] transition hover:bg-[#FDEBEC] dark:border-[#5b2a2a] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 5.5h13M8 5.5V3.8a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.7" />
                  <path d="M5.5 5.5 6.3 16a1.4 1.4 0 0 0 1.4 1.3h4.6a1.4 1.4 0 0 0 1.4-1.3l.8-10.5" />
                  <path d="M8.4 8.7v4.6M11.6 8.7v4.6" />
                </svg>
              </button>
            ) : null}
            <span className="flex-1" />
            <span className="text-[11px] font-bold text-faint">
              Page {pageIndex + 1} / {project.pages.length}
            </span>
          </div>

          {/* Filmstrip — always on top */}
          {project.pages.length > 1 ? filmstrip : null}

          {/* Canvas — pagination lives at the bottom, ‹ › on the sides */}
          <div className="w-full max-w-[420px]">
            <div ref={stageRef} className="mx-auto">
              <div ref={canvasHostRef}>
                <StudioCanvas page={page} ratio={ratio} width={stageW} />
              </div>
            </div>
          </div>

          {/* Bottom pagination — ‹ on the left, › on the right */}
          {project.pages.length > 1 ? (
            <div className="flex w-full max-w-[420px] items-center justify-between">
              <button
                type="button"
                onClick={() => selectPage(pageIndex - 1)}
                disabled={pageIndex === 0}
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-muted transition hover:bg-paper-dim hover:text-ink disabled:opacity-30"
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
                <span className="text-xs font-bold text-muted">
                  {pageIndex + 1} / {project.pages.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => selectPage(pageIndex + 1)}
                disabled={pageIndex >= project.pages.length - 1}
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-muted transition hover:bg-paper-dim hover:text-ink disabled:opacity-30"
              >
                ›
              </button>
            </div>
          ) : null}

          {/* Bottom downloads — single page */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={doDownloadPage}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-1.5 text-xs font-bold transition hover:bg-bone disabled:opacity-50 dark:hover:bg-white/5"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 3v8.5m0 0 3.5-3.5M10 11.5 6.5 8" />
                <path d="M3.5 14.5v1A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-1" />
              </svg>
              {exporting === 'page' ? busyLabel : 'Download page'}
            </button>
            {exportErr ? <p className="text-[11px] font-bold text-[#9F2F2D]">{exportErr}</p> : null}
          </div>
        </div>

        {/* sheet */}
        <div className="flex min-w-0 flex-col">
          <div className="flex border-b border-line px-2">
            {STEPS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setStep(t.id);
                  setAiOpen(false);
                }}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2.5 text-xs font-bold transition ${
                  !aiOpen && step === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <span className={`shrink-0 text-[11px] ${!aiOpen && step === t.id ? 'text-ink' : 'text-faint'}`}>
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
          <div className="min-h-0 max-h-[560px] flex-1 overflow-y-auto p-4 lg:max-h-none">
            {aiOpen ? (
              <AiStudioPanel
                template={page}
                onApply={applyAi}
                onClose={() => setAiOpen(false)}
              />
            ) : null}
            {!aiOpen && step === 'background' ? <BackgroundStep page={page} patchBackground={patchBackground} /> : null}
            {!aiOpen && step === 'title' ? <TitleStep page={page} patchTitle={patchTitle} patchPage={patchPage} /> : null}
            {!aiOpen && step === 'photo' ? <PhotoSocialsStep page={page} patchPfp={patchPfp} patchPage={patchPage} /> : null}
            {!aiOpen && step === 'content' ? <ContentStep page={page} patchPage={patchPage} /> : null}
            {!aiOpen && step === 'pages' ? (
              <PagesStep
                project={project}
                pageIndex={pageIndex}
                onSelect={selectPage}
                onAdd={addPage}
                onDuplicate={duplicatePage}
                onDelete={deletePage}
                onMove={movePage}
                onSize={(s) => commit((p) => ({ ...p, sizeId: s }))}
              />
            ) : null}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-muted">
            {aiOpen ? AI_TIP : STEP_TIPS[step]}
          </p>
        </div>
      </div>
    </div>
  );
}
