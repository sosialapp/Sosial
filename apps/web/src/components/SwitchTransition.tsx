'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

/**
 * Paints a skeleton the instant a team is picked, instead of leaving the old
 * page frozen until the server re-render lands. router.refresh() gives no
 * pending signal of its own, so we run it in a transition and hold our own flag
 * that clears when the server props carry the new workspace id (or when the
 * caller cancels on failure).
 */
interface SwitchState {
  pending: boolean;
  refresh: () => void;
  cancel: () => void;
}

const SwitchContext = createContext<SwitchState | null>(null);

export function useSwitchTransition(): SwitchState {
  const ctx = useContext(SwitchContext);
  if (!ctx) throw new Error('useSwitchTransition must be used inside <SwitchTransition>');
  return ctx;
}

export default function SwitchTransition({
  currentId,
  children,
}: {
  currentId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  // The server props are authoritative: once the new team id lands, the fresh
  // page has rendered, so the skeleton comes down.
  useEffect(() => {
    setPending(false);
  }, [currentId]);

  const refresh = useCallback(() => {
    setPending(true);
    startTransition(() => router.refresh());
  }, [router, startTransition]);

  const cancel = useCallback(() => setPending(false), []);

  const value = useMemo(() => ({ pending, refresh, cancel }), [pending, refresh, cancel]);
  return <SwitchContext.Provider value={value}>{children}</SwitchContext.Provider>;
}
