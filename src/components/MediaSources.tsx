import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  FlatList, Image, ActivityIndicator, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette } from '../theme';
import { searchStock, downloadStockItem, unsplashCredit, type StockItem } from '../utils/stockMedia';

export interface SourceAttachment {
  uri: string;
  kind: 'image' | 'video';
}

type Source = 'pexels' | 'unsplash';

const SOURCES: { id: Source; label: string; icon: string; note: string }[] = [
  { id: 'pexels', label: 'Pexels', icon: 'images-outline', note: 'Photos + videos, free to use' },
  { id: 'unsplash', label: 'Unsplash', icon: 'camera-outline', note: 'Photos · credit auto-added' },
];

/**
 * Media sources browser (inline view — never a Modal, because iOS cannot
 * reliably present a modal over the composer sheet's Modal). Hosts render it
 * full-screen (a Modal of their own) or swap it into their layout.
 * Cloud drives (Drive/Photos/Dropbox/OneDrive) land as tiles here as they ship.
 * Emits composer-ready attachments; Unsplash items also return a credit line
 * the caller appends to the caption.
 */
export default function MediaSources({
  onPickLocal,
  onAttach,
  onClose,
}: {
  onPickLocal: () => void;
  onAttach: (items: SourceAttachment[], credit?: string) => void;
  onClose: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [source, setSource] = useState<Source | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'photo' | 'video'>('photo');
  const [items, setItems] = useState<StockItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const search = async () => {
    if (!source || !query.trim() || busy) return;
    setBusy(true);
    try {
      setItems(await searchStock(source, query.trim(), source === 'pexels' ? type : 'photo'));
    } catch (e: any) {
      Alert.alert('Search failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (item: StockItem) => {
    if (downloading) return;
    setDownloading(item.id);
    try {
      const att = await downloadStockItem(item);
      onAttach([att], item.source === 'unsplash' ? unsplashCredit(item) : undefined);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message ?? 'Try another one.');
    } finally {
      setDownloading(null);
    }
  };

  const openSource = (id: Source) => {
    setSource(id);
    setItems([]);
    setQuery('');
    if (id === 'unsplash') setType('photo');
  };

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.title}>Add media</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close-circle" size={24} color={C.muted} />
        </TouchableOpacity>
      </View>

      {!source ? (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => { onClose(); onPickLocal(); }}
            activeOpacity={0.75}
            style={s.tile}
          >
            <Ionicons name="images-outline" size={22} color={C.accentInk} />
            <View style={{ flex: 1 }}>
              <Text style={s.tileT}>Camera roll</Text>
              <Text style={s.tileS}>Photos and videos on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </TouchableOpacity>
          {SOURCES.map((src) => (
            <TouchableOpacity key={src.id} onPress={() => openSource(src.id)} activeOpacity={0.75} style={s.tile}>
              <Ionicons name={src.icon as any} size={22} color={C.accentInk} />
              <View style={{ flex: 1 }}>
                <Text style={s.tileT}>{src.label}</Text>
                <Text style={s.tileS}>{src.note}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => { setSource(null); setItems([]); }} style={s.back}>
            <Ionicons name="chevron-back" size={16} color={C.accentInk} />
            <Text style={s.backT}>{source === 'pexels' ? 'Pexels' : 'Unsplash'}</Text>
          </TouchableOpacity>
          <View style={s.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search stock…"
              placeholderTextColor={C.faint}
              style={s.search}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <TouchableOpacity onPress={search} style={s.go} activeOpacity={0.75}>
              {busy ? <ActivityIndicator size="small" color={C.onInk} /> : <Text style={s.goT}>Go</Text>}
            </TouchableOpacity>
          </View>
          {source === 'pexels' ? (
            <View style={s.typeRow}>
              {(['photo', 'video'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  style={[s.typePill, type === t && { backgroundColor: C.ink }]}
                >
                  <Text style={[s.typeT, type === t && { color: C.onInk }]}>
                    {t === 'photo' ? 'Photos' : 'Videos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {source === 'unsplash' ? (
            <Text style={s.creditNote}>Photographer credit is added to your caption automatically.</Text>
          ) : null}
          <FlatList
            data={items}
            keyExtractor={(x) => x.id}
            numColumns={3}
            contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 20 }}
            columnWrapperStyle={{ gap: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => pick(item)} activeOpacity={0.8} style={s.cell}>
                <Image source={{ uri: item.thumb }} style={s.thumb} resizeMode="cover" />
                {item.kind === 'video' ? (
                  <View style={s.playBadge}>
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                ) : null}
                {downloading === item.id ? (
                  <View style={s.dlOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : null}
                <Text style={s.author} numberOfLines={1}>{item.author}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !busy ? <Text style={s.empty}>Search above to browse stock.</Text> : null
            }
          />
        </View>
      )}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: C.ink },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.lineSoft },
  tileT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink },
  tileS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10, alignSelf: 'flex-start' },
  backT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.accentInk },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  search: { flex: 1, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: C.ink, fontFamily: 'PlusJakartaSans_400Regular' },
  go: { backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  goT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.onInk },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typePill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  typeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  creditNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted, marginBottom: 8 },
  cell: { flex: 1 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: C.lineSoft },
  playBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 4 },
  dlOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  author: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: C.muted, marginTop: 3 },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.faint, textAlign: 'center', marginTop: 24 },
});
