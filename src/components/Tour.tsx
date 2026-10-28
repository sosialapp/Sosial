import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, R, LIGHT } from '../theme';
import { tr } from '../i18n';

/**
 * First-run coach marks. Screens park a ref on the thing worth pointing at
 * (`useTourTarget('home-kpis')`), and this host draws a cutout ring around
 * whatever the current step names. Runs once per section, stored on device
 * the moment it opens (so quitting the app mid-tour doesn't bring it back),
 * resettable from Account. Skip dismisses every section. Rendered as a
 * plain absolute View (not a Modal) so `measureInWindow` coordinates line
 * up on Android.
 */

export type TourId = 'home' | 'post' | 'analytics' | 'community';

type Step = { target: string; title: string; body: string };

const TOURS: Record<TourId, Step[]> = {
  home: [
    { target: 'tour-dock', title: 'mtDockT', body: 'mtDockB' },
    { target: 'tour-home-kpis', title: 'mtKpiT', body: 'mtKpiB' },
    { target: 'tour-home-insights', title: 'mtInsightsT', body: 'mtInsightsB' },
  ],
  post: [
    { target: 'tour-post-tabs', title: 'mtPostTabsT', body: 'mtPostTabsB' },
    { target: 'tour-post-compose', title: 'mtPostComposeT', body: 'mtPostComposeB' },
  ],
  analytics: [
    { target: 'tour-analytics-range', title: 'mtRangeT', body: 'mtRangeB' },
    { target: 'tour-analytics-metrics', title: 'mtMetricT', body: 'mtMetricB' },
  ],
  community: [
    { target: 'tour-community-tabs', title: 'mtCommTabsT', body: 'mtCommTabsB' },
    { target: 'tour-community-filters', title: 'mtCommFiltersT', body: 'mtCommFiltersB' },
  ],
};

const PREFIX = '@sosial/tour/v1/';
const ALL: TourId[] = ['home', 'post', 'analytics', 'community'];

/** Mirrors storage so a just-written flag never loses a race with a re-read. */
const seenCache = new Set<TourId>();

async function markSeen(ids: TourId[]): Promise<void> {
  ids.forEach((id) => seenCache.add(id));
  try {
    await AsyncStorage.multiSet(ids.map((id) => [PREFIX + id, '1'] as [string, string]));
  } catch {}
}

async function isSeen(id: TourId): Promise<boolean> {
  if (seenCache.has(id)) return true;
  try {
    const v = await AsyncStorage.getItem(PREFIX + id);
    if (v === '1') seenCache.add(id);
    return v === '1';
  } catch {
    // Storage unreadable: stay quiet rather than nag on every launch.
    return true;
  }
}

type Rect = { x: number; y: number; w: number; h: number };

type AnchorNode = React.ComponentRef<typeof View>;
type AnchorRef = { current: AnchorNode | null };

const anchors = new Map<string, AnchorRef>();
const replayListeners = new Set<() => void>();

function measure(name: string): Promise<Rect | null> {
  const node = anchors.get(name)?.current;
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
  });
}

/** Park a ref on the view a step points at. */
export function useTourTarget(name: string): AnchorRef {
  const ref = useRef<AnchorNode | null>(null);
  useEffect(() => {
    anchors.set(name, ref);
    return () => {
      if (anchors.get(name) === ref) anchors.delete(name);
    };
  }, [name]);
  return ref;
}

async function keys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all.filter((k) => k.startsWith(PREFIX));
}

/** Forget every tour so the next screen visit walks through it again. */
export async function replayTours(): Promise<void> {
  seenCache.clear();
  try {
    const all = await keys();
    if (all.length) await AsyncStorage.multiRemove(all);
  } catch {}
  replayListeners.forEach((fn) => fn());
}

