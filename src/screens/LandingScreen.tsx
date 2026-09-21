import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, T, Palette } from '../theme';
import { PrimaryBtn } from '../components/ui';

const POINTS: { icon: string; title: string; sub: string }[] = [
  { icon: 'sparkles', title: 'Write with AI', sub: 'Rough thought in, post-ready caption out.' },
  { icon: 'calendar-outline', title: 'Schedule every channel', sub: 'One calendar for X, Threads, TikTok and more.' },
  { icon: 'checkmark-circle-outline', title: 'Publish with confidence', sub: 'Previews and approvals before anything goes live.' },
];

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
        <Image source={require('../../assets/bolt.png')} style={{ width: 84, height: 108 }} resizeMode="contain" />
        <Text style={[T.display, { color: C.ink, textAlign: 'center' }]}>Sosial</Text>
        <Text style={s.sub}>Every channel. One calendar.</Text>
        <View style={s.points}>
          {POINTS.map((p) => (
            <View key={p.title} style={s.point}>
              <View style={s.pointIcon}>
                <Ionicons name={p.icon as any} size={20} color={C.accentInk} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.pointT}>{p.title}</Text>
                <Text style={s.pointS}>{p.sub}</Text>
              </View>
            </View>
          ))}
        </View>
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
    points: { width: '100%', maxWidth: 400, gap: 10, marginTop: 26 },
    point: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: C.card,
      borderRadius: 16,
      paddingHorizontal: 15,
      paddingVertical: 13,
    },
    pointIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pointT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
    pointS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
    footer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 34 },
  });
