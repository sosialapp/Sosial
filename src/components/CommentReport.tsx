import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Palette, useTheme } from '../theme';
import { supabase, currentSession } from '../utils/supabase';
import { SOCIAL_META } from '../constants';
import { SocialGlyph } from './ui';
import { tr } from '../i18n';

/**
 * Comment report, mobile parity with the web Analytics card. Read-only:
 * counts the rows the comment sync already stored, for the same range and
 * channel filter as the screen above. No platform API calls, no writes.
 */

interface Row {
  id: string;
  channel_id: string;
  platform: string;
  author_name: string | null;
  body: string;
  created_at: string;
  status: string;
  is_own: boolean;
}

interface Channel {
  id: string;
  provider: string;
  display_name: string | null;
}

interface GroupRow {
  id: string;
  provider: string;
  total: number;
  replied: number;
  waiting: number;
}

const DAY = 86400000;
const csvCell = (v: string | number | null): string => {
  let s = v === null ? '' : String(v);
  // Stop spreadsheet formula injection from platform comment text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '-';

export default function CommentReport({
  from,
  to,
  channelIds,
  channels,
  rangeLabel,
}: {
  from: number;
  to: number;
  channelIds: string[];
  channels: Channel[];
  rangeLabel: string;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [all, setAll] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const session = await currentSession().catch(() => null);
        if (!session) return;
        const since = new Date(Date.now() - 365 * DAY).toISOString();
        const { data, error } = await supabase()
          .from('comments')
          .select('id,channel_id,platform,author_name,body,created_at,status,is_own')
          .eq('workspace_id', session.workspace.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5000);
        if (!alive) return;
        if (!error) setAll((data ?? []) as Row[]);
      } catch {
        /* the card just stays empty */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const labelOf = (channelId: string, platform: string): string => {
    const c = channels.find((x) => x.id === channelId);
    return c?.display_name?.trim() || SOCIAL_META[platform]?.label || platform;
  };

  const rows = useMemo(
    () =>
      all.filter((r) => {
        if (r.is_own) return false;
        const ts = Date.parse(r.created_at);
        if (!Number.isFinite(ts) || ts < from || ts > to) return false;
        return channelIds.length === 0 || channelIds.includes(r.channel_id);
      }),
    [all, from, to, channelIds],
  );

  const replied = rows.filter((r) => r.status === 'replied').length;
  const waiting = rows.filter((r) => r.status === 'new').length;
  const moderated = rows.filter((r) => r.status === 'hidden' || r.status === 'deleted').length;

  const groups = useMemo(() => {
    const map = new Map<string, GroupRow>();
    for (const r of rows) {
      const g = map.get(r.channel_id) ?? {
        id: r.channel_id,
        provider: r.platform,
        total: 0,
        replied: 0,
        waiting: 0,
      };
      g.total += 1;
      if (r.status === 'replied') g.replied += 1;
      if (r.status === 'new') g.waiting += 1;
      map.set(r.channel_id, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const shareCsv = async (): Promise<void> => {
    if (busy || rows.length === 0) return;
    setBusy(true);
    try {
      const head = ['Date', 'Platform', 'Account', 'Author', 'Status', 'Comment'];
      const lines = rows.map((r) =>
        [
          new Date(r.created_at).toISOString(),
          r.platform,
          labelOf(r.channel_id, r.platform),
          r.author_name,
          r.status,
          r.body,
        ]
          .map(csvCell)
          .join(','),
      );
      const csv = `\uFEFF${[head.join(','), ...lines].join('\r\n')}`;
      const name = `sosial-comments-${new Date().toISOString().slice(0, 10)}.csv`;
      const dir = FileSystem.cacheDirectory;
      if (!dir) throw new Error('No cache directory');
      const uri = `${dir}${name}`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: name });
      } else {
        Alert.alert(tr('crExport'), 'Sharing is not available on this device.');
      }
    } catch {
      Alert.alert(tr('crExport'), 'Could not create the CSV file.');
    } finally {
      setBusy(false);
    }
  };

  const tiles = [
    { key: 'crTotal', value: String(rows.length) },
    { key: 'crReplied', value: String(replied) },
    { key: 'crWaiting', value: String(waiting) },
    { key: 'crModerated', value: String(moderated) },
    { key: 'crRate', value: pct(replied, rows.length) },
  ];

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 26 }}>
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>{tr('crTitle')}</Text>
          <Text style={s.sub}>{tr('crSub').replace('{range}', rangeLabel.toLowerCase())}</Text>
        </View>
        <TouchableOpacity
          onPress={() => void shareCsv()}
          disabled={rows.length === 0 || busy}
          activeOpacity={0.75}
          accessibilityLabel={tr('crExport')}
          style={[s.exportBtn, (rows.length === 0 || busy) && { opacity: 0.5 }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={C.ink} />
          ) : (
            <Ionicons name="download-outline" size={14} color={C.ink} />
          )}
          <Text style={s.exportT}>{tr('crExport')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.state}>
          <ActivityIndicator color={C.accent} />
          <Text style={s.stateT}>{tr('crLoading')}</Text>
        </View>
      ) : (
        <>
          <View style={s.tiles}>
            {tiles.map((tile) => (
              <View key={tile.key} style={s.tile}>
                <Text style={s.tileK}>{tr(tile.key)}</Text>
                <Text style={s.tileV}>{tile.value}</Text>
              </View>
            ))}
          </View>

          {rows.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.stateT}>{tr('crEmpty')}</Text>
            </View>
          ) : (
            <View style={[s.card, { marginTop: 10, paddingVertical: 4 }]}>
              <View style={s.rowHead}>
                <Text style={[s.rowHeadT, { flex: 1 }]}>{tr('crAccount')}</Text>
                <Text style={[s.rowHeadT, { width: 40, textAlign: 'right' }]}>{tr('crTotal')}</Text>
                <Text style={[s.rowHeadT, { width: 40, textAlign: 'right' }]}>{tr('crReplied')}</Text>
                <Text style={[s.rowHeadT, { width: 40, textAlign: 'right' }]}>{tr('crWaiting')}</Text>
                <Text style={[s.rowHeadT, { width: 44, textAlign: 'right' }]}>{tr('crRate')}</Text>
              </View>
              {groups.map((g, i) => (
                <View key={g.id} style={[s.row, i > 0 && s.divider]}>
                  <View style={s.rowWho}>
                    <View style={[s.avatar, { backgroundColor: SOCIAL_META[g.provider]?.bg ?? C.ink }]}>
                      <SocialGlyph platform={g.provider} size={12} color="#fff" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowT} numberOfLines={1}>
                        {labelOf(g.id, g.provider)}
                      </Text>
                      <Text style={s.rowS} numberOfLines={1}>
                        {SOCIAL_META[g.provider]?.label ?? g.provider}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.num, { width: 40 }]}>{g.total}</Text>
                  <Text style={[s.num, { width: 40 }]}>{g.replied}</Text>
                  <Text style={[s.num, { width: 40 }]}>{g.waiting}</Text>
                  <Text style={[s.num, { width: 44 }]}>{pct(g.replied, g.total)}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.note}>{tr('crNote')}</Text>
        </>
      )}
    </View>
  );
}

