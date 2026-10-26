import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R } from '../theme';
import { PrimaryBtn, GhostBtn, SocialGlyph } from './ui';
import { SOCIAL_META } from '../constants';
import { tr } from '../i18n';

export interface PubRow {
  id: string;
  label: string;
  state: 'pending' | 'working' | 'done' | 'fail' | 'manual';
  note?: string;
}

/** Row id is the lowercase channel key ("x", "instagram") when it is one. */
const brandOf = (id: string) => (SOCIAL_META[id] ? id : null);

/** The channel's own tile: brand colour + white logo, globe when unknown. */
function BrandTile({ id, size = 36, C }: { id: string; size?: number; C: Palette }) {
  const b = brandOf(id);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: b ? SOCIAL_META[b].bg : C.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {b ? <SocialGlyph platform={b} size={size * 0.5} color="#fff" /> : <Ionicons name="globe-outline" size={size * 0.5} color={C.muted} />}
    </View>
  );
}

/** Indeterminate sweep along the card's top edge while anything still posts. */
function Sweep({ color, C }: { color: string; C: Palette }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View style={{ height: 4, backgroundColor: C.surface, overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: '35%',
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-160, 460] }) }],
        }}
      />
    </View>
  );
}

function StateMark({ state, C }: { state: PubRow['state']; C: Palette }) {
  if (state === 'working' || state === 'pending') return null;
  const cfg =
    state === 'done'
      ? { icon: 'checkmark' as const, bg: C.paleGreen, fg: C.greenText }
      : state === 'fail'
        ? { icon: 'close' as const, bg: C.paleRed, fg: C.redText }
        : { icon: 'hand-left-outline' as const, bg: C.accentSoft, fg: C.accentInk };
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={cfg.icon} size={14} color={cfg.fg} />
    </View>
  );
}

const stateText = (st: PubRow['state']): string => ({
  pending: tr('uWaiting'),
  working: tr('uPosting'),
  done: tr('uPosted'),
  fail: tr('iFailed'),
  manual: tr('uFinishInTheApp'),
})[st];

/** In-app publishing notice, replaces EVERY native Alert during/after publish.
 *  loading/result: one card throughout, a single sweep along the top edge
 *  while working (solid green / red once settled), a status tile, then one
 *  row per channel whose status words change in place. info: simple card. privacy: tappable TikTok
 *  audience options. Rises from the bottom like a sheet. */