export default function Tour({ page }: { page: TourId | null }) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const rootRef = useRef<AnchorNode | null>(null);
  // Overlay's own window frame: targets are measured in window coordinates,
  // the overlay may sit below the status bar inset.
  const [frame, setFrame] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(216);
  const [tour, setTour] = useState<TourId | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);

  const steps = tour ? TOURS[tour] : [];
  const step = steps[index];

  const stop = useCallback((ids: TourId[]) => {
    if (ids.length) void markSeen(ids);
    setTour(null);
    setRect(null);
    setIndex(0);
  }, []);

  // First visit to a section, a beat after it settles.
  useEffect(() => {
    if (!page) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const seen = await isSeen(page);
      if (!alive || seen) return;
      // Persist before showing: the flag must survive a restart even if the
      // user kills the app or leaves the tab halfway through.
      await markSeen([page]);
      if (!alive) return;
      setIndex(0);
      setRect(null);
      setTour(page);
    }, 900);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, replayNonce]);

  useEffect(() => {
    const onReplay = () => setReplayNonce((n) => n + 1);
    replayListeners.add(onReplay);
    return () => {
      replayListeners.delete(onReplay);
    };
  }, []);

  // Track the current target: scroll moves it, missing targets get skipped.
  useEffect(() => {
    if (!tour || !step) return;
    let alive = true;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const r = await measure(step.target);
      if (!alive) return;
      const h = Dimensions.get('window').height;
      if (r && r.w > 0 && r.h > 0 && r.y < h && r.y + r.h > 0) {
        setRect(r);
        return;
      }
      if (attempts > 8) setIndex((i) => i + 1);
    };
    void tick();
    const id = setInterval(tick, 350);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tour, step, stop]);

  // Leaving the tabs (editor, connect, …) closes the walkthrough.
  useEffect(() => {
    if (!page) setTour(null);
  }, [page]);

  // A step list that ran out (or never had a target) closes itself.
  useEffect(() => {
    if (tour && !step) stop([tour]);
  }, [tour, step, stop]);

  const ox = frame?.x ?? 0;
  const oy = frame?.y ?? 0;
  const oh = frame?.h ?? win.height;
  // Usable band inside the overlay, clear of status bar and Android nav bar.
  const safeTop = Math.max(0, insets.top - oy) + 12;
  const safeBottom = Math.min(oh, win.height - insets.bottom - oy) - 12;
  const local = rect ? { x: rect.x - ox, y: rect.y - oy, w: rect.w, h: rect.h } : null;

  const cardTop = useMemo(() => {
    const gap = 14;
    const maxTop = Math.max(safeTop, safeBottom - cardH);
    if (!local) return Math.max(safeTop, Math.min((safeTop + safeBottom) / 2 - cardH / 2, maxTop));
    const below = local.y + local.h + gap;
    const above = local.y - cardH - gap;
    const top = safeBottom - (local.y + local.h) > cardH + gap ? below : above;
    return Math.max(safeTop, Math.min(top, maxTop));
  }, [local?.y, local?.h, cardH, safeTop, safeBottom]);

  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, w, h) => {
      setFrame((f) => (f && f.x === x && f.y === y && f.w === w && f.h === h ? f : { x, y, w, h }));
    });
  }, []);

  if (!tour || !step) return null;

  const scrim = 'rgba(11,18,32,0.62)';
  const last = index >= steps.length - 1;
  const pad = 6;

  const ring = local
    ? {
        left: local.x - pad,
        top: local.y - pad,
        width: local.w + pad * 2,
        height: local.h + pad * 2,
      }
    : null;

  return (
    <View
      ref={rootRef}
      onLayout={measureRoot}
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      {ring ? (
        <>
          <Pressable style={[styles.scrim, { top: 0, height: Math.max(0, ring!.top), backgroundColor: scrim }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, { top: ring!.top + ring!.height, bottom: 0, backgroundColor: scrim }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, { top: ring!.top, height: ring!.height, left: 0, width: Math.max(0, ring!.left), backgroundColor: scrim }]} onPress={() => {}} />
          <Pressable
            style={[styles.scrim, { top: ring!.top, height: ring!.height, left: ring!.left + ring!.width, right: 0, backgroundColor: scrim }]}
            onPress={() => {}}
          />
          <View pointerEvents="none" style={[styles.ring, ring!, { borderWidth: 2, borderColor: C.accent, borderRadius: R.md, backgroundColor: 'transparent' }]} />
        </>
      ) : (
        <Pressable style={[styles.scrim, StyleSheet.absoluteFill, { backgroundColor: scrim }]} onPress={() => {}} />
      )}

      <View
        onLayout={(e) => {
          const h = Math.ceil(e.nativeEvent.layout.height);
          if (h > 0 && h !== cardH) setCardH(h);
        }}
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: cardTop,
          backgroundColor: C.card,
          borderRadius: R.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: C.line,
          padding: 18,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 14,
        }}
      >
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.8, color: C.faint }}>
          {tr('tourOf').replace('{n}', String(index + 1)).replace('{total}', String(steps.length))}
        </Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink, marginTop: 6 }}>
          {tr(step.title)}
        </Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, lineHeight: 20, color: C.muted, marginTop: 6 }}>
          {tr(step.body)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
          <TouchableOpacity onPress={() => stop(ALL)} hitSlop={8} activeOpacity={0.7} accessibilityLabel={tr('tourSkip')}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.faint }}>{tr('tourSkip')}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 12 }}>
            {steps.map((s, i) => (
              <View
                key={s.target}
                style={{
                  width: i === index ? 14 : 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: i === index ? C.accent : C.line,
                }}
              />
            ))}
          </View>
          {index > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setRect(null);
                setIndex((i) => Math.max(0, i - 1));
              }}
              activeOpacity={0.7}
              accessibilityLabel={tr('tourBack')}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.line }}
            >
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink }}>{tr('tourBack')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              if (last) {
                stop([tour]);
                return;
              }
              setRect(null);
              setIndex((i) => i + 1);
            }}
            activeOpacity={0.85}
            accessibilityLabel={last ? tr('tourDone') : tr('tourNext')}
            hitSlop={6}
            style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: C.accent, marginLeft: 8 }}
          >
            {/* Dark ink in both themes: DARK.accentInk is the accent yellow itself. */}
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: LIGHT.accentInk }}>
              {last ? tr('tourDone') : tr('tourNext')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0 },
  ring: { position: 'absolute' },
});