'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import PurgeChannelDialog from './PurgeChannelDialog';

/**
 * Per-account actions for the web channels page.
 *
 * Disconnect calls remove-channel-token with the default mode: the channel is
 * revoked (tokens deleted, publishing paused) but post history and analytics
 * keep their destination. "Delete data" is the opt-in opposite -- it opens
 * PurgeChannelDialog, which erases every row that existed only for this account.
 */
export default function DisconnectChannel({
  workspaceId,
  provider,
  externalId,
  label,
}: {
  workspaceId: string;
  provider: string;
  externalId: string;
  label: string;
}) {
  const t = useT(appMessages);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const remove = async () => {
    if (!confirm(t('wcDisconnectQ'))) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('remove-channel-token', {
        body: { workspace_id: workspaceId, provider, external_id: externalId },
      });
      if (error) throw new Error(error.message);
      // functions.invoke can resolve with the error in the body instead of
      // throwing, never treat that as a success or the row silently stays.
      const bodyError =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error?: unknown }).error ?? '')
          : '';
      if (bodyError) throw new Error(bodyError);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('wcDisconnectFailed'));
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
        onClick={() => setPurgeOpen(true)}
        disabled={busy}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-[#9F2F2D] transition hover:bg-[#FDEBEC] disabled:opacity-50 dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]"
      >
        {t('wcDeleteData')}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-bold text-muted transition hover:border-[#9F2F2D] hover:text-[#9F2F2D] disabled:opacity-50 dark:hover:border-[#f2a8a8] dark:hover:text-[#f2a8a8]"
      >
        {busy ? t('wcDisconnecting') : t('wcDisconnect')}
      </button>
      {purgeOpen ? (
        <PurgeChannelDialog
          workspaceId={workspaceId}
          provider={provider}
          externalId={externalId}
          label={label}
          onClose={() => setPurgeOpen(false)}
          onDone={() => {
            setPurgeOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </span>
  );
}