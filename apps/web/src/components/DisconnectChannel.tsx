'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Per-account disconnect for the web channels page. Calls the
 * remove-channel-token edge function (server deletes the channel row and
 * its vault secrets), then refreshes the server-rendered list.
 */
export default function DisconnectChannel({
  workspaceId,
  provider,
  externalId,
}: {
  workspaceId: string;
  provider: string;
  externalId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remove = async () => {
    if (
      !confirm(
        'Disconnect this account? Its stored tokens are deleted and scheduled posts for it pause until you reconnect.',
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.functions.invoke('remove-channel-token', {
        body: { workspace_id: workspaceId, provider, external_id: externalId },
      });
      if (error) throw new Error(error.message);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex shrink-0 items-center gap-2">
      {err ? (
        <span className="max-w-40 truncate text-[11px] text-[#9F2F2D] dark:text-[#f2a8a8]" title={err}>
          {err}
        </span>
      ) : null}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-xs font-bold text-muted transition hover:text-ink disabled:opacity-50"
      >
        {busy ? 'Removing…' : 'Remove'}
      </button>
    </span>
  );
}
