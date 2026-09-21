'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'in' ? 'Sign in to Sosial' : 'Create your Sosial account'}
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]"
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
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bone ring-1 ring-line">
            <Image src="/bolt.png" alt="" width={28} height={28} aria-hidden="true" />
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
  );
}
