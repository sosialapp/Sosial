'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invokeStock } from '@/lib/cloudSources';

interface Board {
  id: string;
  name: string;
}

/**
 * Pinterest destination board for a connected account. The board id lives on
 * the channel's metadata (worker refuses to publish without it), but the
 * browser can't read the Vault token, so listing/saving goes through the
 * `pin-boards` edge function.
 */
export default function PinBoardPicker({
  workspaceId,
  channelId,
  currentBoardId,
  currentBoardName,
  canManage,
}: {
  workspaceId: string;
  channelId: string;
  currentBoardId?: string;
  currentBoardName?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [selected, setSelected] = useState(currentBoardId ?? '');
  const [saved, setSaved] = useState(currentBoardName ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const j = await invokeStock('pin-boards', {
          workspace_id: workspaceId,
          action: 'list',
          channel_id: channelId,
        });
        if (alive) setBoards(Array.isArray(j?.boards) ? (j.boards as Board[]) : []);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not read your boards.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId, channelId]);

  const save = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const name = boards?.find((b) => b.id === selected)?.name ?? '';
      await invokeStock('pin-boards', {
        workspace_id: workspaceId,
        action: 'set',
        channel_id: channelId,
        board_id: selected,
        board_name: name,
      });
      setSaved(name);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the board.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-xl border border-line bg-paper px-3 py-2.5">
      <p className="text-xs font-bold">Pin destination board</p>
      <p className="-mt-1 text-[11px] text-muted">
        Every Pin from this account lands on the board you pick.
      </p>
      {err ? (
        <p className="text-[11px] font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{err}</p>
      ) : boards === null ? (
        <p className="text-[11px] text-faint">Loading boards…</p>
      ) : boards.length === 0 ? (
        <p className="text-[11px] text-muted">
          No boards found on this account. Create one in Pinterest, then reload.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!canManage || busy}
            className="field min-w-0 flex-1 !py-1.5 !text-xs"
          >
            <option value="">Choose a board…</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canManage || busy || !selected || selected === (currentBoardId ?? '')}
            className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
      {saved && !err ? (
        <p className="text-[11px] font-bold text-muted">Pins publish to “{saved}”.</p>
      ) : null}
      {!canManage ? (
        <p className="text-[11px] text-faint">Only owners and admins can change the board.</p>
      ) : null}
    </div>
  );
}
