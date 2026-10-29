import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, PanResponder, StyleSheet, Dimensions } from 'react-native';
import { useTheme, Palette, R } from '../theme';
import { PrimaryBtn, GhostBtn } from './ui';
import { MAX_CROP_ZOOM, cropToRect, isCropV2, rectToCrop, type ImageCrop } from '../utils/crop';

const { width: SCREEN_W } = Dimensions.get('window');

export type CropValue = ImageCrop;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Real crop editor: the photo sits contain-fit in a dark stage, an
 * aspect-locked crop rectangle (matching the block frame) overlays it with
 * draggable corner handles, thirds grid, dimmed outside, like a normal
 * image editor. The rect maps to the v2 crop model in utils/crop.ts, which
 * both renderers lay out in exact px (mirrors web steps2.tsx CropEditor,
 * keep in sync).
 */
export default function ImageCropModal({ visible, uri, frameAspect, value, onDone, onClose }: {
  visible: boolean;
  uri?: string;
  /** Block frame shape (w/h), from imageFrameAspect. */
  frameAspect: number;
  value?: CropValue;
  onDone: (c: CropValue) => void;
  onClose: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const rectRef = useRef<Rect | null>(null);
  rectRef.current = rect;

  useEffect(() => {
    if (visible && uri) {
      setNat({ w: 0, h: 0 });
      setRect(null);
      Image.getSize(
        uri,
        (iw, ih) => setNat({ w: iw, h: ih }),
        () => setNat({ w: 0, h: 0 }),
      );
    }
  }, [visible, uri]);

  const stageW = Math.min(SCREEN_W - 56, 340);
  const stageH = 300;
  const scale = nat.w > 0 && nat.h > 0 ? Math.min(stageW / nat.w, stageH / nat.h) : 0;
  const dispW = nat.w * scale;
  const dispH = nat.h * scale;
  const ox = (stageW - dispW) / 2;
  const oy = (stageH - dispH) / 2;
  const imgAspect = nat.h > 0 ? nat.w / nat.h : 1;
  // Largest frame-shaped rect = the cover fit = zoom 1.
  const fullW = dispH > 0 && dispW / dispH > frameAspect ? dispH * frameAspect : dispW;
  const defaultRect = (): Rect => ({ x: (dispW - fullW) / 2, y: (dispH - fullW / frameAspect) / 2, w: fullW, h: fullW / frameAspect });

  // Initialise the rect once the photo geometry is known.
  useEffect(() => {
    if (!scale || rect || !dispW || !dispH) return;
    if (isCropV2(value)) {
      const f = cropToRect(value, imgAspect, frameAspect);
      setRect({ x: f.u * dispW, y: f.v * dispH, w: f.uw * dispW, h: f.vh * dispH });
    } else {
      setRect(defaultRect());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, dispW, dispH]);

  const emit = (r: Rect): CropValue =>
    rectToCrop({ u: r.x / dispW, v: r.y / dispH, uw: r.w / dispW, vh: r.h / dispH }, imgAspect, frameAspect);

  const minW = fullW / MAX_CROP_ZOOM;
  /** Aspect-locked resize/move with clamping inside the photo. Pure, returns the next rect. */
  const applyDrag = (mode: 'move' | 0 | 1 | 2 | 3, dx: number, dy: number, start: Rect): Rect => {
    if (mode === 'move') {
      return { ...start, x: clamp(start.x + dx, 0, dispW - start.w), y: clamp(start.y + dy, 0, dispH - start.h) };
    }
    // Corner resize: the opposite corner is the anchor and the size follows
    // where the dragged corner now is relative to it (aspect-locked), so the
    // rect tracks the finger instead of collapsing on the first move.
    const right = mode === 1 || mode === 3; // TR/BR keep the left edge
    const bottom = mode === 2 || mode === 3; // BL/BR keep the top edge
    const ax = right ? start.x : start.x + start.w;
    const ay = bottom ? start.y : start.y + start.h;
    const cx = (right ? start.x + start.w : start.x) + dx;
    const cy = (bottom ? start.y + start.h : start.y) + dy;
    const reachX = right ? cx - ax : ax - cx;
    const reachY = bottom ? cy - ay : ay - cy;
    // room left inside the photo on the growing side
    const roomX = right ? dispW - ax : ax;
    const roomY = bottom ? dispH - ay : ay;
    const w = Math.max(minW, Math.min(Math.max(reachX, reachY * frameAspect), roomX, roomY * frameAspect, fullW));
    const h = w / frameAspect;
    return { x: right ? ax : ax - w, y: bottom ? ay : ay - h, w, h };
  };

  // refs so the responders (created once per geometry) see fresh values
  const geo = useRef({ dispW, dispH, minW });
  geo.current = { dispW, dispH, minW };
  // Snapshot of the rect at gesture start + latest gesture deltas, so
  // cumulative g.dx/g.dy are applied to the frozen start (applying them to
  // the live rect double-counts and the rect races the finger).
  const startRef = useRef<Rect | null>(null);
  const lastG = useRef({ dx: 0, dy: 0 });
  const raf = useRef<number | null>(null);
  const flush = (idx: 'move' | 0 | 1 | 2 | 3) => {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const start = startRef.current;
      if (!start) return;
      setRect(
        idx === 'move'
          ? (({ dispW: dw, dispH: dh }) => ({ ...start, x: clamp(start.x + lastG.current.dx, 0, dw - start.w), y: clamp(start.y + lastG.current.dy, 0, dh - start.h) }))(geo.current)
          : applyDrag(idx, lastG.current.dx, lastG.current.dy, start),
      );
    });
  };

  const bodyPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = rectRef.current;
        },
        onPanResponderMove: (_e, g) => {
          if (!startRef.current) return;
          lastG.current = { dx: g.dx, dy: g.dy };
          flush('move');
        },
        onPanResponderRelease: () => {},
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cornerPan = (idx: 0 | 1 | 2 | 3) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = rectRef.current;
      },
      onPanResponderMove: (_e, g) => {
        if (!startRef.current) return;
        lastG.current = { dx: g.dx, dy: g.dy };
        flush(idx);
      },
      onPanResponderRelease: () => {},
    });

  const [p0, p1, p2, p3] = useMemo(
    () => [cornerPan(0), cornerPan(1), cornerPan(2), cornerPan(3)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispW, dispH],
  );

  const zoom = rect && fullW ? fullW / rect.w : 1;
  /** Zoom around the rect's centre, kept inside the photo. */
  const zoomBy = (f: number) => {
    if (!rect || !fullW) return;
    const w = clamp(fullW / clamp(zoom * f, 1, MAX_CROP_ZOOM), minW, fullW);
    const h = w / frameAspect;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    setRect({ x: clamp(cx - w / 2, 0, dispW - w), y: clamp(cy - h / 2, 0, dispH - h), w, h });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={s.bg}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.sheet}>
          <Text style={s.title}>Crop photo</Text>
          <Text style={s.sub}>Drag the corners to crop, drag inside to move.</Text>

          <View style={[s.stage, { width: stageW, height: stageH, borderRadius: R.md }]}>
            {uri && dispW > 0 ? (
              <Image
                source={{ uri }}
                resizeMode="stretch"
                style={{ position: 'absolute', left: ox, top: oy, width: dispW, height: dispH }}
              />
            ) : (
              <Text style={s.empty}>{uri ? 'Loading photo…' : 'Pick a photo first'}</Text>
            )}
            {rect && dispW > 0 ? (
              <>
                {/* dim outside the rect */}
                <View style={{ position: 'absolute', left: 0, top: 0, width: stageW, height: Math.max(0, oy + rect.y), backgroundColor: '#000000AA' }} />
                <View style={{ position: 'absolute', left: 0, top: oy + rect.y + rect.h, width: stageW, height: Math.max(0, stageH - (oy + rect.y + rect.h)), backgroundColor: '#000000AA' }} />
                <View style={{ position: 'absolute', left: 0, top: oy + rect.y, width: Math.max(0, ox + rect.x), height: rect.h, backgroundColor: '#000000AA' }} />
                <View style={{ position: 'absolute', left: ox + rect.x + rect.w, top: oy + rect.y, width: Math.max(0, stageW - (ox + rect.x + rect.w)), height: rect.h, backgroundColor: '#000000AA' }} />
                {/* crop rect + thirds grid */}
                <View
                  {...bodyPan.panHandlers}
                  style={{
                    position: 'absolute',
                    left: ox + rect.x,
                    top: oy + rect.y,
                    width: rect.w,
                    height: rect.h,
                    borderWidth: 1,
                    borderColor: '#FFFFFFCC',
                  }}
                >
                  <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF59' }} />
                  <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF59' }} />
                  <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF59' }} />
                  <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF59' }} />
                </View>
                {/* corner handles: 0 TL, 1 TR, 2 BL, 3 BR */}
                {[
                  { i: 0 as const, left: ox + rect.x - 11, top: oy + rect.y - 11, pan: p0 },
                  { i: 1 as const, left: ox + rect.x + rect.w - 11, top: oy + rect.y - 11, pan: p1 },
                  { i: 2 as const, left: ox + rect.x - 11, top: oy + rect.y + rect.h - 11, pan: p2 },
                  { i: 3 as const, left: ox + rect.x + rect.w - 11, top: oy + rect.y + rect.h - 11, pan: p3 },
                ].map((h) => (
                  <View
                    key={h.i}
                    {...h.pan.panHandlers}
                    style={{
                      position: 'absolute',
                      left: h.left,
                      top: h.top,
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 2,
                      borderColor: '#141210',
                    }}
                  />
                ))}
              </>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 }}>
            <TouchableOpacity onPress={() => zoomBy(1 / 1.25)} disabled={zoom <= 1.001} style={[s.zoomBtn, zoom <= 1.001 && { opacity: 0.35 }]} activeOpacity={0.7} accessibilityLabel="Zoom out">
              <Text style={s.zoomBtnT}>−</Text>
            </TouchableOpacity>
            <Text style={s.zoomT}>{zoom.toFixed(1)}×</Text>
            <TouchableOpacity onPress={() => zoomBy(1.25)} disabled={zoom >= MAX_CROP_ZOOM - 0.01} style={[s.zoomBtn, zoom >= MAX_CROP_ZOOM - 0.01 && { opacity: 0.35 }]} activeOpacity={0.7} accessibilityLabel="Zoom in">
              <Text style={s.zoomBtnT}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <GhostBtn label="Reset" onPress={() => { if (dispW) setRect(defaultRect()); }} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryBtn label="Done" onPress={() => rect && onDone(emit(rect))} />
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, gap: 6 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
  stage: { alignSelf: 'center', marginTop: 12, backgroundColor: '#141210', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#CFC9BD', padding: 20 },
  zoomT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted, minWidth: 40, textAlign: 'center' },
  zoomBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  zoomBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: C.ink },
});
