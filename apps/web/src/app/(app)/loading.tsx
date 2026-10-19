import PageSkeleton from '@/components/PageSkeleton';

/**
 * Instant feedback for in-app navigations (Dock, links between queue / team /
 * analytics / channels). The masthead stays put; only the content slot shows
 * the skeleton until the next segment streams in.
 */
export default function Loading() {
  return <PageSkeleton />;
}