export default function PublishNotice({
  visible,
  mode,
  title,
  message,
  channels,
  rows,
  onDone,
  onPick,
  onCancel,
  onHide,
}: {
  visible: boolean;
  mode: 'loading' | 'result' | 'info' | 'privacy';
  title: string;
  message?: string;
  /** brand tiles shown above the message (e.g. which channels need media) */
  channels?: string[];
  rows?: PubRow[];
  onDone?: () => void;
  onPick?: (value: string) => void;
  onCancel?: () => void;
  /** loading only: dismiss the overlay while the publish keeps running */
  onHide?: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  if (!visible) return null;
  const list = rows ?? [];
  const progressMode = mode === 'loading' || mode === 'result';
  const allGood = list.length > 0 && list.every((r) => r.state === 'done');
  const anyFail = list.some((r) => r.state === 'fail');
  const doneCount = list.filter((r) => r.state === 'done' || r.state === 'fail' || r.state === 'manual').length;

  const close = () => {
    if (mode === 'result' || mode === 'info') onDone?.();
    if (mode === 'privacy') onCancel?.();
    if (mode === 'loading') onHide?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.bg}>
        <View style={s.card}>
          {progressMode ? (
            mode === 'loading' ? (
              <Sweep color={C.accent} C={C} />
            ) : (
              <View style={[s.topBar, { backgroundColor: anyFail ? '#E5484D' : '#12914A' }]} />
            )
          ) : null}

          <View style={s.body}>
            {progressMode ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={[
                    s.statusTile,
                    mode === 'result' && { backgroundColor: anyFail ? '#E5484D' : '#12914A' },
                  ]}
                >
                  <Ionicons
                    name={mode === 'loading' ? 'paper-plane-outline' : anyFail ? 'close' : 'checkmark'}
                    size={22}
                    color={mode === 'loading' ? C.ink : '#fff'}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.titleL} numberOfLines={2}>{title}</Text>
                  <Text style={s.subL} numberOfLines={1}>
                    {mode === 'loading'
                      ? tr('uUploadingAndPostingKeep')
                      : allGood
                        ? `${doneCount} of ${list.length} posted`
                        : `${list.filter((r) => r.state === 'done').length} posted · ${list.filter((r) => r.state === 'fail').length} failed`}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={[s.head, { backgroundColor: mode === 'privacy' ? C.accentSoft : C.surface }]}>
                  <Ionicons name={mode === 'privacy' ? 'eye-outline' : 'information'} size={26} color={C.accentInk} />
                </View>
                <Text style={s.title}>{title}</Text>
              </>
            )}

            {mode === 'info' && channels && channels.length > 0 ? (
              <View style={s.chanRow}>
                {channels.map((c) => (
                  <BrandTile key={c} id={c} size={38} C={C} />
                ))}
              </View>
            ) : null}
            {message ? <Text style={[s.message, progressMode && { textAlign: 'left' }]}>{message}</Text> : null}

            {list.length > 0 ? (
              <ScrollView style={mode === 'privacy' ? s.privWrap : s.rowsWrap} showsVerticalScrollIndicator={false}>
                <View style={mode === 'privacy' ? s.rows : s.rowsBox}>
                  {list.map((r) =>
                    mode === 'privacy' ? (
                      <TouchableOpacity key={r.id} onPress={() => onPick?.(r.id)} style={s.privOpt} activeOpacity={0.75}>
                        <Text style={s.privOptT}>{r.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={C.faint} />
                      </TouchableOpacity>
                    ) : (
                      <View key={r.id} style={[s.row, r !== list[0] && s.rowDivider]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <BrandTile id={r.id} size={32} C={C} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.rowT} numberOfLines={1}>{r.label}</Text>
                            <Text
                              style={[
                                s.rowS,
                                r.state === 'fail' && { color: C.redText },
                                r.state === 'done' && { color: C.greenText },
                              ]}
                              numberOfLines={r.state === 'fail' ? 3 : 1}
                              selectable={r.state === 'fail'}
                            >
                              {r.note ?? stateText(r.state)}
                            </Text>
                          </View>
                          <StateMark state={r.state} C={C} />
                        </View>
                      </View>
                    ),
                  )}
                </View>
              </ScrollView>
            ) : null}

            {mode === 'result' || mode === 'info' ? <PrimaryBtn label={tr('uDone')} onPress={() => onDone?.()} /> : null}
            {mode === 'loading' ? <GhostBtn label={tr('uContinueInBackground')} onPress={() => onHide?.()} /> : null}
            {mode === 'privacy' ? <GhostBtn label={tr('uCancel')} onPress={() => onCancel?.()} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeS = (C: Palette) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' } as const,
    card: { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', width: '100%' } as const,
    topBar: { height: 4, backgroundColor: C.surface } as const,
    body: { padding: 22, paddingBottom: 34, gap: 14 } as const,
    statusTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' } as const,
    titleL: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink } as const,
    subL: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 2 } as const,
    head: { width: 56, height: 56, borderRadius: 28, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' } as const,
    title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink, textAlign: 'center' } as const,
    chanRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 } as const,
    message: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, lineHeight: 19, color: C.muted, textAlign: 'center' } as const,
    rowsWrap: { maxHeight: 300 } as const,
    privWrap: { width: '100%' } as const,
    privOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 14, paddingVertical: 13 } as const,
    privOptT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink } as const,
    rows: { gap: 8 } as const,
    rowsBox: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, overflow: 'hidden' } as const,
    row: { paddingHorizontal: 12, paddingVertical: 10 } as const,
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line } as const,
    rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink } as const,
    rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 17, color: C.muted, marginTop: 1 } as const,
  });
