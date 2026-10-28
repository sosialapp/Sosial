import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, Pressable, Easing, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme, T, Palette } from '../theme';
import { PrimaryBtn, SocialGlyph } from '../components/ui';
import { tr, SUPPORTED_LOCALES } from '../i18n';
import { LOCALE_NAMES } from '../utils/account';

/** All ten channels, one circle around the bolt. */
const NODES = ['x', 'instagram', 'tiktok', 'facebook', 'threads', 'youtube', 'bluesky', 'mastodon', 'linkedin', 'pinterest'];

/** Each channel ignites in its own brand color, no house orange anywhere. */
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
const ACircle = Animated.createAnimatedComponent(Circle);

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
  const march = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const circulate = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true }),
    );
    const beat = Animated.loop(
      Animated.timing(heart, { toValue: 1, duration: 1700, easing: Easing.linear, useNativeDriver: true }),
    );
    // Dash period is 3 + 7 = 10 units: shifting exactly one period loops seamlessly, forever.
    const flow = Animated.loop(
      Animated.timing(march, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
    );
    circulate.start();
    beat.start();
    flow.start();
    return () => { circulate.stop(); beat.stop(); flow.stop(); };
  }, [spin, heart, march]);
  const marchOffset = march.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const orbitRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const nodeCounter = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  // Spokes begin just outside the center glow, never buried under it.
  const TRIM = 58 / ORBIT_R;
  const trim = (p: { x: number; y: number }) => ({ x: ORBIT_C + (p.x - ORBIT_C) * TRIM, y: ORBIT_C + (p.y - ORBIT_C) * TRIM });
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
        <ACircle cx={ORBIT_C} cy={ORBIT_C} r={ORBIT_R} fill="none" stroke={C.lineSoft} strokeWidth={1} strokeDasharray="3 7" strokeDashoffset={marchOffset} />
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={56} fill={C.accentSoft} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: orbitRotate }] }]}>
        <Svg width={ORBIT} height={ORBIT} style={StyleSheet.absoluteFill}>
          {pts.map((p, i) => {
            const s = trim(p);
            return (
              <Line key={`base-${i}`} x1={s.x} y1={s.y} x2={p.x} y2={p.y} stroke={C.lineSoft} strokeWidth={1} strokeDasharray="4 5" />
            );
          })}
          {pts.map((p, i) => {
            const s = trim(p);
            return (
              <ALine
                key={`lit-${i}`}
                x1={s.x}
                y1={s.y}
                x2={p.x}
                y2={p.y}
                stroke={BRAND[NODES[i]]}
                strokeWidth={2.5}
                strokeDasharray="4 5"
                opacity={progress.interpolate({ inputRange: [i * 0.05, i * 0.05 + 0.3], outputRange: [0, 1], extrapolate: 'clamp' })}
              />
            );
          })}
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

/** First-run brand moment: one promise, one button. Auth lives behind it.
 *  The language picker under the button sets the app language before sign-in. */
export default function LandingScreen({
  onGetStarted,
  locale,
  onLocale,
}: {
  onGetStarted: () => void;
  locale: string;
  onLocale: (locale: string) => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [picking, setPicking] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={s.wrap}
        showsVerticalScrollIndicator={false}
      >
        <OrbitIllustration />
        <Text style={[T.display, { color: C.ink, textAlign: 'center' }]}>Sosial</Text>
        <Text style={s.sub}>{tr('wSub')}</Text>
        <Text style={s.hint}>{tr('lHint')}</Text>
      </ScrollView>
      <View style={s.footer}>
        <PrimaryBtn label={tr('lStart')} icon="arrow-forward" onPress={onGetStarted} />
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`${tr('aLang')}: ${LOCALE_NAMES[locale] ?? locale}`}
          hitSlop={8}
          style={s.lang}
        >
          <Ionicons name="globe-outline" size={16} color={C.muted} />
          <Text style={s.langT}>{LOCALE_NAMES[locale] ?? locale}</Text>
          <Ionicons name="chevron-down" size={14} color={C.muted} />
        </Pressable>
      </View>
      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={s.scrim} onPress={() => setPicking(false)} accessibilityLabel={tr('wClose')}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetT}>{tr('aLang')}</Text>
            {SUPPORTED_LOCALES.map((l) => (
              <Pressable
                key={l}
                onPress={() => { onLocale(l); setPicking(false); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: l === locale }}
                style={s.row}
              >
                <Text style={[s.rowT, l === locale && { fontFamily: 'PlusJakartaSans_700Bold' }]}>{LOCALE_NAMES[l] ?? l}</Text>
                {l === locale ? <Ionicons name="checkmark" size={18} color={C.ink} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
    footer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 22, gap: 14 },
    lang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
    langT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted },
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
    sheetT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.ink, marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
    rowT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: C.ink },
  });
