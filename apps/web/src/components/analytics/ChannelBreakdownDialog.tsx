'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import { HBarList, type HBarRow } from '@/components/ui/chart';

/**
 * Full per-channel analytics breakdown, opened from the "See all" button on the
 * dashboard card (which only shows the top four). Hand-rolled portal modal
 * (same pattern as PostPreviewDialog): Escape and a backdrop click both close.
 */
export default function ChannelBreakdownDialog({
  open,
  onClose,
  rows,
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  rows: HBarRow[];
  subtitle?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Channel breakdown"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-[0_24px_70px_-24px_rgba(0,0,0,0.5)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold text-ink">Channel breakdown</h2>
            <p className="mt-0.5 text-xs text-muted">
              {subtitle ?? `Interactions, audience and engagement per channel · ${rows.length} channels`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-paper-dim hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <HBarList rows={rows} />
        </div>
        <div className="shrink-0 border-t border-line-soft px-4 py-3">
          <Link
            href="/channels"
            onClick={onClose}
            className="inline-flex items-center text-xs font-bold text-ink hover:underline"
          >
            Manage channels
          </Link>
        </div>
      </div>
    </div>,
    document.querySelector('[data-theme-root]') ?? document.body,
  );
}
