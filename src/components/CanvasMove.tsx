import React, { createContext, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R } from '../theme';
import { Placement } from '../types';
import { Field, Stepper } from './ui';
import type { PlaceTarget } from '../utils/blockLayout';

/**
 * Canvas move mode: a panel picks the element ("Move on canvas"), then a
 * finger drag on the editor preview moves it (EditorScreen owns the
 * gesture). Mobile counterpart of the web canvas edit layer's free move.
 */
interface CanvasMove {
  target: PlaceTarget | null;
  start: (t: PlaceTarget) => void;
  stop: () => void;
}

const Ctx = createContext<CanvasMove>({ target: null, start: () => {}, stop: () => {} });
export const CanvasMoveProvider = Ctx.Provider;
export const useCanvasMove = () => useContext(Ctx);

export const sameTarget = (a: PlaceTarget | null, b: PlaceTarget | null) =>
  !!a && !!b && a.kind === b.kind && (a.kind !== 'block' || (b.kind === 'block' && a.id === b.id));

/** Move, rotation, opacity, layer order and reset for one element. Mirrors
 *  web PlacementControls (apps/web/src/components/studio/controls.tsx). */
export function PlacementControls({
  target,
  value,
  onChange,
  onLayer,
}: {
  target: PlaceTarget;
  value: Placement;
  onChange: (patch: Placement) => void;
  onLayer: (where: 'front' | 'back') => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const move = useCanvasMove();
  const moving = sameTarget(move.target, target);
  const rot = value.rotate ?? 0;
  const opa = Math.round((value.opacity ?? 1) * 100);
  const placed = !!(value.dx || value.dy || value.rotate);
  return (
    <View style={{ gap: 14 }}>
      <TouchableOpacity
        onPress={() => (moving ? move.stop() : move.start(target))}
        style={[s.move, moving && s.moveOn]}
        activeOpacity={0.8}
        accessibilityLabel={moving ? 'Done moving' : 'Move on canvas'}
      >
        <Ionicons name={moving ? 'checkmark' : 'move'} size={16} color={moving ? C.onInk : C.ink} />
        <Text style={[s.moveT, moving && { color: C.onInk }]}>{moving ? 'Done moving' : 'Move on canvas'}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Rotation">
            <Stepper value={rot} onChange={(v) => onChange({ rotate: v || undefined })} step={5} min={-180} max={180} format={(v) => `${v}°`} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Opacity">
            <Stepper value={opa} onChange={(v) => onChange({ opacity: v >= 100 ? undefined : v / 100 })} step={10} min={10} max={100} format={(v) => `${v}%`} />
          </Field>
        </View>
      </View>
      <Field label="Layer">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity onPress={() => onLayer('front')} style={s.pill} activeOpacity={0.7}>
            <Text style={s.pillT}>Bring to front</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onLayer('back')} style={s.pill} activeOpacity={0.7}>
            <Text style={s.pillT}>Send to back</Text>
          </TouchableOpacity>
          {placed ? (
            <TouchableOpacity onPress={() => onChange({ dx: undefined, dy: undefined, rotate: undefined })} style={s.pill} activeOpacity={0.7}>
              <Text style={s.pillT}>Reset position</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Field>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  move: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  moveOn: { backgroundColor: C.accent, borderColor: C.accent },
  moveT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  pillT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.accentInk },
});
