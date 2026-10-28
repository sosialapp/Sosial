'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** "Copy" in the article header: the whole page as Markdown, ready to paste
 *  into an AI chat or a ticket. */
export default function DocsCopyPage({ markdown }: { markdown: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setState('done');
    } catch {
      setState('fail');
    }
    setTimeout(() => setState('idle'), 1600);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy this page as Markdown"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-ink/75 transition hover:bg-surface hover:text-ink"
    >
      {state === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {state === 'done' ? 'Copied' : state === 'fail' ? 'Copy failed' : 'Copy'}
    </button>
  );
}
