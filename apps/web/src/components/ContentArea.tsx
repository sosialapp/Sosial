'use client';

import type { ReactNode } from 'react';
import { useSwitchTransition } from './SwitchTransition';
import PageSkeleton from './PageSkeleton';

/**
 * The page slot in the app shell. While a workspace switch is in flight it
 * swaps the (stale) page for the skeleton, so the swap reads as instant and the
 * new team's data streams into a stable frame.
 */
export default function ContentArea({ children }: { children: ReactNode }) {
  const { pending } = useSwitchTransition();
  return <>{pending ? <PageSkeleton /> : children}</>;
}
