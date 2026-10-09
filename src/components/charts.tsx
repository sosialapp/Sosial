import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';

let uid = 0;
const nextId = () => `chart${++uid}`;

const LABEL_H = 16;

function useWidth() {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return { w, onLayout };
}

/** Area chart — gradient fill, gridlines, optional x labels, tap to scrub the
 *  nearest point (shows a value tooltip + vertical guide). SVG only. */
export function AreaChart({
  data,
  color,
  height = 72,
  strokeWidth = 2.5,
  showEndDot = true,
  labels,
  gridLines = 0,
  interactive = false,
  formatValue,
}: {
  data: number[];
  color: string;
  height?: number;
  strokeWidth?: number;
  showEndDot?: boolean;
  labels?: string[];
  gridLines?: number;
  interactive?: boolean;
  formatValue?: (v: number) => string;
}) {
  const { C } = useTheme();
  const { w, onLayout } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const hasLabels = !!labels && labels.length > 0;
  const totalH = height + (hasLabels ? LABEL_H : 0);
  if (n < 2) {
    return <View onLayout={onLayout} style={{ width: '100%', height: totalH }} />;
  }
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  const pad = span * 0.14;
  const min = lo - pad;
  const max = hi + pad;
  const pts = data.map((v, i) => ({
    x: (i / (n - 1)) * w,
    y: height - ((v - min) / (max - min)) * height,
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${pts[n - 1].x.toFixed(2)},${height} L${pts[0].x.toFixed(2)},${height} Z`;
  const last = pts[n - 1];
  const [id] = useState(nextId);
  const shown = active != null ? pts[active] : null;

  const onTap = (e: { nativeEvent: { locationX: number } }) => {
    if (!interactive || w <= 0) return;
    const x = e.nativeEvent.locationX;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < best) { best = d; idx = i; }
    }
    setActive(idx === active ? null : idx);
  };

  return (
    <View style={{ width: '100%' }}>
      <Pressable onPress={onTap} onLayout={onLayout} style={{ width: '100%', height }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0.28" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {Array.from({ length: gridLines }).map((_, i) => {
              const y = (height / (gridLines + 1)) * (i + 1);
              return <Line key={i} x1={0} y1={y} x2={w} y2={y} stroke={C.lineSoft} strokeWidth={1} />;
            })}
            <Path d={area} fill={`url(#${id})`} />
            <Path d={line} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {shown ? <Line x1={shown.x} y1={0} x2={shown.x} y2={height} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} /> : null}
            {shown ? <Circle cx={shown.x} cy={shown.y} r={4} fill={color} /> : null}
            {!shown && showEndDot ? <Circle cx={last.x} cy={last.y} r={3.5} fill={color} /> : null}
            {hasLabels
              ? labels!.map((l, i) =>
                  i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
                    <SvgText
                      key={i}
                      x={pts[i].x}
                      y={height + LABEL_H - 3}
                      fontSize={9}
                      fill={C.faint}
                      textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                    >
                      {l}
                    </SvgText>
                  ) : null,
                )
              : null}
          </Svg>
        ) : null}
      </Pressable>
      {shown && active != null ? (
        <View pointerEvents="none" style={[styles.tip, { left: Math.max(0, Math.min(w - 64, shown.x - 32)) }]}>
          <Text style={[styles.tipV, { color: C.ink }]}>{formatValue ? formatValue(data[active]) : String(data[active])}</Text>
          {hasLabels ? <Text style={[styles.tipL, { color: C.muted }]}>{labels![active]}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Vertical bar chart — gridlines, optional x labels, value labels, tap to
 *  highlight a bar. SVG only. */
export function BarsChart({
  data,
  color,
  height = 72,
  barGap = 6,
  radius = 3,
  labels,
  gridLines = 0,
  highlightIndex,
  showValues = false,
  interactive = false,
  formatValue,
}: {
  data: number[];
  color: string;
  height?: number;
  barGap?: number;
  radius?: number;
  labels?: string[];
  gridLines?: number;
  highlightIndex?: number;
  showValues?: boolean;
  interactive?: boolean;
  formatValue?: (v: number) => string;
}) {
  const { C } = useTheme();
  const { w, onLayout } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const hi = Math.max(1, ...data);
  const bw = n > 0 ? (w - barGap * (n - 1)) / n : 0;
  const hasLabels = !!labels && labels.length > 0;
  const totalH = height + (hasLabels ? LABEL_H : 0);
  const hot = active ?? highlightIndex ?? null;

  const onTap = (e: { nativeEvent: { locationX: number } }) => {
    if (!interactive || w <= 0 || n === 0) return;
    const slot = w / n;
    const idx = Math.max(0, Math.min(n - 1, Math.floor(e.nativeEvent.locationX / slot)));
    setActive(idx === active ? null : idx);
  };

  return (
    <View style={{ width: '100%' }}>
      <Pressable onPress={onTap} onLayout={onLayout} style={{ width: '100%', height: totalH }}>
        {w > 0 && n > 0 ? (
          <Svg width={w} height={totalH}>
            {Array.from({ length: gridLines }).map((_, i) => {
              const y = (height / (gridLines + 1)) * (i + 1);
              return <Line key={i} x1={0} y1={y} x2={w} y2={y} stroke={C.lineSoft} strokeWidth={1} />;
            })}
            {data.map((v, i) => {
              const h = Math.max(2, (v / hi) * height);
              const x = i * (bw + barGap);
              const y = height - h;
              const dim = hot != null && i !== hot;
              return <Rect key={i} x={x} y={y} width={bw} height={h} rx={radius} fill={color} opacity={v > 0 ? (dim ? 0.32 : 1) : 0.25} />;
            })}
            {showValues
              ? data.map((v, i) => {
                  const h = Math.max(2, (v / hi) * height);
                  const x = i * (bw + barGap) + bw / 2;
                  return (
                    <SvgText key={i} x={x} y={height - h - 4} fontSize={9} fill={C.faint} textAnchor="middle">
                      {formatValue ? formatValue(v) : String(v)}
                    </SvgText>
                  );
                })
              : null}
            {hasLabels
              ? labels!.map((l, i) => (
                  <SvgText key={i} x={i * (bw + barGap) + bw / 2} y={height + LABEL_H - 3} fontSize={9} fill={C.faint} textAnchor="middle">
                    {l}
                  </SvgText>
                ))
              : null}
          </Svg>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Horizontal bar list — the mobile analogue of the web `HBarList`. Each row
 *  is a label + value over a track/fill. */
export function HBarList({
  rows,
  max,
  height = 7,
  gap = 14,
  trackColor,
  formatValue,
}: {
  rows: { label: string; value: number; color?: string; sub?: string }[];
  max?: number;
  height?: number;
  gap?: number;
  trackColor?: string;
  formatValue?: (v: number) => string;
}) {
  const { C } = useTheme();
  const hi = Math.max(1, max ?? Math.max(...rows.map((r) => r.value), 1));
  return (
    <View style={{ gap }}>
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[styles.hbLabel, { color: C.ink }]} numberOfLines={1}>
              {r.label}
              {r.sub ? <Text style={{ color: C.faint, fontFamily: 'PlusJakartaSans_400Regular' }}>  {r.sub}</Text> : null}
            </Text>
            <Text style={[styles.hbValue, { color: C.soft }]}>{formatValue ? formatValue(r.value) : r.value}</Text>
          </View>
          <View style={{ height, borderRadius: height / 2, backgroundColor: trackColor ?? C.surface, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, (r.value / hi) * 100)}%`, height, borderRadius: height / 2, backgroundColor: r.color ?? C.accent }} />
          </View>
        </View>
      ))}
    </View>
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
  hbLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, flexShrink: 1 },
  hbValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, fontVariant: ['tabular-nums'] },
});
