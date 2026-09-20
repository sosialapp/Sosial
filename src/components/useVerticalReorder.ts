import { useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder } from 'react-native';

export interface VerticalReorder {
  /** Row currently lifted, or null. */
  dragIndex: number | null;
  /** Slot the lifted row would land in, or null. */
  target: number | null;
  /** Live vertical offset of the lifted row. */
  dy: Animated.Value;
  /** Lift a row (call from a long-press on its grip). */
  begin: (index: number) => void;
  /** Measure a row — spread on every row wrapper. */
  onRowLayout: (index: number) => (e: LayoutChangeEvent) => void;
  /** PanResponder handlers — spread on every row wrapper. */
  panHandlers: any;
}

/**
 * Long-press vertical reordering for a stack of variable-height rows (chain
 * segments). While a row is lifted it follows the finger; the nearest slot to
 * its centre becomes the target (rendered by the caller as a drop indicator),
 * and the new order is committed once on release. The data order is held during
 * the drag so nothing remounts, and capture-phase claim keeps an enclosing
 * ScrollView from stealing the gesture.
 */
export function useVerticalReorder(count: number, onMove: (from: number, to: number) => void, active = true, onDragChange?: (dragging: boolean) => void): VerticalReorder {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const layouts = useRef<{ y: number; h: number }[]>([]);
  const fromR = useRef<number | null>(null);
  const targetR = useRef<number | null>(null);
  const live = useRef({ count, onMove, active, onDragChange });
  live.current = { count, onMove, active, onDragChange };

  const begin = (index: number) => {
    if (!live.current.active || live.current.count < 2) return;
    fromR.current = index;
    targetR.current = index;
    dy.setValue(0);
    setDragIndex(index);
    setTarget(index);
    live.current.onDragChange?.(true);
  };
  const commit = () => {
    const from = fromR.current;
    const to = targetR.current;
    fromR.current = null;
    targetR.current = null;
    dy.setValue(0);
    setDragIndex(null);
    setTarget(null);
    live.current.onDragChange?.(false);
    if (from !== null && to !== null && from !== to) live.current.onMove(from, to);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onShouldBlockNativeResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        fromR.current !== null && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponder: (_, g) =>
        fromR.current !== null && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const from = fromR.current;
        if (from === null) return;
        dy.setValue(g.dy);
        const info = layouts.current[from];
        if (!info) return;
        const mid = info.y + g.dy + info.h / 2;
        let best = targetR.current ?? from;
        let bestD = Infinity;
        for (let i = 0; i < live.current.count; i++) {
          const l = layouts.current[i];
          if (!l) continue;
          const d = Math.abs(mid - (l.y + l.h / 2));
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best !== targetR.current) { targetR.current = best; setTarget(best); }
      },
      onPanResponderRelease: commit,
      onPanResponderTerminate: commit,
    }),
  ).current;

  const onRowLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    layouts.current[index] = { y, h: height };
  };

  return { dragIndex, target, dy, begin, onRowLayout, panHandlers: pan.panHandlers };
}
