import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { PRIVACY_SECTIONS as SECTIONS } from '../utils/legal';

export default function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.kicker}>Legal</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]}>Privacy Policy</Text>
        <Text style={s.sub}>Last updated September 2026. Short version: everything stays on your phone.</Text>
        <View style={{ gap: 18, marginTop: 22 }}>
          {SECTIONS.map((sec) => (
            <View key={sec.title}>
              <Text style={s.t}>{sec.title}</Text>
              <Text style={s.b}>{sec.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  kicker: { ...T.tag, color: C.accent, marginTop: 24 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6 },
  t: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, letterSpacing: -0.2, color: C.ink },
  b: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, color: C.soft, marginTop: 6 },
});
