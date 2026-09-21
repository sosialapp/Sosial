import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, Pressable, Easing } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme, T, Palette } from '../theme';
import { PrimaryBtn, SocialGlyph } from '../components/ui';

/** All ten channels, one circle around the bolt. */
const NODES = ['x', 'instagram', 'tiktok', 'facebook', 'threads', 'youtube', 'bluesky', 'mastodon', 'linkedin', 'pinterest'];

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
const ORBIT_R = 118;
const NODE = 54;

const ALine = Animated.createAnimatedComponent(Line);

/**
 * Sosial at the center, every channel one line away. Hold the bolt: the
 * lines ignite outward one after another, then each channel pops lit.
 * Let go early and it all drains back out.
 */
function OrbitIllustration() {
  const { C } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  // Ambient life: the ring circulates around the bolt while the bolt itself
  // beats like a heart. Glyphs counter-rotate so they stay upright.
  const spin = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const circulate = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true }),
    );
    const beat = Animated.loop(
      Animated.timing(heart, { toValue: 1, duration: 1700, easing: Easing.linear, useNativeDriver: true }),
    );
    circulate.start();
    beat.start();
    return () => { circulate.stop(); beat.stop(); };
  }, [spin, heart]);
  const orbitRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const nodeCounter = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const heartScale = heart.interpolate({ inputRange: [0, 0.1, 0.2, 0.32, 0.42, 1], outputRange: [1, 1.12, 1, 1.07, 1, 1] });
  const pts = NODES.map((_, i) => {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return { x: ORBIT_C + ORBIT_R * Math.cos(a), y: ORBIT_C + ORBIT_R * Math.sin(a) };
  });

  const hold = () => {
    anim.current?.stop();
    anim.current = Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.current.start();
  };
  const release = () => {
    anim.current?.stop();
    anim.current = Animated.timing(progress, { toValue: 0, duration: 450, useNativeDriver: false });
    anim.current.start();
  };

  const boltScale = progress.interpolate({ inputRange: [0, 0.35], outputRange: [1, 1.12], extrapolate: 'clamp' });

  return (
    <View style={{ width: ORBIT, height: ORBIT }}>
      <Svg width={ORBIT} height={ORBIT} style={StyleSheet.absoluteFill}>
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={ORBIT_R} fill="none" stroke={C.lineSoft} strokeWidth={1} strokeDasharray="3 7" />
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={56} fill={C.accentSoft} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: orbitRotate }] }]}>
        <Svg width={ORBIT} height={ORBIT} style={StyleSheet.absoluteFill}>
          {pts.map((p, i) => (
            <Line key={`base-${i}`} x1={ORBIT_C} y1={ORBIT_C} x2={p.x} y2={p.y} stroke={C.lineSoft} strokeWidth={1} />
          ))}
          {pts.map((p, i) => (
            <ALine
              key={`lit-${i}`}
              x1={ORBIT_C}
              y1={ORBIT_C}
              x2={p.x}
              y2={p.y}
              stroke={BRAND[NODES[i]]}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${ORBIT_R}`}
              strokeDashoffset={progress.interpolate({ inputRange: [i * 0.05, i * 0.05 + 0.25], outputRange: [ORBIT_R, 0], extrapolate: 'clamp' })}
            />
          ))}
        </Svg>
        {NODES.map((n, i) => {
          const start = 0.6 + i * 0.035;
          const span: [number, number] = [start, Math.min(start + 0.18, 1)];
          const fill = progress.interpolate({ inputRange: span, outputRange: [C.card, BRAND[n]], extrapolate: 'clamp' });
          const lit = progress.interpolate({ inputRange: span, outputRange: [0, 1], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={n}
              style={{
                position: 'absolute',
                left: pts[i].x - NODE / 2,
                top: pts[i].y - NODE / 2,
                width: NODE,
                height: NODE,
                borderRadius: NODE / 2,
                backgroundColor: fill,
                borderWidth: 1,
                borderColor: C.lineSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View style={{ width: NODE, height: NODE, transform: [{ rotate: nodeCounter }], alignItems: 'center', justifyContent: 'center' }}>
                <SocialGlyph platform={n} size={24} color={C.ink} />
                <Animated.View style={{ position: 'absolute', opacity: lit }}>
                  <SocialGlyph platform={n} size={24} color="#fff" />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          );
        })}
      </Animated.View>
      <Pressable
        onPressIn={hold}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel="Hold the bolt to light up connected channels"
        style={{ position: 'absolute', left: ORBIT_C - 60, top: ORBIT_C - 60, width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <Animated.View style={{ transform: [{ scale: boltScale }] }}>
            <Image source={require('../../assets/bolt.png')} style={{ width: 56, height: 72 }} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      </Pressable>
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
        <Text style={s.hint}>Hold the bolt to light up your channels</Text>
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
