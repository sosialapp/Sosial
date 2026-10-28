export type TourId = 'dashboard' | 'post' | 'analytics' | 'community';

/** One hop: `target` is a `data-tour` attribute value in the DOM. */
export type TourStep = {
  target: string;
  title: string;
  body: string;
};

/**
 * Short, page-scoped walkthroughs. Four hops at most, because anything longer
 * gets skipped. The copy names the thing you can do, not the feature.
 */
export const TOURS: Record<TourId, TourStep[]> = {
  dashboard: [
    { target: 'dock', title: 'tdDockT', body: 'tdDockB' },
    { target: 'dashboard-create', title: 'tdCreateT', body: 'tdCreateB' },
    { target: 'dashboard-week', title: 'tdWeekT', body: 'tdWeekB' },
    { target: 'community-badge', title: 'tdInboxT', body: 'tdInboxB' },
  ],
  post: [
    { target: 'composer-channels', title: 'tpChannelsT', body: 'tpChannelsB' },
    { target: 'composer-ai', title: 'tpAiT', body: 'tpAiB' },
    { target: 'composer-when', title: 'tpWhenT', body: 'tpWhenB' },
  ],
  analytics: [
    { target: 'analytics-range', title: 'taRangeT', body: 'taRangeB' },
    { target: 'analytics-comments', title: 'taCommentsT', body: 'taCommentsB' },
  ],
  community: [
    { target: 'community-filters', title: 'tcFiltersT', body: 'tcFiltersB' },
    { target: 'community-reply', title: 'tcReplyT', body: 'tcReplyB' },
  ],
};

/** Which tour belongs to a route, if any. */
export function tourFor(pathname: string): TourId | null {
  if (pathname.startsWith('/dashboard') || pathname === '/queue') return 'dashboard';
  if (pathname.startsWith('/post') || pathname.startsWith('/composer')) return 'post';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/community')) return 'community';
  return null;
}

export const STORAGE_PREFIX = 'sosial-tour-v1:';

export const storageKey = (id: TourId) => `${STORAGE_PREFIX}${id}`;

/** Every page key this version knows; used by "show me around again". */
export const ALL_TOUR_IDS = Object.keys(TOURS) as TourId[];

/** Forget every page. The next visit starts the walkthrough again. */
export function clearTourSeen(): void {
  try {
    for (const id of ALL_TOUR_IDS) window.localStorage.removeItem(storageKey(id));
  } catch {
    /* private mode: nothing persisted, nothing to clear */
  }
}