'use client';

import { useCallback, useEffect, useState } from 'react';
import { SourceMark } from '@/components/SourceMarks';
import {
  cloudConnected, loginCloud, disconnectCloud, type CloudProvider,
} from '@/lib/cloudSources';

const ROWS: { id: CloudProvider | 'onedrive'; label: string; sub: string; mark: string; soon?: boolean }[] = [
  { id: 'google', label: 'Google Drive & Photos', sub: 'Your files and photo library', mark: 'drive' },
  { id: 'dropbox', label: 'Dropbox', sub: 'Your Dropbox files', mark: 'dropbox' },
  { id: 'canva', label: 'Canva', sub: 'Your designs, exported to post', mark: 'canva' },
  { id: 'onedrive', label: 'OneDrive', sub: 'Coming soon', mark: 'onedrive', soon: true },
];

/**
 * Integrations tab of the channels page — media sources (composer inputs),
 * not publishing channels. Logins live in this browser only (never our
 * servers), so this tab manages THIS browser; channels stay workspace-wide.
 */
export default function IntegrationsTab() {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      setStatus({
        google: cloudConnected('google'),
        dropbox: cloudConnected('dropbox'),
        canva: cloudConnected('canva'),
      });
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = async (id: CloudProvider) => {
    if (busy) return;
    setBusy(id);
    setErr(null);
    try {
      const ok = await loginCloud(id);
      if (!ok) {
        setErr('Sign-in was cancelled.');
        return;
      }
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = (id: CloudProvider, label: string) => {
    if (!window.confirm(`Disconnect ${label}? This forgets the login in this browser. Your files stay untouched.`)) return;
    disconnectCloud(id);
    refresh();
  };

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted">
        Media sources attach photos and videos to your posts. Logins stay in this browser only — reconnect in each browser you post from.
      </p>
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}
      <section aria-label="Integrations" className="overflow-hidden rounded-2xl border border-line bg-card">
        {ROWS.map((r, i) => {
          const on = !!status[r.id];
          return (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-line-soft' : ''} ${r.soon ? 'opacity-55' : ''}`}>
              {r.id === 'google' ? (
                <span className="relative flex h-6 w-8 shrink-0 items-center">
                  <SourceMark id="drive" className="flex h-[22px] w-[22px] items-center justify-center [&_svg]:h-full [&_svg]:w-full" />
                  <span className="absolute left-[10px] top-1/2 -translate-y-1/2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card pl-0.5 [&_svg]:h-full [&_svg]:w-full">
                    <SourceMark id="gphotos" />
                  </span>
                </span>
              ) : (
                <SourceMark id={r.mark} className="flex h-6 w-6 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{r.label}</p>
                <p className="text-xs text-muted">{r.soon ? 'Coming soon' : on ? 'Connected in this browser' : r.sub}</p>
              </div>
              {busy === r.id ? (
                <span className="text-xs font-bold text-muted">…</span>
              ) : r.soon ? (
                <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-faint">Soon</span>
              ) : on ? (
                <button
                  type="button"
                  onClick={() => disconnect(r.id as CloudProvider, r.label)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-muted transition hover:text-ink"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void connect(r.id as CloudProvider)}
                  className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-paper transition hover:opacity-90"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
