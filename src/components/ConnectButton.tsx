import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, AppState } from 'react-native';
import { useTheme } from '../theme';
import { SocialGlyph } from './ui';
import { SOCIAL_META } from '../constants';
import { loadMetaState, connectedChannelIds } from '../utils/metaStore';

/** Masthead Connect pill — shows stacked brand tiles for every channel that
 *  can actually publish right now (same connectedChannelIds truth as the
 *  composer — identity without live credentials never shows as live). */
export default function ConnectButton({ onPress }: { onPress: () => void }) {
  const { C } = useTheme();
  const [connected, setConnected] = useState<string[]>([]);
  const MAX_LOGOS = 4;
  const shown = connected.slice(0, MAX_LOGOS);
  const extra = connected.length - shown.length;

  useEffect(() => {
    const reload = async () => {
      try {
        const m = await loadMetaState();
        setConnected(connectedChannelIds(m));
      } catch {}
    };
    void reload();
    // Channels connected elsewhere (web pull, Connect screen) land after
    // this pill mounts — refresh on foreground so the logos never go stale.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void reload();
    });
    return () => sub.remove();
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.lineSoft }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {connected.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {shown.map((p, i) => (
              <View
                key={p}
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: SOCIAL_META[p]?.bg ?? C.ink,
                  alignItems: 'center', justifyContent: 'center',
                  marginLeft: i === 0 ? 0 : -7,
                  borderWidth: 1.5, borderColor: C.card,
                }}
              >
                <SocialGlyph platform={p} size={10} color="#fff" />
              </View>
            ))}
            {extra > 0 ? (
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted, marginLeft: 1 }}>+{extra}</Text>
            ) : null}
          </View>
        ) : null}
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accentInk }}>Connect</Text>
      </View>
    </TouchableOpacity>
  );
}
