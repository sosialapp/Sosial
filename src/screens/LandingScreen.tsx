import React, { useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, Pressable, Easing } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme, T, Palette } from '../theme';
import { PrimaryBtn, SocialGlyph } from '../components/ui';

const NODES = ['x', 'instagram', 'tiktok', 'facebook', 'threads', 'youtube'];

const ORBIT = 300;
const ORBIT_C = ORBIT / 2;
const ORBIT_R = 102;
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
  const pts = NODES.map((_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
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
            stroke={C.accent}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${ORBIT_R}`}
            strokeDashoffset={progress.interpolate({ inputRange: [i * 0.08, i * 0.08 + 0.3], outputRange: [ORBIT_R, 0], extrapolate: 'clamp' })}
          />
        ))}
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={56} fill={C.accentSoft} />
      </Svg>
      <Pressable
        onPressIn={hold}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel="Hold the bolt to light up connected channels"
        style={{ position: 'absolute', left: ORBIT_C - 60, top: ORBIT_C - 60, width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale: boltScale }] }}>
          <Image source={require('../../assets/bolt.png')} style={{ width: 56, height: 72 }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
      {NODES.map((n, i) => {
        const span: [number, number] = [0.55 + i * 0.05, 0.75 + i * 0.05];
        const fill = progress.interpolate({ inputRange: span, outputRange: [C.card, C.accent], extrapolate: 'clamp' });
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
            <SocialGlyph platform={n} size={22} color={C.ink} />
            <Animated.View style={{ position: 'absolute', opacity: lit }}>
              <SocialGlyph platform={n} size={22} color="#fff" />
            </Animated.View>
          </Animated.View>
        );
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
