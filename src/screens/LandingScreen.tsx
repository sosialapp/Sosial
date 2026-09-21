import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme, T, Palette } from '../theme';
import { PrimaryBtn, SocialGlyph } from '../components/ui';

const NODES = ['x', 'instagram', 'tiktok', 'facebook', 'threads', 'youtube'];

const ORBIT = 300;
const ORBIT_C = ORBIT / 2;
const ORBIT_R = 102;
const NODE = 54;

/** Sosial at the center, every channel one line away. */
function OrbitIllustration() {
  const { C } = useTheme();
  const pts = NODES.map((_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return { x: ORBIT_C + ORBIT_R * Math.cos(a), y: ORBIT_C + ORBIT_R * Math.sin(a) };
  });
  return (
    <View style={{ width: ORBIT, height: ORBIT }}>
      <Svg width={ORBIT} height={ORBIT} style={StyleSheet.absoluteFill}>
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={ORBIT_R} fill="none" stroke={C.lineSoft} strokeWidth={1} strokeDasharray="3 7" />
        {pts.map((p, i) => (
          <Line key={i} x1={ORBIT_C} y1={ORBIT_C} x2={p.x} y2={p.y} stroke={C.lineSoft} strokeWidth={1} />
        ))}
        <Circle cx={ORBIT_C} cy={ORBIT_C} r={56} fill={C.accentSoft} />
      </Svg>
      <View style={{ position: 'absolute', left: ORBIT_C - 28, top: ORBIT_C - 36 }}>
        <Image source={require('../../assets/bolt.png')} style={{ width: 56, height: 72 }} resizeMode="contain" />
      </View>
      {NODES.map((n, i) => (
        <View
          key={n}
          style={{
            position: 'absolute',
            left: pts[i].x - NODE / 2,
            top: pts[i].y - NODE / 2,
            width: NODE,
            height: NODE,
            borderRadius: NODE / 2,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.lineSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SocialGlyph platform={n} size={22} color={C.ink} />
        </View>
      ))}
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
    footer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 34 },
  });
