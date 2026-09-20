import React, { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme, R } from '../theme';

export interface SegMediaItem {
  uri: string;
  kind: 'image' | 'video';
}

/** Muted looping video preview sized to the compact segment tile. */
function SegVideo({ uri, size }: { uri: string; size: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={{ width: size, height: size, borderRadius: R.sm + 3, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView style={{ width: '100%', height: '100%' }} player={player} contentFit="cover" nativeControls={false} />
      <View style={{ position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="play" size={10} color="#fff" />
      </View>
    </View>
  );
}

/**
 * Compact per-segment media strip for chain posts: real image/video previews
 * with app-icon-style hold-and-drag reordering. Long-press a tile to lift it;
 * neighbours glide one slot over to open the drop gap and the new order is
 * committed once on release. The original order is held during the drag (only
 * transforms move) so nothing remounts and video previews never reload.
 */
export function SegMediaStrip({ items, onPick, onRemove, onMove, max, size = 56, dark = false }: {
  items: SegMediaItem[];
  onPick: () => void;
  onRemove: (index: number) => void;
  onMove?: (from: number, to: number) => void;
  max: number;
  size?: number;
  dark?: boolean;
}) {
  const { C } = useTheme();
  const step = size + 8;
  const [lift, setLift] = useState<number | null>(null);
  const dx = useRef(new Animated.Value(0)).current;
  const shifts = useRef<Animated.Value[]>([]);
  const hover = useRef<number | null>(null);
  const skipTap = useRef(false);
  // Stable identity per item object so reordering never remounts a tile (a
  // remount would reload video previews mid-drag).
  const ids = useRef(new WeakMap<object, string>());
  const seq = useRef(0);
  const idOf = (o: SegMediaItem) => {
    let v = ids.current.get(o);
    if (!v) { v = `s${seq.current++}`; ids.current.set(o, v); }
    return v;
  };
  const shiftAt = (i: number) => {
    if (!shifts.current[i]) shifts.current[i] = new Animated.Value(0);
    return shifts.current[i];
  };
  const glide = (v: Animated.Value, to: number) =>
    Animated.timing(v, { toValue: to, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  const shiftFor = (i: number, from: number, to: number) => {
    if (from < to && i > from && i <= to) return -step;
    if (from > to && i >= to && i < from) return step;
    return 0;
  };
  const reset = () => {
    dx.setValue(0);
    hover.current = null;
    shifts.current.forEach((v) => v && v.setValue(0));
  };
  const cancel = () => { reset(); setLift(null); };
  // Shift values are keyed by slot INDEX, so zero them in the same layout pass
  // as the data reorder — otherwise a stale shift flashes for a frame on drop.
  useLayoutEffect(() => { reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [items]);

  const live = useRef({ lift, count: items.length, onMove });
  live.current = { lift, count: items.length, onMove };
  const claim = (dxv: number, dyv: number) =>
    live.current.lift !== null && Math.abs(dxv) > 4 && Math.abs(dxv) > Math.abs(dyv);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Capture phase so the lifted tile wins over the ScrollView + touchables.
      onMoveShouldSetPanResponderCapture: (_, g) => claim(g.dx, g.dy),
      onMoveShouldSetPanResponder: (_, g) => claim(g.dx, g.dy),
      onPanResponderMove: (_, g) => {
        const from = live.current.lift;
        if (from === null) return;
        dx.setValue(g.dx);
        const to = Math.max(0, Math.min(live.current.count - 1, from + Math.round(g.dx / step)));
        if (to !== hover.current) {
          hover.current = to;
          for (let i = 0; i < live.current.count; i++) if (i !== from) glide(shiftAt(i), shiftFor(i, from, to));
        }
      },
      onPanResponderRelease: (_, g) => {
        const from = live.current.lift;
        if (from === null) { cancel(); return; }
        const to = Math.max(0, Math.min(live.current.count - 1, from + Math.round(g.dx / step)));
        skipTap.current = true;
        Animated.timing(dx, { toValue: (to - from) * step, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: false })
          .start(() => {
            if (to !== from) live.current.onMove?.(from, to);
            hover.current = null;
            setLift(null);
          });
      },
      onPanResponderTerminate: () => cancel(),
    }),
  ).current;

  const tileStyle = { width: size, height: size, borderRadius: R.sm + 3, overflow: 'hidden' as const, backgroundColor: C.lineSoft };
  return (
    <View {...pan.panHandlers}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} scrollEnabled={lift === null} contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 4, paddingVertical: 2 }}>
        {items.map((it, i) => {
          const dragging = lift === i;
          return (
            <Animated.View
              key={idOf(it)}
              style={{
                zIndex: dragging ? 4 : 0,
                elevation: dragging ? 6 : 0,
                opacity: lift !== null && !dragging ? 0.9 : 1,
                transform: [{ translateX: dragging ? dx : lift === null ? 0 : shiftAt(i) }, ...(dragging ? [{ scale: 1.06 }] : [])],
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  if (skipTap.current) { skipTap.current = false; return; }
                  if (lift !== null) cancel();
                }}
                onLongPress={() => {
                  if (items.length < 2) return;
                  reset();
                  setLift(i);
                }}
                delayLongPress={200}
                activeOpacity={0.85}
              >
                {it.kind === 'video' ? (
                  <SegVideo uri={it.uri} size={size} />
                ) : (
                  <Image source={{ uri: it.uri }} style={tileStyle} resizeMode="cover" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemove(i)}
                style={{ position: 'absolute', top: -5, right: -5, width: 17, height: 17, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' }}
                hitSlop={6}
                accessibilityLabel="Remove segment attachment"
              >
                <Ionicons name="close" size={11} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        {items.length < max ? (
          <TouchableOpacity
            onPress={onPick}
            style={[tileStyle, {
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: dark ? 'rgba(255,255,255,0.06)' : C.accentSoft,
              borderWidth: 1,
              borderColor: dark ? 'rgba(255,255,255,0.16)' : 'transparent',
            }]}
            activeOpacity={0.7}
            accessibilityLabel="Attach photo or video"
          >
            <Ionicons name="image-outline" size={20} color={dark ? 'rgba(255,255,255,0.65)' : C.accentInk} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      {items.length > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <Ionicons name="reorder-three" size={13} color={dark ? 'rgba(255,255,255,0.4)' : C.faint} />
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10.5, color: dark ? 'rgba(255,255,255,0.4)' : C.faint }}>Hold & drag to arrange</Text>
        </View>
      ) : null}
    </View>
  );
}
