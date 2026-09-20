import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Dimensions, PixelRatio } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { usePost } from '../store/PostContext';
import PostCanvas, { CANVAS_W } from '../components/PostCanvas';
import { capturePage, saveUrisToGallery, saveAllImages } from '../utils/export';
import { useComposer } from '../store/ComposerContext';
import type { ManagedPost } from '../utils/managed';
import { useTheme, Palette, T, R } from '../theme';
import { PillToggle } from '../components/ui';

export default function ExportScreen({ onBack, plan }: { onBack: () => void; plan: 'free' | 'pro' | 'team' }) {
  const { post, sizeRatio, patchPageById } = usePost();
  const { C } = useTheme();
  const s = makeS(C);
  // free plan forces the badge on; paid respects the per-page toggle
  const wmFor = (p: { showWatermark?: boolean }) => (plan === 'free' ? true : (p.showWatermark ?? true));
  const [busy, setBusy] = useState(false);
  /** per-page save in flight — the big buttons stay idle so the spinner shows on the tapped page only */
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedUris, setSavedUris] = useState<string[]>([]);
  const refs = useRef<any[]>([]);
  const { openComposer } = useComposer();

  const caption = useMemo(() => {
    if (!post) return '';
    return post.pages.map((p) => p.caption).filter(Boolean).join('\n\n') || post.pages[0]?.title.text || '';
  }, [post]);

  if (!post) return null;

  const allWmOn = post.pages.every((p) => p.showWatermark ?? true);
  const toggleAllWm = () => {
    if (allWmOn && plan === 'free') {
      Alert.alert('Pro feature', 'Removing the watermark needs Pro or Team. Upgrade in Account to turn it off.');
      return;
    }
    const next = !allWmOn;
    post.pages.forEach((p) => patchPageById(p.id, { showWatermark: next }));
  };

  const { width: SCREEN_W } = Dimensions.get('window');
  const pvScale = Math.min(0.66, (SCREEN_W - 96) / CANVAS_W);
  const pvSnap = CANVAS_W * pvScale + 14;
  /** Target ~1080px output. captureRef already captures at full device pixel
   *  density, so we only scale the hidden layout when the screen is low-density —
   *  blowing it up on a 3x phone produced 2040px PNGs and multi-second saves. */
  const CAP_SCALE = Math.min(3, Math.max(1, 1080 / (CANVAS_W * PixelRatio.get())));
  // center the strip when every preview fits on screen; scroll from the left otherwise
  const pvW = CANVAS_W * pvScale;
  const stripFits = post.pages.length * pvW + Math.max(0, post.pages.length - 1) * 14 <= SCREEN_W - 48;

  const captureAll = async (): Promise<string[]> => {
    const uris: string[] = [];
    for (let i = 0; i < post.pages.length; i++) {
      const ref = refs.current[i];
      if (!ref) continue;
      const uri = await capturePage(ref, `p${i}`);
      uris.push(uri);
    }
    return uris;
  };

  const onSaveAll = async () => {
    setBusy(true);
    try {
      const uris = await saveAllImages(refs.current, post, sizeRatio);
      const n = await saveUrisToGallery(uris);
      // only tick every page when every file actually landed — a partial
      // failure must not mark unsaved pages as saved
      if (n === uris.length) setSavedUris(uris);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not capture pages.');
    } finally {
      setBusy(false);
    }
  };

  const onPostDesign = async () => {
    setBusy(true);
    try {
      const uris = await captureAll();
      if (!uris.length) {
        Alert.alert('Nothing captured', 'Save the pages first, then post.');
        return;
      }
      const draft: ManagedPost = {
        id: '',
        title: post.name || 'Untitled',
        body: caption,
        attachments: uris.map((uri) => ({ uri, kind: 'image' as const })),
        imageUri: uris[0],
        platforms: ['any'],
        createdAt: Date.now(),
        status: 'draft',
      };
      openComposer(draft);
    } catch (e: any) {
      Alert.alert('Could not prepare post', e?.message ?? 'Could not capture pages.');
    } finally {
      setBusy(false);
    }
  };

  const onSaveOne = async (index: number) => {
    if (busy || savingIdx !== null) return;
    setSavingIdx(index);
    try {
      const uri = await capturePage(refs.current[index], `p${index}`);
      const n = await saveUrisToGallery([uri], { silent: true });
      // saveUrisToGallery already reports failures — only mark the page and
      // confirm when the file actually landed, never on a failed write
      if (n > 0) {
        setSavedUris((prev) => {
          const next = [...prev];
          next[index] = uri;
          return next;
        });
      }
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not capture page.');
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>

        <Text style={s.kicker}>Step 6 of 6</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]} numberOfLines={1}>{post.name}</Text>
        <Text style={[T.small, { color: C.muted, marginTop: 6, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 }]}>
          {post.pages.length} image{post.pages.length > 1 ? 's' : ''} ready to save and post.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink }}>Watermark {plan === 'free' ? '· Pro to remove' : ''}</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 }}>
              {plan === 'free' ? 'Free plan — exports carry the “Made with Sosial” badge.' : '“Made with Sosial” badge on exports.'}
            </Text>
          </View>
          <PillToggle on={plan === 'free' ? true : allWmOn} onPress={toggleAllWm} />
        </View>

        {/* hidden renderers for capture — 2x layout for high-resolution exports */}
        <View style={{ position: 'absolute', left: -9999, top: 0, opacity: 0, pointerEvents: 'none' }}>
          {post.pages.map((p, i) => (
            <View key={p.id} style={{ width: CANVAS_W * CAP_SCALE, height: CANVAS_W * CAP_SCALE * sizeRatio, overflow: 'visible' }}>
              <PostCanvas ref={(r) => { refs.current[i] = r; }} page={p} ratio={sizeRatio} scale={CAP_SCALE} watermark={wmFor(p)} />
            </View>
          ))}
        </View>

        {/* previews — one snap per swipe, scaled to fit with a peek of next */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={pvSnap}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="normal"
          contentContainerStyle={{ gap: 14, marginTop: 22, paddingRight: stripFits ? 0 : 24, flexGrow: 1, justifyContent: stripFits ? 'center' : 'flex-start' }}
        >
          {post.pages.map((p, i) => (
            <View key={p.id} style={{ gap: 10 }}>
              <View style={s.numBadge}><Text style={s.numBadgeT}>{String(i + 1).padStart(2, '0')}</Text></View>
              <View style={s.previewCard}>
                <PostCanvas page={p} ratio={sizeRatio} scale={pvScale} watermark={wmFor(p)} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                <TouchableOpacity
                  onPress={() => onSaveOne(i)}
                  style={[s.dlBtn, savedUris[i] && s.dlBtnDone]}
                  disabled={busy || savingIdx !== null}
                  activeOpacity={0.8}
                  accessibilityLabel={savedUris[i] ? `Page ${i + 1} saved` : `Save page ${i + 1} to device`}
                >
                  {savingIdx === i ? (
                    <ActivityIndicator size="small" color={C.onInk} />
                  ) : (
                    <Ionicons name={savedUris[i] ? 'checkmark' : 'download-outline'} size={17} color={savedUris[i] ? C.accentInk : C.onInk} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity onPress={onSaveAll} style={s.save} disabled={busy} activeOpacity={0.88}>
          {busy ? <ActivityIndicator color={C.onInk} /> : (
            <>
              <Text style={s.saveT}>Save all to device</Text>
              <Ionicons name="download-outline" size={18} color={C.onInk} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onPostDesign} style={[s.save, s.postDesign]} disabled={busy} activeOpacity={0.88}>
          <Text style={s.saveT}>Post this design</Text>
          <Ionicons name="send-outline" size={18} color={C.onInk} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  back: { fontFamily: 'PlusJakartaSans_700Bold', color: C.ink, fontSize: 20, marginTop: -2 },
  kicker: { ...T.tag, color: C.accent, marginTop: 24 },
  numBadge: { alignSelf: 'flex-start', backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  numBadgeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.onInk },
  previewCard: { borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.paper, shadowColor: '#1C1917', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  dlBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  dlBtnDone: { backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.ink, borderRadius: R.md + 2, paddingVertical: 17, paddingHorizontal: 20, marginTop: 22 },
  saveT: { fontFamily: 'PlusJakartaSans_700Bold', color: C.onInk, fontSize: 15 },
  postDesign: { backgroundColor: C.accent, marginTop: 10 },
  secT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, letterSpacing: -0.4, color: C.ink, marginBottom: 12 },
  list: { backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 14 },
  rowDiv: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  dot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotT: { color: C.onInk, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  rowT: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, letterSpacing: -0.2, color: C.ink, textTransform: 'capitalize' },
  chev: { fontSize: 20, color: C.faint },
});
