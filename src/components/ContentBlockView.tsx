import React from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ContentBlock, FontId } from '../types';
import { F } from '../utils/fonts';
import { DATA } from '../theme';

export function ChartBlock({ block, w, font, zoom = 1 }: { block: ContentBlock; w: number; font: FontId; zoom?: number }) {
  const k = w / 340;
  const sz = (base: number, f: number) => Math.max(base * k, w * f) * zoom;
  const txt = (base: number) => sz(base, 0.032);
  const hair = Math.max(0.5, w / 340);
  const st = block.style;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // chartVariant re-aims the block at any renderer; absent = type default.
  // Mirrors web blocks.tsx ChartBlock — keep in sync.
  const variant = st?.chartVariant ?? (block.type === 'bar' ? 'hbar' : block.type);
  const showV = st?.chartShowValues ?? true;
  const showL = st?.chartShowLabels ?? true;
  const valPos = st?.chartValuePos ?? 'out';
  const labPos = st?.chartLabelPos ?? 'out';
  const barImg = st?.chartBarImg ?? 'none';
  const barImgPos = st?.chartBarImgPos ?? 'middle';
  const labelImg = st?.chartLabelImg ?? true;
  const imgScale = st?.chartLabelImgSize != null ? clamp(st.chartLabelImgSize, 0.5, 2) : 1;
  const lum = (hex: string) => {
    const h = (hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const inked = (c: string) => (lum(c) < 0.55 ? '#ffffff' : '#111111');
  if (variant === 'hbar') {
    const data = block.chart ?? [];
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    const t = st?.chartThickness != null ? clamp(st.chartThickness, 0.25, 1.6) : 1;
    const barH = Math.max(6 * k, w * 0.03) * t;
    const rad = st?.chartRadius != null ? clamp(st.chartRadius, 0, 1) * barH * 0.6 : 6 * k;
    return (
      <View style={{ gap: Math.max(4 * k, w * 0.02) }}>
        {data.map((d, i) => {
          const fill = d.color ?? DATA[i % DATA.length];
          const pct = Math.max(0, (d.value / total)) * 100;
          const outsideL = showL && labPos === 'out';
          const outsideV = showV && valPos === 'out';
          const thumb = Math.max(14 * k, w * 0.052) * imgScale;
          return (
            <View key={i}>
              {outsideL || outsideV ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Math.max(6 * k, w * 0.02) }}>
                  {outsideL ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.max(4 * k, w * 0.018), flex: 1, minWidth: 0 }}>
                      {labelImg && d.img ? <Image source={{ uri: d.img }} style={{ width: thumb, height: thumb, borderRadius: Math.max(3 * k, w * 0.012) * imgScale }} resizeMode="cover" /> : null}
                      <Text style={{ ...F(font, true), fontSize: txt(8), color: block.textColor ?? '#111', flex: 1 }} numberOfLines={1} ellipsizeMode="tail">{d.label}</Text>
                    </View>
                  ) : null}
                  {outsideV ? <Text style={{ ...F(font), fontSize: txt(8), color: block.textColor ?? '#111' }}>{d.value}</Text> : null}
                </View>
              ) : null}
              <View style={{ height: barH, backgroundColor: '#00000015', borderRadius: rad, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: barH, backgroundColor: fill, borderRadius: rad, overflow: 'hidden', position: 'relative' }}>
                  {barImg === 'fill' && d.img ? <Image source={{ uri: d.img }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                  {barImg === 'tile' && d.img ? (
                    <Image
                      source={{ uri: d.img }}
                      style={{
                        position: 'absolute',
                        [barImgPos === 'bottom' ? 'right' : 'left']: Math.max(3 * k, w * 0.012),
                        top: (barH - barH * 0.68) / 2,
                        width: barH * 0.68,
                        height: barH * 0.68,
                        borderRadius: barH * 0.34,
                      }}
                      resizeMode="cover"
                    />
                  ) : null}
                  {showV && valPos === 'in' ? (
                    <Text style={{ position: 'absolute', right: Math.max(4 * k, w * 0.016), lineHeight: barH, ...F(font, true), fontSize: txt(8), color: d.img && barImg === 'fill' ? '#ffffff' : inked(fill) }}>{d.value}</Text>
                  ) : null}
                  {showL && labPos === 'in' ? (
                    <Text style={{ position: 'absolute', left: Math.max(4 * k, w * 0.016), lineHeight: barH, maxWidth: '70%', ...F(font, true), fontSize: txt(8), color: d.img && barImg === 'fill' ? '#ffffff' : inked(fill) }} numberOfLines={1} ellipsizeMode="tail">{d.label}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  }
  if (variant === 'pie') {
    const data = block.chart ?? [];
    const total = data.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;
    const colors = DATA;
    let acc = 0;
    const R = Math.max(20 * k, w * 0.15);
    const SW = R * (st?.chartThickness != null ? clamp(st.chartThickness, 0.15, 0.8) : 0.35);
    const VB = (R + SW / 2 + 2) * 2;
    const CC = VB / 2;
    const C = 2 * Math.PI * R;
    const legend = st?.chartLegend ?? 'right';
    const wheel = (
      <Svg width={VB} height={VB} viewBox={`0 0 ${VB} ${VB}`} style={legend === 'bottom' ? { alignSelf: 'center' } : { flexShrink: 0 }}>
        <Circle cx={CC} cy={CC} r={R} stroke="#00000015" strokeWidth={SW} fill="none" />
        {data.map((d, i) => {
          const frac = Math.max(0, d.value) / total;
          const dash = frac * C;
          const off = -acc * C;
          acc += frac;
          return <Circle key={i} cx={CC} cy={CC} r={R} stroke={d.color ?? colors[i % colors.length]} strokeWidth={SW} fill="none" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off} rotation={-90} origin={`${CC},${CC}`} />;
        })}
      </Svg>
    );
    const legendRows = legend === 'none' ? null : (
      <View style={legend === 'bottom' ? { width: '100%', gap: Math.max(3 * k, w * 0.015) } : { flex: 1, gap: Math.max(3 * k, w * 0.015) }}>
        {data.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Math.max(4 * k, w * 0.02) }}>
            {labelImg && d.img ? (
              <Image source={{ uri: d.img }} style={{ width: Math.max(14 * k, w * 0.05) * imgScale, height: Math.max(14 * k, w * 0.05) * imgScale, borderRadius: Math.max(4 * k, w * 0.014) * imgScale }} resizeMode="cover" />
            ) : (
              <View style={{ width: Math.max(8 * k, w * 0.025), height: Math.max(8 * k, w * 0.025), borderRadius: Math.max(4 * k, w * 0.0125), backgroundColor: d.color ?? colors[i % colors.length], flexShrink: 0 }} />
            )}
            <Text style={{ ...F(font), fontSize: sz(10, 0.03), color: block.textColor ?? '#111', flex: 1 }}>{d.label}</Text>
            <Text style={{ ...F(font, true), fontSize: sz(10, 0.03), color: block.textColor ?? '#111' }}>{Math.round((Math.max(0, d.value) / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    );
    if (legend === 'bottom')
      return <View style={{ alignItems: 'center', gap: Math.max(8 * k, w * 0.04) }}>{wheel}{legendRows}</View>;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.max(8 * k, w * 0.04) }}>
        {wheel}
        {legendRows}
      </View>
    );
  }
  if (variant === 'vbar') {
    const data = block.chart ?? [];
    const total = data.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;
    const t = st?.chartThickness != null ? clamp(st.chartThickness, 0.25, 1) : 1;
    const maxH = Math.max(80 * k, w * 0.35) * (st?.chartHeight != null ? clamp(st.chartHeight, 0.4, 1.6) : 1);
    const rad = st?.chartRadius != null ? clamp(st.chartRadius, 0, 1) * 12 * k : 6 * k;
    const tile = Math.max(10 * k, w * 0.05);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Math.max(6 * k, w * 0.03) }}>
        {data.map((d, i) => {
          const h = Math.max(2 * k, (Math.max(0, d.value) / total) * maxH);
          const fill = d.color ?? DATA[i % DATA.length];
          const ink = inked(fill);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 * k }}>
              {showV && valPos === 'out' ? <Text style={{ ...F(font, true), fontSize: txt(8), color: block.textColor ?? '#111' }} numberOfLines={1}>{d.value}</Text> : null}
              <View style={{ height: maxH, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                <View style={{ height: h, width: `${t * 100}%`, backgroundColor: fill, borderRadius: rad, overflow: 'hidden', position: 'relative' }}>
                  {barImg === 'fill' && d.img ? <Image source={{ uri: d.img }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                  {barImg === 'tile' && d.img ? (
                    <Image
                      source={{ uri: d.img }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        marginHorizontal: 'auto',
                        width: tile,
                        height: tile,
                        borderRadius: Math.max(3 * k, w * 0.014),
                        ...(barImgPos === 'top' ? { top: Math.max(2 * k, w * 0.01) } : barImgPos === 'bottom' ? { bottom: Math.max(2 * k, w * 0.01) } : { top: (h - tile) / 2 }),
                      }}
                      resizeMode="cover"
                    />
                  ) : null}
                  {showV && valPos === 'in' ? (
                    <Text style={{ position: 'absolute', top: Math.max(2 * k, w * 0.012), left: 0, right: 0, textAlign: 'center', ...F(font, true), fontSize: txt(8), color: d.img && barImg === 'fill' ? '#ffffff' : ink }} numberOfLines={1}>{d.value}</Text>
                  ) : null}
                  {showL && labPos === 'in' ? (
                    <Text style={{ position: 'absolute', bottom: Math.max(2 * k, w * 0.012), left: 0, right: 0, textAlign: 'center', ...F(font), fontSize: txt(8), color: d.img && barImg === 'fill' ? '#ffffff' : ink }} numberOfLines={1} ellipsizeMode="tail">{d.label}</Text>
                  ) : null}
                </View>
              </View>
              {showL && labPos === 'out' ? (
                <View style={{ flexDirection: 'column', alignItems: 'center', gap: Math.max(2 * k, w * 0.01), maxWidth: '100%', minWidth: 0 }}>
                  {labelImg && d.img ? <Image source={{ uri: d.img }} style={{ width: Math.max(16 * k, w * 0.06) * imgScale, height: Math.max(16 * k, w * 0.06) * imgScale, borderRadius: Math.max(4 * k, w * 0.016) * imgScale }} resizeMode="cover" /> : null}
                  <Text style={{ ...F(font), fontSize: txt(8), color: block.textColor ?? '#111', maxWidth: '100%', textAlign: 'center' }} numberOfLines={1} ellipsizeMode="tail">{d.label}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }
  return null;
}

/** Outer wrapper honouring per-block width % + alignment (width math inside
 *  keeps using the full content width so text scale stays predictable).
 *  Mirrors web blocks.tsx BlockView — keep in sync. */
export default function ContentBlockView(props: { block: ContentBlock; width: number; font?: FontId; zoom?: number; fill?: boolean }) {
  const { block } = props;
  const st = block.style;
  const pct = st?.width != null ? Math.min(1, Math.max(0.3, st.width)) : 1;
  const align = st?.align ?? 'left';
  if (pct >= 1 && align === 'left') return <ContentBlockInner {...props} />;
  return (
    <View
      style={{
        width: `${pct * 100}%` as any,
        alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <ContentBlockInner {...props} />
    </View>
  );
}

function ContentBlockInner({ block, width, font = 'inter', zoom = 1, fill = false }: { block: ContentBlock; width: number; font?: FontId; zoom?: number; fill?: boolean }) {
  const tc = block.textColor ?? '#111111';
  const w = width;
  const k = w / 340;
  const sz = (base: number, f: number) => Math.max(base * k, w * f) * zoom;
  const hair = Math.max(0.5, w / 340);

  if (block.type === 'free') {
    return (
      <View>
        {block.heading ? <Text style={{ ...F(font, true), fontSize: sz(12, 0.045), color: tc, marginBottom: Math.max(3 * k, w * 0.01) }}>{block.heading}</Text> : null}
        {(block.items ?? []).map((line, i) => (
          <Text key={i} style={{ ...F(font), fontSize: sz(11, 0.038), color: tc, lineHeight: sz(15, 0.053) }}>{line}</Text>
        ))}
      </View>
    );
  }
  if (block.type === 'bullets') {
    return (
      <View>
        {block.heading ? <Text style={{ ...F(font, true), fontSize: sz(12, 0.045), color: tc, marginBottom: Math.max(4 * k, w * 0.015) }}>{block.heading}</Text> : null}
        {(block.items ?? []).map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: Math.max(6 * k, w * 0.02), marginBottom: Math.max(4 * k, w * 0.015) }}>
            <View style={{ width: Math.max(6 * k, w * 0.02), height: Math.max(6 * k, w * 0.02), borderRadius: Math.max(3 * k, w * 0.01), backgroundColor: tc, marginTop: Math.max(3 * k, w * 0.013) }} />
            <Text style={{ ...F(font), fontSize: sz(11, 0.038), color: tc, flex: 1, lineHeight: sz(15, 0.053) }}>{line}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === 'numbered') {
    return (
      <View>
        {block.heading ? <Text style={{ ...F(font, true), fontSize: sz(12, 0.045), color: tc, marginBottom: Math.max(4 * k, w * 0.015) }}>{block.heading}</Text> : null}
        {(block.items ?? []).map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: Math.max(6 * k, w * 0.02), marginBottom: Math.max(4 * k, w * 0.015) }}>
            <View style={[{ width: Math.max(16 * k, w * 0.045), height: Math.max(16 * k, w * 0.045), borderRadius: Math.max(8 * k, w * 0.02), borderWidth: hair * 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 }, { borderColor: tc }]}>
              <Text style={{ ...F(font, true), fontSize: sz(9, 0.028), color: tc }}>{i + 1}</Text>
            </View>
            <Text style={{ ...F(font), fontSize: sz(11, 0.038), color: tc, flex: 1, lineHeight: sz(15, 0.053) }}>{line}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === 'table') {
    const rows = block.table ?? [['', '']];
    const st = block.style;
    const ts = st?.tableScale != null ? Math.min(1.6, Math.max(0.6, st.tableScale)) : 1;
    const colW = st?.tableColWidths;
    const headerBg = st?.tableHeaderBg ?? true;
    const zebra = st?.tableZebra ?? false;
    return (
      <View>
        {block.heading ? <Text style={{ ...F(font, true), fontSize: sz(12, 0.045), color: tc, marginBottom: Math.max(4 * k, w * 0.015) }}>{block.heading}</Text> : null}
        <View style={{ borderWidth: hair, borderColor: tc + '44', borderRadius: Math.max(6 * k, w * 0.015), overflow: 'hidden' }}>
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', backgroundColor: ri === 0 && headerBg ? tc + '14' : zebra && ri % 2 === 1 ? tc + '0A' : 'transparent' }}>
              {row.map((cell, ci) => (
                <Text key={ci} style={{ ...F(font, ri === 0), flex: colW?.[ci] ?? 1, fontSize: sz(9 * ts, 0.028 * ts), padding: Math.max(4 * k * ts, w * 0.012 * ts), color: tc, borderLeftWidth: ci > 0 ? hair : 0, borderLeftColor: tc + '22' }}>{cell}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (block.type === 'image') {
    const st = block.style;
    const asp = block.imageAspect ?? (block.imageH !== undefined ? 'custom' : 'wide');
    const fit = st?.imageFit ?? 'cover';
    const radius = st?.imageRadius != null ? Math.min(0.5, Math.max(0, st.imageRadius)) * w : 8 * k;
    const custom = asp === 'custom';
    const frame = custom ? { height: (block.imageH ?? 140) * k } : { aspectRatio: asp === 'square' ? 1 : 16 / 9 };
    const focus = block.imageFocus ?? 4;
    const fx = (focus % 3) - 1; // -1 show left … +1 show right
    const fy = Math.floor(focus / 3) - 1; // -1 show top … +1 show bottom
    const cropped = fx !== 0 || fy !== 0;
    const iw = cropped ? '140%' : '100%';
    const hAlign: 'center' | 'flex-start' | 'flex-end' = fx === 0 ? 'center' : fx > 0 ? 'flex-end' : 'flex-start';
    const vAlign: 'center' | 'flex-start' | 'flex-end' = fy === 0 ? 'center' : fy > 0 ? 'flex-end' : 'flex-start';
    const imgInner = custom
      ? { width: iw, height: cropped ? '140%' : '100%', alignSelf: hAlign }
      : { width: iw, aspectRatio: asp === 'square' ? 1 : 16 / 9, alignSelf: hAlign };
    // manual crop wins over the focal preset: scale the frame-filling photo and pan it
    const crop = block.imageCrop;
    const frameW = w;
    const frameH = custom ? (block.imageH ?? 140) * k : asp === 'square' ? w : w * (9 / 16);
    const overX = frameW * ((crop?.zoom ?? 1) - 1);
    const overY = frameH * ((crop?.zoom ?? 1) - 1);
    const cropInner = crop
      ? {
          width: `${crop.zoom * 100}%` as any,
          height: `${crop.zoom * 100}%` as any,
          // (x-1) mapping: -1 shows the left edge, +1 the right, 0 centered —
          // always full frame coverage. Matches web blocks.tsx.
          transform: [
            { translateX: ((crop.x - 1) * overX) / 2 },
            { translateY: ((crop.y - 1) * overY) / 2 },
          ],
        }
      : null;
    // in fixed-height cards the photo grows into leftover space instead of leaving a gap below
    const grow = fill ? { flexGrow: 1 } : null;
    return (
      <View style={grow}>
        {block.heading ? <Text style={{ ...F(font, true), fontSize: sz(12, 0.045), color: tc, marginBottom: Math.max(4 * k, w * 0.015) }}>{block.heading}</Text> : null}
        {block.imageUri ? (
          <View style={[frame, grow, { overflow: 'hidden', borderRadius: radius, justifyContent: crop ? 'flex-start' : vAlign }]}>
            <Image source={{ uri: block.imageUri }} style={(cropInner ?? imgInner) as any} resizeMode={fit} />
          </View>
        ) : (
          <View style={[frame, { width: '100%', borderRadius: radius, borderWidth: hair, borderStyle: 'dashed', borderColor: tc + '66', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ ...F(font), fontSize: sz(10, 0.03), color: tc + '99' }}>No image yet — pick one in the editor</Text>
          </View>
        )}
      </View>
    );
  }
  if (block.type === 'bar' || block.type === 'pie' || block.type === 'vbar') {
    return (
      <View>
        {block.heading ? <Text style={{ ...F(font, true), fontSize: sz(12, 0.045), color: tc, marginBottom: Math.max(4, w * 0.015) }}>{block.heading}</Text> : null}
        <ChartBlock block={block} w={w} font={font} zoom={zoom} />
      </View>
    );
  }
  return null;
}
