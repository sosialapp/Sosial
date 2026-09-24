import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  Image, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Palette } from '../theme';
import { Txt, PrimaryBtn, GhostBtn, Seg, Field } from './ui';
import { findImages, generateImage, type FoundImage, type PictureRatio } from '../utils/supabase';

type PicMode = 'auto' | 'prompt';

const RATIOS: { id: PictureRatio; label: string }[] = [
  { id: '1:1', label: 'Square' },
  { id: '4:5', label: 'Portrait' },
  { id: '9:16', label: 'Story' },
  { id: '3:2', label: 'Landscape' },
  { id: '16:9', label: 'Wide' },
];

/**
 * AI picture picker — two ways to a photo, matching the web composer:
 * - Auto: real topical photos from the web for the post's topic.
 * - Prompt: Picture AI renders whatever description is typed, in a chosen ratio.
 * onPick hands the URL/data-URI back; the caller downloads it on Apply.
 */
export default function AIPictureSheet({ visible, initialPrompt = '', initialTopic = '', onPick, onClose }: {
  visible: boolean;
  initialPrompt?: string;
  initialTopic?: string;
  onPick: (uri: string) => void;
  onClose: () => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeS(C);
  const [mode, setMode] = useState<PicMode>('auto');
  const [prompt, setPrompt] = useState('');
  const [topic, setTopic] = useState('');
  const [ratio, setRatio] = useState<PictureRatio>('4:5');
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [results, setResults] = useState<FoundImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMode('auto');
    setPrompt(initialPrompt);
    setTopic(initialTopic);
    setPicUrl(null);
    setResults([]);
    setBusy(false);
    setErr('');
  }, [visible, initialPrompt, initialTopic]);

  const query = (prompt.trim() || topic.trim()).slice(0, 200);

  const makePromptPicture = async () => {
    if (!query) {
      setErr('Describe the picture first.');
      return;
    }
    setErr('');
    setResults([]);
    setBusy(true);
    try {
      setPicUrl(await generateImage(query, ratio));
    } catch (e: any) {
      setErr(e?.message ?? 'AI generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const searchPictures = async () => {
    if (!query) {
      setErr('Write the topic first — auto finds photos for it.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const r = await findImages(query);
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
          <Seg
            options={[{ value: 'auto', label: 'Auto' }, { value: 'prompt', label: 'Prompt' }]}
            value={mode}
            onChange={(v) => { setMode(v); setErr(''); }}
          />
          <Text style={s.hint}>
            {mode === 'auto'
              ? 'Real photos matched to the topic — maps, people, places.'
              : 'AI renders whatever you describe.'}
          </Text>

          {mode === 'prompt' ? (
            <>
              <Field label="Description">
                <Txt value={prompt} onChangeText={setPrompt} placeholder="A photo of Kyiv at dusk, cinematic…" multiline />
              </Field>
              <View style={s.ratioRow}>
                {RATIOS.map((r) => {
                  const on = ratio === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setRatio(r.id)}
                      style={[s.ratioPill, on && s.ratioPillOn]}
                      activeOpacity={0.8}
                      accessibilityLabel={`Ratio ${r.label} ${r.id}`}
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.ratioT, on && s.ratioTOn]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <Field label="Topic">
              <Txt value={topic} onChangeText={setTopic} placeholder="What should the photo show?" multiline />
            </Field>
          )}

          {picUrl ? (
            <Image source={{ uri: picUrl }} style={s.preview} resizeMode="cover" />
          ) : null}

          {mode === 'auto' && results.length > 1 ? (
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

          {mode === 'prompt' ? (
            <GhostBtn label={busy ? 'Rendering…' : picUrl ? 'Regenerate' : 'Generate'} onPress={() => void makePromptPicture()} disabled={busy} />
          ) : (
            <GhostBtn label={busy ? 'Searching…' : results.length ? 'Search again' : 'Find photos'} onPress={() => void searchPictures()} />
          )}
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
  ratioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ratioPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  ratioPillOn: { backgroundColor: C.ink, borderColor: C.ink },
  ratioT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.muted },
  ratioTOn: { color: C.onInk },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '23%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent', opacity: 0.75 },
  cellOn: { borderColor: C.accent, opacity: 1 },
  thumb: { width: '100%', height: '100%' },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.redText },
  spin: { position: 'absolute', top: 60, alignSelf: 'center' },
});
