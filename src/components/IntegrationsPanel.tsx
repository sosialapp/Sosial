import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTheme, Palette } from '../theme';
import SourceMark, { type SourceMarkId } from './SourceMarks';
import { filesConnected, loginGoogleFiles, disconnectGoogleFiles } from '../utils/driveAuth';
import { dropboxConnected, loginDropbox, disconnectDropbox } from '../utils/dropboxAuth';
import { canvaConnected, loginCanva, disconnectCanva } from '../utils/canvaAuth';

type RowId = 'google' | 'dropbox' | 'canva' | 'onedrive';

const ROWS: { id: RowId; label: string; sub: string; mark: SourceMarkId; soon?: boolean }[] = [
  { id: 'google', label: 'Google Drive & Photos', sub: 'Your files and photo library', mark: 'drive' },
  { id: 'dropbox', label: 'Dropbox', sub: 'Your Dropbox files', mark: 'dropbox' },
  { id: 'canva', label: 'Canva', sub: 'Your designs, exported to post', mark: 'canva' },
  { id: 'onedrive', label: 'OneDrive', sub: 'Coming soon', mark: 'onedrive', soon: true },
];

/**
 * Integrations tab of the Connect screen — media sources (composer inputs),
 * not publishing channels. Logins are device-local by design (SecureStore),
 * so this tab manages THIS device only; channels stay workspace-wide.
 */
export default function IntegrationsPanel() {
  const { C } = useTheme();
  const s = makeS(C);
  const [status, setStatus] = useState<Record<RowId, boolean>>({ google: false, dropbox: false, canva: false, onedrive: false });
  const [busy, setBusy] = useState<RowId | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [g, d, c] = await Promise.all([filesConnected(), dropboxConnected(), canvaConnected()]);
      setStatus({ google: !!g, dropbox: !!d, canva: !!c, onedrive: false });
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async (id: RowId) => {
    if (busy) return;
    setBusy(id);
    try {
      const ok =
        id === 'google' ? await loginGoogleFiles()
        : id === 'dropbox' ? await loginDropbox()
        : await loginCanva();
      if (!ok) {
        Alert.alert('Not connected', 'Sign-in was cancelled.');
        return;
      }
      await refresh();
    } catch (e: any) {
      Alert.alert('Could not connect', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (id: RowId, label: string) => {
    Alert.alert(`Disconnect ${label}?`, 'This forgets the login on this device. Your files stay untouched.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            if (id === 'google') await disconnectGoogleFiles();
            else if (id === 'dropbox') await disconnectDropbox();
            else await disconnectCanva();
            await refresh();
          } catch {}
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.note}>Media sources attach photos and videos to your posts. Logins live on this device only — reconnect on each device you post from.</Text>
      {ROWS.map((r) => {
        const on = status[r.id];
        const loading = busy === r.id;
        return (
          <View key={r.id} style={[s.row, !on && { opacity: r.soon ? 0.55 : 1 }]}>
            <SourceMark id={r.mark} size={22} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>{r.label}</Text>
              <Text style={s.rowS}>{r.soon ? 'Coming soon' : on ? 'Connected on this device' : r.sub}</Text>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={C.accentInk} />
            ) : r.soon ? (
              <Text style={s.soonBadge}>Soon</Text>
            ) : on ? (
              <TouchableOpacity onPress={() => void disconnect(r.id, r.label)} hitSlop={8}>
                <Text style={s.offT}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => void connect(r.id)} hitSlop={8} style={s.onBtn}>
                <Text style={s.onT}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  note: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.lineSoft },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 },
  onBtn: { backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  onT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.onInk },
  offT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.muted },
  soonBadge: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.faint, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
});
