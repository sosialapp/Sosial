import React, { useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, Pressable, Easing } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme, T, Palette } from '../theme';
import { PrimaryBtn, SocialGlyph } from '../components/ui';

const INNER = ['x', 'instagram', 'tiktok', 'facebook', 'threads', 'youtube'];
const OUTER = ['bluesky', 'mastodon', 'linkedin', 'pinterest'];
const OUTER_ANGLES = [-45, 45, 135, 225];
/** inner-ring indices each outer node continues the network from */
const OUTER_LINKS: [number, number][] = [[1, 0], [2, 3], [3, 4], [5, 0]];

/** Each channel ignites in its own brand color — no house orange anywhere. */
const BRAND: Record<string, string> = {
  x: '#000000',
  instagram: '#E1306C',
  tiktok: '#000000',
  facebook: '#1877F2',
  threads: '#000000',
  youtube: '#FF0000',
  bluesky: '#0085FF',
  mastodon: '#6364FF',
  linkedin: '#0A66C2',
  pinterest: '#E60023',
};

const ORBIT = 300;
const ORBIT_C = ORBIT / 2;
const R1 = 80;
const R2 = 130;
const NODE = 48;
const ONODE = 44;

const ALine = Animated.createAnimatedComponent(Line);

/**
 * The network: Sosial at the center, six channels on the inner ring, four
 * more continuing outward — every node meshed to its neighbours. Hold the
 * bolt: spokes ignite, the wave continues ring to ring, then each channel
 * pops lit in its brand color. Let go early and it all drains back out.
 */
function OrbitIllustration() {
  const { C } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const inner = INNER.map((_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return { x: ORBIT_C + R1 * Math.cos(a), y: ORBIT_C + R1 * Math.sin(a) };
  });
  const outer = OUTER_ANGLES.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: ORBIT_C + R2 * Math.cos(a), y: ORBIT_C + R2 * Math.sin(a) };
  });
  const links = OUTER_LINKS.flatMap(([a, b], k) => ([
    { from: inner[a], to: outer[k], brand: BRAND[OUTER[k]] },
    { from: inner[b], to: outer[k], brand: BRAND[OUTER[k]] },
  ])).map((l) => ({ ...l, len: Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y) }));

  const hold = () => {
    anim.current?.stop();
    anim.current = Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.current.start();
  };
  const release = () => {
    anim.current?.stop();
    anim.current = Animated.timing(progress, { toValue: 0, duration: 500, useNativeDriver: false });
    anim.current.start();
  };

  const boltScale = progress.interpolate({ inputRange: [0, 0.25], outputRange: [1, 1.12], extrapolate: 'clamp' });

  const renderNode = (id: string, p: { x: number; y: number }, size: number, glyph: number, span: [number, number]) => {
    const fill = progress.interpolate({ inputRange: span, outputRange: [C.card, BRAND[id]], extrapolate: 'clamp' });
    const lit = progress.interpolate({ inputRange: span, outputRange: [0, 1], extrapolate: 'clamp' });
    return (
      <Animated.View
        key={id}
        style={{
          position: 'absolute',
          left: p.x - size / 2,
          top: p.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderWidth: 1,
          borderColor: C.lineSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SocialGlyph platform={id} size={glyph} color={C.ink} />
        <Animated.View style={{ position: 'absolute', opacity: lit }}>
          <SocialGlyph platform={id} size={glyph} color="#fff" />
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <View style={{ width: ORBIT, height: ORBIT }}>
      <Svg width={ORBIT} height={ORBIT} style={StyleSheet.absoluteFill}>
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={R2} fill="none" stroke={C.lineSoft} strokeWidth={1} strokeDasharray="3 7" />
        {inner.map((p, i) => (
          <Line key={`sbase-${i}`} x1={ORBIT_C} y1={ORBIT_C} x2={p.x} y2={p.y} stroke={C.lineSoft} strokeWidth={1} />
        ))}
        {links.map((l, j) => (
          <Line key={`lbase-${j}`} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke={C.lineSoft} strokeWidth={1} />
        ))}
        {inner.map((p, i) => (
          <ALine
            key={`slit-${i}`}
            x1={ORBIT_C}
            y1={ORBIT_C}
            x2={p.x}
            y2={p.y}
            stroke={BRAND[INNER[i]]}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${R1}`}
            strokeDashoffset={progress.interpolate({ inputRange: [i * 0.06, i * 0.06 + 0.22], outputRange: [R1, 0], extrapolate: 'clamp' })}
          />
        ))}
        {links.map((l, j) => (
          <ALine
            key={`llit-${j}`}
            x1={l.from.x}
            y1={l.from.y}
            x2={l.to.x}
            y2={l.to.y}
            stroke={l.brand}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${l.len}`}
            strokeDashoffset={progress.interpolate({ inputRange: [0.3 + j * 0.045, 0.3 + j * 0.045 + 0.2], outputRange: [l.len, 0], extrapolate: 'clamp' })}
          />
        ))}
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={38} fill={C.accentSoft} />
      </Svg>
      <Pressable
        onPressIn={hold}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel="Hold the bolt to light up every channel"
        style={{ position: 'absolute', left: ORBIT_C - 60, top: ORBIT_C - 60, width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale: boltScale }] }}>
          <Image source={require('../../assets/bolt.png')} style={{ width: 56, height: 72 }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
      {INNER.map((n, i) => renderNode(n, inner[i], NODE, 20, [0.5 + i * 0.03, 0.68 + i * 0.03]))}
      {OUTER.map((n, k) => {
        const s = 0.68 + k * 0.06;
        return renderNode(n, outer[k], ONODE, 17, [s, Math.min(s + 0.16, 1)]);
      })}
    </View>
  );
}

/** First-run brand moment: one promise, one button. Auth lives behind it. */
export default function LandingScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={s.wrap}
        showsVerticalScrollIndicator={false}
      >
        <OrbitIllustration />
        <Text style={[T.display, { color: C.ink, textAlign: 'center' }]}>Sosial</Text>
        <Text style={s.sub}>Every channel. One calendar.</Text>
        <Text style={s.hint}>Hold the bolt to light up every channel</Text>
      </ScrollView>
      <View style={s.footer}>
        <PrimaryBtn label="Get started" icon="arrow-forward" onPress={onGetStarted} />
      </View>
    </View>
  );
}

const makeS = (C: Palette) =>
  StyleSheet.create({
    wrap: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingTop: 48,
      paddingBottom: 16,
      gap: 8,
    },
    sub: { ...(T.body as object), color: C.muted, textAlign: 'center' } as any,
    hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 10 },
    footer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 34 },
  });
