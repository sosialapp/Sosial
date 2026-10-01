/**
 * Telegram's bundled mark includes its own disc — inside our badge/fallback
 * disc that reads as a small off-center button. The plane is everything after
 * the circle's closing z, rebased from relative to absolute (the circle starts
 * at 11.944,0 so m4.962 7.224 lands on M16.906 7.224). Derived from the path
 * data so the two can never drift; falls back to the full mark if upstream
 * reshapes it. Pure module (no JSX) so vitest can cover it.
 */
export function planeFromBundledMark(full: string): string {
  const tail = full.slice(full.indexOf('z') + 1);
  const prefix = 'm4.962 7.224';
  if (!tail.startsWith(prefix)) return full;
  return `M16.906 7.224${tail.slice(prefix.length)}`;
}
