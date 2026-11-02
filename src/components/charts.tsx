import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme } from '../theme';
import { niceScale } from '../utils/analyticsMath';
import { Seg } from './ui';

const LABEL_H = 16;

function useWidth() {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return { w, onLayout };
}

export type ChartMode = 'bar' | 'line';

const AXIS_W = 34;

const tickText = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${Number((v / 1_000_000).toFixed(1))}M`;
  if (a >= 1000) return `${Number((v / 1000).toFixed(1))}k`;
  return String(Number(v.toFixed(2)));
};

/**
 * One series as bars or a line on a labelled value axis that starts at zero
 * and tops out on a round number (utils/analyticsMath niceScale, the same
 * scale the web charts use). A zero day draws no bar; a null value is a gap
 * in the line, never bridged. Tap a bucket to read its value.
 */
export function TrendChart({
  data,
  labels,
  mode,
  color,
  height = 150,
  formatValue,
}: {
  data: (number | null)[];
  labels: string[];
  mode: ChartMode;
  color: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const { C } = useTheme();
  const { w, onLayout } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const values = data.filter((v): v is number => v !== null && Number.isFinite(v));
  const scale = niceScale(Math.max(0, ...values), 4, values.every((v) => Number.isInteger(v)));
  const plotW = Math.max(0, w - AXIS_W);
  const slot = n > 0 ? plotW / n : 0;
  const y = (v: number): number => height - (v / scale.max) * height;
  const cx = (i: number): number => AXIS_W + slot * i + slot / 2;
  const every = Math.max(1, Math.ceil(n / 6));
  const fmt = formatValue ?? ((v: number) => String(v));

  const onTap = (e: { nativeEvent: { locationX: number } }) => {
    if (n === 0 || slot <= 0) return;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((e.nativeEvent.locationX - AXIS_W) / slot)));
    setActive(idx === active ? null : idx);
  };

  // Line segments only join neighbouring known values.
  const segments: string[] = [];
  if (mode === 'line') {
    let d = '';
    data.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        if (d) segments.push(d);
        d = '';
        return;
      }
      d += `${d ? 'L' : 'M'}${cx(i).toFixed(2)},${y(v).toFixed(2)} `;
    });
    if (d) segments.push(d);
  }
  const barW = Math.max(2, Math.min(28, slot * 0.66));
  const hot = active !== null ? data[active] : null;

  return (
    <View style={{ width: '100%' }}>
      <Pressable onPress={onTap} onLayout={onLayout} style={{ width: '100%', height: height + LABEL_H + 4 }}>
        {w > 0 ? (
          <Svg width={w} height={height + LABEL_H + 4}>
            {scale.ticks.map((t) => (
              <React.Fragment key={t}>
                <Line x1={AXIS_W} y1={y(t)} x2={w} y2={y(t)} stroke={C.lineSoft} strokeWidth={1} />
                <SvgText x={AXIS_W - 6} y={y(t) + 3} fontSize={9} fill={C.faint} textAnchor="end">
                  {tickText(t)}
                </SvgText>
              </React.Fragment>
            ))}
            {active !== null ? (
              <Rect x={AXIS_W + slot * active} y={0} width={slot} height={height} fill={C.surface} opacity={0.7} />
            ) : null}
            {mode === 'bar'
              ? data.map((v, i) => {
                  if (v === null || !(v > 0)) return null;
                  const h = Math.max(3, height - y(v));
                  return <Rect key={i} x={cx(i) - barW / 2} y={height - h} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={color} />;
                })
              : null}
            {mode === 'line'
              ? segments.map((d, i) => (
                  <Path key={i} d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                ))
              : null}
            {mode === 'line' && n <= 31
              ? data.map((v, i) => (v === null ? null : <Circle key={i} cx={cx(i)} cy={y(v)} r={active === i ? 4.5 : 2.5} fill={color} />))
              : null}
            {labels.map((l, i) =>
              i % every === 0 ? (
                <SvgText key={i} x={cx(i)} y={height + LABEL_H} fontSize={9} fill={C.faint} textAnchor="middle">
                  {l}
                </SvgText>
              ) : null,
            )}
          </Svg>
        ) : null}
      </Pressable>
      {active !== null ? (
        <View pointerEvents="none" style={[styles.tip, { left: Math.max(0, Math.min(w - 72, cx(active) - 36)) }]}>
          <Text style={[styles.tipV, { color: C.ink }]}>{hot === null ? '-' : fmt(hot)}</Text>
          <Text style={[styles.tipL, { color: C.muted }]}>{labels[active]}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Line ↔ bar switch, the same control and order as the web analytics cards. */
export function ChartModeToggle({ value, onChange, labels }: {
  value: ChartMode;
  onChange: (m: ChartMode) => void;
  labels: { type: string; line: string; bar: string };
}) {
  const { C } = useTheme();
  return (
    <Seg
      accessibilityLabel={labels.type}
      grow={false}
      value={value}
      onChange={onChange}
      options={[
        { value: 'line', label: labels.line },
        { value: 'bar', label: labels.bar },
      ]}
      renderOption={(o, on) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={o.value === 'line' ? 'trending-up' : 'bar-chart'} size={12} color={on ? C.ink : C.muted} />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: on ? C.ink : C.muted }}>{o.label}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  tip: {
    position: 'absolute',
    top: -6,
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00000014',
    alignItems: 'center',
    shadowColor: '#1C1917',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tipV: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, fontVariant: ['tabular-nums'] },
  tipL: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9.5 },
});
