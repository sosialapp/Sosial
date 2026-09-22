'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Owner broadcast composer. Queues one send_push job; the worker delivers
 *  to every registered token and prunes dead ones from Expo receipts. */
export default function PushComposer({ audience }: { audience: number }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setErr('Title and body are required.');
      return;
    }
    if (
      !confirm(
        `Send "${t}" to ${audience} device${audience === 1 ? '' : 's'} now? This cannot be unsent.`,
      )
    ) {
      return;
    }
    setSending(true);
    setErr(null);
    setDone(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('send-notification', {
        body: { title: t, body: b },
      });
      if (error) throw new Error(error.message);
      if (!data?.queued) throw new Error(data?.error ?? 'Queue rejected the broadcast.');
      setTitle('');
      setBody('');
      setDone(`Queued for ${data.audience ?? audience} device${(data.audience ?? audience) === 1 ? '' : 's'}. The worker delivers within a minute.`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint';

  return (
    <div className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <label className="grid gap-1 text-xs font-bold text-muted">
        Title ({title.trim().length}/120)
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder="Something worth opening the app for"
          className={inputCls}
        />
      </label>
      <label className="grid gap-1 text-xs font-bold text-muted">
        Body ({body.trim().length}/500)
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="One or two sentences for the lock screen."
          className={inputCls}
        />
      </label>
      {err ? <p className="text-xs font-bold text-red-600">{err}</p> : null}
      {done ? <p className="text-xs font-bold text-green-700">{done}</p> : null}
      <div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || audience === 0}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone transition disabled:cursor-default disabled:opacity-40"
        >
          {sending ? 'Queueing…' : `Broadcast to ${audience} device${audience === 1 ? '' : 's'}`}
        </button>
        {audience === 0 ? (
          <p className="mt-2 text-xs text-muted">
            No devices registered yet. Open the app signed in on a physical device first.
          </p>
        ) : null}
      </div>
    </div>
  );
}
