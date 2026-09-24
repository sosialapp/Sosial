import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  Image, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Palette } from '../theme';
import { Txt, PrimaryBtn, GhostBtn, Field } from './ui';
import { findImages, type FoundImage } from '../utils/supabase';

/**
 * Picture picker — real topical photos from the web for the post's topic.
 * onPick hands the remote URL back; the caller downloads it on Apply.
 */
export default function AIPictureSheet({ visible, initialTopic = '', onPick, onClose }: {
  visible: boolean;
  initialTopic?: string;
  onPick: (uri: string) => void;
  onClose: () => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeS(C);
  const [topic, setTopic] = useState('');
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [results, setResults] = useState<FoundImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTopic(initialTopic);
    setPicUrl(null);
    setResults([]);
    setBusy(false);
    setErr('');
  }, [visible, initialTopic]);

  const searchPictures = async () => {
    if (!topic.trim()) {
      setErr('Write the topic first — the search finds photos for it.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const r = await findImages(topic.trim().slice(0, 200));
      setResults(r.images);
      setPicUrl(r.images[0]?.url ?? null);
    } catch (e: any) {
      setErr(e?.message ?? 'Photo search failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.shell, { paddingBottom: insets.bottom }]}>
        <View style={s.bar}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close picture picker">
            <Ionicons name="close" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={s.title}>Picture</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.hint}>Real photos matched to the topic — maps, people, places.</Text>

          <Field label="Topic">
            <Txt value={topic} onChangeText={setTopic} placeholder="What should the photo show?" multiline />
          </Field>

          {picUrl ? (
            <Image source={{ uri: picUrl }} style={s.preview} resizeMode="cover" />
          ) : null}

          {results.length > 1 ? (
            <View style={s.grid}>
              {results.map((img) => (
                <TouchableOpacity
                  key={img.url}
                  onPress={() => setPicUrl(img.url)}
                  style={[s.cell, picUrl === img.url && s.cellOn]}
                  activeOpacity={0.8}
                  accessibilityLabel={`Use photo: ${img.title}`}
                >
                  <Image source={{ uri: img.thumb }} style={s.thumb} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {err ? <Text style={s.err}>{err}</Text> : null}

          <GhostBtn label={busy ? 'Searching…' : results.length ? 'Search again' : 'Find photos'} onPress={() => void searchPictures()} disabled={busy} />
          <PrimaryBtn
            label="Use picture"
            onPress={() => { if (picUrl) onPick(picUrl); }}
          />
        </ScrollView>
        {busy ? <ActivityIndicator size="small" color={C.accent} style={s.spin} /> : null}
      </View>
    </Modal>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  shell: { flex: 1, backgroundColor: C.bone },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.ink },
  body: { paddingHorizontal: 18, paddingBottom: 28, gap: 12 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
  preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: 14, backgroundColor: C.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '23%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent', opacity: 0.75 },
  cellOn: { borderColor: C.accent, opacity: 1 },
  thumb: { width: '100%', height: '100%' },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.redText },
  spin: { position: 'absolute', top: 60, alignSelf: 'center' },
});
