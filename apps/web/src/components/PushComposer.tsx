'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EmojiInput, EmojiTextarea } from '@/components/Emoji';

export interface AudienceCounts {
  ios: number;
  android: number;
}

const KINDS: { value: string; label: string }[] = [
  { value: 'update', label: 'Product update' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'policy', label: 'Policy / terms' },
  { value: 'bug', label: 'Bug notice' },
];

const PLATFORMS: { value: string; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

/** Owner broadcast composer. Writes one `announcements` row (the bell) and
 *  queues one send_push job the worker fans out to the selected platforms. */
export default function PushComposer({ counts }: { counts: AudienceCounts }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('update');
  const [platforms, setPlatforms] = useState<string[]>(['web', 'ios', 'android']);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const toggle = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Devices that will actually get a push: web is bell-only.
  const devices =
    (platforms.includes('ios') ? counts.ios : 0) +
    (platforms.includes('android') ? counts.android : 0);

  const send = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setErr('Title and body are required.');
      return;
    }
    if (platforms.length === 0) {
      setErr('Pick at least one platform.');
      return;
    }
    const scope = platforms.length === 3 ? 'everyone' : platforms.join(' + ');
    if (
      !confirm(
        `Send "${t}" to the in-app bell for ${scope}` +
          (devices > 0 ? ` and ${devices} device${devices === 1 ? '' : 's'}` : '') +
          `? This cannot be unsent.`,
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
        body: { title: t, body: b, kind, platforms },
      });
      if (error) throw new Error(error.message);
      if (!data?.announcement_id) throw new Error(data?.error ?? 'The console rejected it.');
      setTitle('');
      setBody('');
      setDone(
        `Saved to the bell. ` +
          (data.queued
            ? `${data.audience ?? devices} device${(data.audience ?? devices) === 1 ? '' : 's'} push within a minute.`
            : 'No push queued (web-only).'),
      );
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-muted">
          Category
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={inputCls}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-1 text-xs font-bold text-muted">
          Send to
          <div className="flex gap-1.5">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggle(p.value)}
                  aria-pressed={on}
                  className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition ${
                    on
                      ? 'border-ink bg-ink text-bone'
                      : 'border-line bg-paper text-soft hover:bg-bone'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <label className="grid gap-1 text-xs font-bold text-muted">
        Title ({title.trim().length}/120)
        <EmojiInput
          value={title}
          onChange={(v) => setTitle(v.slice(0, 120))}
          placeholder="Something worth opening the app for"
          className={inputCls}
        />
      </label>
      <label className="grid gap-1 text-xs font-bold text-muted">
        Body ({body.trim().length}/500)
        <EmojiTextarea
          value={body}
          onChange={(v) => setBody(v.slice(0, 500))}
          rows={3}
          placeholder="One or two sentences for the bell and the lock screen."
          className={inputCls}
        />
      </label>
      <p className="text-[11px] leading-relaxed text-muted">
        Lands in the in-app bell for the selected platforms
        {devices > 0 ? `, plus a push to ${devices} device${devices === 1 ? '' : 's'}` : '.'} iOS and
        Android need an installed build (Expo Go cannot receive remote push).
      </p>
      {err ? <p className="text-xs font-bold text-red-600">{err}</p> : null}
      {done ? <p className="text-xs font-bold text-green-700">{done}</p> : null}
      <div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || platforms.length === 0}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone transition disabled:cursor-default disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Send announcement'}
        </button>
      </div>
    </div>
  );
}
