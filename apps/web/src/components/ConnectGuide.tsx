'use client';

import { useEffect, useState } from 'react';

/** Web can't OAuth (yet) — this opens the how-to-connect sheet instead of a dead button. */
export default function ConnectGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open ]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary shrink-0">
        + Connect accounts
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Connect accounts">
          <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-black/40" />
          <div className="card relative w-full max-w-sm p-6">
            <p className="eyebrow">Connect accounts</p>
            <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight">Link from the mobile app</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                ['1', 'Open the Sosial app on your phone and sign in to this workspace.'],
                ['2', 'Go to Connect and link each social account.'],
                ['3', 'Come back here. Accounts (with profile pictures) appear automatically.'],
              ].map(([n, text]) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
                    {n}
                  </span>
                  <span className="leading-relaxed text-soft">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl bg-bone px-3 py-2.5 text-xs leading-relaxed text-muted dark:bg-white/5">
              Connecting directly on the web is coming soon. The mobile flow stays put either way.
            </p>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost mt-4 w-full">
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
