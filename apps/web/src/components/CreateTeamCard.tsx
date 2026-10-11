'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "Create new team" card for the team page — the form that used to live in
 * the masthead dropdown. Plan limits are enforced by the DB's
 * WORKSPACE_LIMIT trigger and surfaced as the error message; on success the
 * new workspace becomes the active one and the whole tree refreshes.
 */
export default function CreateTeamCard() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? 'Could not create the team.');
        return;
      }
      setName('');
      router.refresh();
    } catch {
      setErr('Network error — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="font-display text-sm font-extrabold">Create new team</p>
        <p className="mt-0.5 text-xs text-muted">
          A separate workspace with its own members, channels and calendar.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
          placeholder="Team name"
          className="field"
          aria-label="New team name"
        />
        <button
          type="button"
          onClick={create}
          disabled={busy || !name.trim()}
          className="btn btn-primary shrink-0"
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
      {err ? <p className="text-[11px] font-semibold text-[#9F2F2D]">{err}</p> : null}
    </div>
  );
}
