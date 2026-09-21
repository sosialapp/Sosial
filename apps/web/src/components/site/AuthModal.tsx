'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import LoginForm from '../LoginForm';

/**
 * Sign-in popup for the marketing site header. Same form and logic as the
 * /login page (which stays as the fallback for direct visits, invites and
 * auth-gate redirects) — just presented as a modal with focus trap,
 * Escape/backdrop close and scroll lock.
 */
export default function AuthModal({
  open,
  mode,
  onClose,
}: {
  open: boolean;
  mode: 'in' | 'up';
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    }, 40);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portalled to <body>: the header and hero use backdrop-filter/transform,
  // which create a containing block that would trap `fixed` inside them.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={mode === 'in' ? 'Sign in to Sosial' : 'Create your Sosial account'}
          className="relative my-auto w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]"
        >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-bone hover:text-ink"
        >
          ✕
        </button>
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center">
            <Image src="/bolt.png" alt="" width={34} height={34} aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">
              {mode === 'in' ? 'Welcome back' : 'Get started free'}
            </p>
            <p className="text-xs text-muted">
              {mode === 'in' ? 'Sign in to your workspace' : 'Free forever plan · No credit card'}
            </p>
          </div>
        </div>
        <LoginForm key={mode} initialMode={mode} compact />
        </div>
      </div>
    </div>,
    document.body,
  );
}
