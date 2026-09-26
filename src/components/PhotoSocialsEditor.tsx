import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { usePost } from '../store/PostContext';
import { SocialPlatform, FontId } from '../types';
import { SOCIAL_META, uid, PALETTE } from '../constants';
import { FONTS } from '../utils/fonts';
import { useTheme, Palette, R } from '../theme';
import { Txt, PillToggle, Seg, Field, Stepper, PrimaryBtn, GhostBtn, SocialGlyph, Swatches, Section } from './ui';

const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok', 'threads', 'facebook', 'youtube', 'linkedin', 'x', 'bluesky', 'mastodon', 'pinterest'];

const FONT_IDS: FontId[] = ['jakarta', 'inter', 'space-grotesk', 'playfair', 'crimson', 'poppins', 'mono', 'anton', 'system'];


export default function PhotoSocialsEditor() {
  const { C } = useTheme();
  const st = makeSt(C);
  const { page, patchPfp, setSocials } = usePost();
  if (!page) return null;
  const p = page.pfp;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) patchPfp({ uri: res.assets[0].uri });
  };

  const toggle = (platform: SocialPlatform) => {
    const existing = page.socials.find((s) => s.platform === platform);
    if (existing) {
      setSocials(page.socials.map((s) => (s.platform === platform ? { ...s, visible: !s.visible } : s)));
    } else {
      setSocials([...page.socials, { id: uid('s'), platform, handle: '@yourhandle', visible: true, font: 'jakarta', bold: true, italic: false }]);
    }
  };

  const setHandle = (platform: SocialPlatform, handle: string) => {
    setSocials(page.socials.map((s) => (s.platform === platform ? { ...s, handle } : s)));
  };

  const patchSocial = (platform: SocialPlatform, patch: Partial<typeof page.socials[0]>) => {
    setSocials(page.socials.map((s) => (s.platform === platform ? { ...s, ...patch } : s)));
  };

  const visibleSocials = page.socials.filter((s) => s.visible);
  /** Which platform's font dropdown is open (modal picker). */
  const [fontFor, setFontFor] = useState<SocialPlatform | null>(null);

  return (
    <View style={{ gap: 18 }}>
      <View style={st.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.switchT}>Show photo & socials</Text>
          <Text style={st.switchS}>{(p.hidden ?? false) ? 'Hidden on the canvas' : 'Visible on the canvas'}</Text>
        </View>
        <PillToggle on={!(p.hidden ?? false)} onPress={() => patchPfp({ hidden: !(p.hidden ?? false) })} />
      </View>

      <View style={{ gap: 12, opacity: p.hidden ? 0.45 : 1 }}>
        <Section no="01" title="Portrait" hint="Your face on the post." />
        {p.uri ? (
          <View style={st.photoCard}>
            <Image source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: p.shape === 'circle' ? 32 : 14 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><PrimaryBtn label="Change" onPress={pick} /></View>
                <View style={{ flex: 1 }}><GhostBtn label="Remove" onPress={() => patchPfp({ uri: undefined })} danger /></View>
              </View>
            </View>
          </View>
        ) : (
          <PrimaryBtn label="Choose a profile picture" onPress={pick} />
        )}

        <Field label="Position">
          <Seg options={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }]} value={p.pfpY} onChange={(v) => patchPfp({ pfpY: v as 'top' | 'bottom' })} />
        </Field>
        <Field label="Alignment">
          <Seg options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} value={p.align} onChange={(v) => patchPfp({ align: v as 'left' | 'center' | 'right' })} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Size" hint={`${p.size}px`}>
              <Stepper value={p.size} onChange={(v) => patchPfp({ size: v })} step={4} min={28} max={64} format={(v) => `${v}`} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Border" hint={`${p.borderW}px`}>
              <Stepper value={p.borderW} onChange={(v) => patchPfp({ borderW: v })} step={1} min={0} max={6} format={(v) => `${v}`} />
            </Field>
          </View>
        </View>
        <Field label="Shape">
          <Seg options={[{ value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' }]} value={p.shape} onChange={(v) => patchPfp({ shape: v as 'circle' | 'rounded' })} />
        </Field>
        <Field label="Username" hint="Universal name under your photo.">
          <Txt value={p.username ?? ''} onChangeText={(v) => patchPfp({ username: v })} placeholder="Your name" />
        </Field>
        <Field label="Card handle" hint="Overrides the @handle in the card header. Empty = first badge handle.">
          <Txt value={p.customHandle ?? ''} onChangeText={(v) => patchPfp({ customHandle: v })} placeholder="@yourhandle" />
        </Field>
      </View>

      <View style={{ gap: 12, opacity: p.hidden ? 0.45 : 1 }}>
        <Section no="02" title="Badges" hint="Centered next to your photo on the export." />
        <View style={st.list}>
          {ALL_PLATFORMS.map((pl, i) => {
            const found = page.socials.find((s) => s.platform === pl);
            const on = !!found?.visible;
            return (
              <View key={pl} style={[i > 0 && st.rowDiv, !on && { opacity: 0.55 }]}>
                <View style={st.row}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: SOCIAL_META[pl].bg, alignItems: 'center', justifyContent: 'center' }}>
                    <SocialGlyph platform={pl} size={16} color="#fff" />
                  </View>
                  <Text style={st.rowT}>{SOCIAL_META[pl].label}</Text>
                  <PillToggle on={on} onPress={() => toggle(pl)} />
                </View>
                {on && found ? (
                  <View style={st.detail}>
                    <Text style={st.hLabel}>{SOCIAL_META[pl].label} handle</Text>
                    <Txt value={found.handle} onChangeText={(v) => setHandle(pl, v)} placeholder="@yourhandle" />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={st.miniLabel}>Font</Text>
                        <TouchableOpacity onPress={() => setFontFor(pl)} style={st.dropBtn} activeOpacity={0.7}>
                          <Text
                            style={[st.dropBtnT, FONTS[found.font]?.regular ? { fontFamily: FONTS[found.font].regular as string } : null]}
                            numberOfLines={1}
                          >
                            {FONTS[found.font]?.label ?? 'Jakarta'}
                          </Text>
                          <Ionicons name="chevron-down" size={15} color={C.muted} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text style={st.miniLabel}>Style</Text>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          <TouchableOpacity onPress={() => patchSocial(pl, { bold: !found.bold })} style={[st.miniToggle, found.bold && st.miniBtnOn]} activeOpacity={0.7}>
                            <Text style={[st.miniBtnT, found.bold && st.miniBtnTOn, { fontFamily: 'PlusJakartaSans_700Bold' }]}>B</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => patchSocial(pl, { italic: !found.italic })} style={[st.miniToggle, found.italic && st.miniBtnOn]} activeOpacity={0.7}>
                            <Text style={[st.miniBtnT, found.italic && st.miniBtnTOn, { fontStyle: 'italic' }]}>I</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Modal visible={fontFor !== null} transparent animationType="fade" onRequestClose={() => setFontFor(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setFontFor(null)} style={st.sheetBg}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={st.sheet}>
              {FONT_IDS.map((f) => {
                const cur = fontFor ? page.socials.find((s) => s.platform === fontFor)?.font : undefined;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => {
                      if (fontFor) patchSocial(fontFor, { font: f });
                      setFontFor(null);
                    }}
                    style={st.opt}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.optT, FONTS[f]?.regular ? { fontFamily: FONTS[f].regular as string } : null, cur === f && { color: C.accent }]}>
                      {FONTS[f].label}
                    </Text>
                    {cur === f ? <Ionicons name="checkmark" size={16} color={C.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {visibleSocials.length > 0 ? (
          <View style={{ gap: 14 }}>
            <Field label="Placement">
              <Seg
                options={[
                  { value: 'below', label: 'Below' },
                  { value: 'right', label: 'Right' },
                  { value: 'left', label: 'Left' },
                ]}
                value={p.socialPos ?? 'below'}
                onChange={(v) => patchPfp({ socialPos: v as 'below' | 'right' | 'left' })}
              />
            </Field>
            <View style={st.switchRow}>
              <View>
                <Text style={st.switchT}>Badge background</Text>
                <Text style={st.switchS}>Dark pill behind the icons</Text>
              </View>
              <PillToggle on={p.badgeBg ?? true} onPress={() => patchPfp({ badgeBg: !(p.badgeBg ?? true) })} />
            </View>
            <Field label="Handle ink">
              <Swatches colors={[...PALETTE, '#333333', '#666666', '#999999', '#CCCCCC']} value={p.handleColor} onChange={(c) => patchPfp({ handleColor: c })} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Handle size" hint={`${p.handleSize}px`}>
                  <Stepper value={p.handleSize} onChange={(v) => patchPfp({ handleSize: v })} step={0.5} min={6} max={14} format={(v) => `${v}`} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Icon size" hint={`${p.iconSize}px`}>
                  <Stepper value={p.iconSize} onChange={(v) => patchPfp({ iconSize: v })} step={1} min={12} max={28} format={(v) => `${v}`} />
                </Field>
              </View>
            </View>
            <Field label="Icon style">
              <Seg options={[{ value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }]} value={p.iconOutline ? 'outline' : 'filled'} onChange={(v) => patchPfp({ iconOutline: v === 'outline' })} />
            </Field>
            <Field label="Layout">
              <Seg options={[{ value: '1', label: 'Single row' }, { value: '2', label: 'Double row' }]} value={String(p.badgeRows)} onChange={(v) => patchPfp({ badgeRows: Number(v) as 1 | 2 })} />
            </Field>
            <Field label="Badge spacing" hint={`${p.socialGap ?? 6}px`}>
              <Stepper value={p.socialGap ?? 6} onChange={(v) => patchPfp({ socialGap: v })} step={1} min={0} max={16} format={(v) => `${v}px`} />
            </Field>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeSt = (C: Palette) => StyleSheet.create({
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: R.lg, padding: 14 },
  list: { backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  rowDiv: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  rowT: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  detail: { paddingHorizontal: 14, paddingBottom: 13, marginTop: 2 },
  dropBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: C.paper, borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 9 },
  dropBtnT: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.ink },
  sheetBg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34 },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  optT: { fontSize: 16, color: C.ink },
  hLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.soft, marginBottom: 8 },
  miniLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: C.muted },
  miniBtn: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: R.sm, backgroundColor: C.paper },
  miniBtnOn: { backgroundColor: C.ink },
  miniBtnT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.muted },
  miniBtnTOn: { color: C.onInk },
  miniToggle: { width: 34, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 },
  switchT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  switchS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 },
});
