'use client';

import { providerStatus, type CompatIssue } from '@/lib/compat';
import { providerMeta } from '@/lib/providers';
import { CheckIcon, CrossIcon } from '@/components/StatusIcons';

/**
 * Content compatibility (§6): per-channel verdicts that update live as the
 * draft changes — ✓ ready, ! warning, × blocked with the reason inline.
 * Errors also block scheduling in the submit guards.
 */
export default function CompatibilityPanel({
  providers,
  issues,
}: {
  providers: string[];
  issues: CompatIssue[];
}) {
  if (providers.length === 0) return null;
  const blockers = issues.filter((i) => i.level === 'error').length;
  return (
    <div
      className="mt-3 rounded-2xl border border-line p-4"
      aria-live="polite"
      aria-label="Content compatibility"
    >
      <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
        Content compatibility
        {blockers > 0 ? ` · ${blockers} blocker${blockers === 1 ? '' : 's'}` : ''}
      </p>
      <ul className="mt-2 space-y-1.5">
        {providers.map((p) => {
          const st = providerStatus(p, issues);
          const mine = issues.filter((i) => i.provider === p);
          return (
            <li key={p} className="text-sm">
              <span
                aria-hidden="true"
                className={`mr-1.5 inline-flex ${
                  st === 'ok' ? 'text-green-700' : st === 'warn' ? 'text-amber-600' : 'text-red-600'
                }`}
              >
                {st === 'ok' ? <CheckIcon size={14} /> : st === 'warn' ? '!' : <CrossIcon size={13} />}
              </span>
              <span className="font-bold">{providerMeta(p).label}</span>
              {mine.map((m, j) => (
                <span key={j} className="block pl-5 text-xs text-muted">
                  {m.message}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