function makeS(C: Palette) {
  return StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: C.ink },
    sub: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 12.5,
      lineHeight: 18,
      color: C.muted,
      marginTop: 2,
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.lineSoft,
      backgroundColor: C.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    exportT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.ink },
    state: { paddingVertical: 30, alignItems: 'center', gap: 8 },
    stateT: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 12.5,
      color: C.muted,
      textAlign: 'center',
    },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    tile: {
      width: '31.5%',
      minWidth: 96,
      flexGrow: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.lineSoft,
      backgroundColor: C.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    tileK: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 10,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: C.faint,
    },
    tileV: {
      fontFamily: 'PlusJakartaSans_800ExtraBold',
      fontSize: 19,
      color: C.ink,
      marginTop: 3,
      fontVariant: ['tabular-nums'],
    },
    empty: {
      marginTop: 10,
      borderRadius: 18,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.lineSoft,
      paddingVertical: 22,
      paddingHorizontal: 16,
    },
    card: {
      backgroundColor: C.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.lineSoft,
      paddingHorizontal: 14,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    rowHeadT: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 9.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: C.faint,
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    divider: { borderTopWidth: 1, borderTopColor: C.lineSoft },
    rowWho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink },
    rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10.5, color: C.faint, marginTop: 1 },
    num: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 12,
      color: C.ink,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    note: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 11,
      lineHeight: 16,
      color: C.faint,
      marginTop: 10,
    },
  });
}
