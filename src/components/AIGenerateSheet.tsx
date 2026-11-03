import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, type TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R } from '../theme';
import { PillToggle, PrimaryBtn } from './ui';
import PostCanvas from './PostCanvas';
import { RULES } from '../utils/ai/rules';
import { AI_LANGUAGES, AiLanguage, ContentBrief, DEFAULT_BRIEF, GenResult } from '../utils/ai/types';
import { generate } from '../utils/ai/provider';
import { applyGenResult } from '../utils/ai/apply';
import { CAROUSEL_CREDITS, MAX_PROMPT, readCardCount } from '../utils/ai/prompt';
import { tr } from '../i18n';
import { PostPage } from '../types';

const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? `{${k}}`));

const EXAMPLES = ['aisEx1', 'aisEx2', 'aisEx3'];

type Length = 'standard' | 'short';
type Panel = 'cards' | 'length' | 'more';

/** Short halves the per-card budget and keeps one block; standard is the default brief. */
const LENGTHS: Record<Length, { words: number; blocks: number }> = {
  standard: { words: DEFAULT_BRIEF.maxWordsPerPage, blocks: DEFAULT_BRIEF.maxBlocksPerPage },
  short: { words: Math.round(DEFAULT_BRIEF.maxWordsPerPage / 2), blocks: 1 },
};

/**
 * The canvas studio's AI: one prompt box, like the post writer. The prompt is
 * the brief ("5 habits for better sleep, one per card"); card count, length,
 * language and live research are optional chips that default to Auto. AI runs
 * on the server (metered); the offline draft engine covers signed-out devices.
 * Mirrors web AiStudioPanel.
 */
export default function AIGenerateSheet({ visible, template, ratio, onClose, onApply }: {
  visible: boolean;
  template: PostPage;
  ratio: number;
  onClose: () => void;
  onApply: (result: GenResult, brief: ContentBrief) => void;
}) {
  const { C } = useTheme();
  const st = makeSt(C);
  const boxRef = useRef<TextInputInstance>(null);
  const [prompt, setPrompt] = useState('');
  const [pages, setPages] = useState(DEFAULT_BRIEF.pages);
  const [length, setLength] = useState<Length>('standard');
  const [language, setLanguage] = useState<AiLanguage>('auto');
  const [grounding, setGrounding] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<GenResult | null>(null);
  /** Set once the user picks a card count; the prompt no longer moves it. */
  const pagesTouched = useRef(false);

  useEffect(() => {
    if (!visible) return;
    pagesTouched.current = false;
    setPanel(null);
  }, [visible]);

  const brief: ContentBrief = {
    prompt: prompt.trim(), language, pages,
    maxWordsPerPage: LENGTHS[length].words, maxBlocksPerPage: LENGTHS[length].blocks,
  };

  // real, rendered cards so the preview is never a mystery
  const previewPages: PostPage[] = useMemo(
    () => (result && result.pages.length ? applyGenResult(result, { template, contentScale: template.contentScale ?? 1 }) : []),
    [result, template],
  );

  const onPrompt = (text: string) => {
    setPrompt(text.slice(0, MAX_PROMPT));
    if (pagesTouched.current) return;
    setPages(readCardCount(text, RULES.maxPages) ?? DEFAULT_BRIEF.pages);
  };

  const run = async () => {
    setPanel(null);
    if (busy) return;
    if (!prompt.trim()) {
      setErr(tr('aiGiveIdea'));
      boxRef.current?.focus();
      return;
    }
    setErr('');
    setBusy(true);
    try {
      setResult(await generate(brief, { grounding }));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setResult(null);
    setErr('');
    onClose();
  };

  const chip = (id: Panel, label: string, active: boolean) => {
    const open = panel === id;
    return (
      <TouchableOpacity
        key={id}
        onPress={() => setPanel(open ? null : id)}
        style={[st.chip, (active || open) && st.chipOn]}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[st.chipT, (active || open) && st.chipTOn]}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={active || open ? C.accentInk : C.muted} />
      </TouchableOpacity>
    );
  };

  const option = (key: string | number, label: string, on: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} onPress={onPress} style={[st.opt, on && st.optOn]} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[st.optT, on && st.optTOn]}>{label}</Text>
    </TouchableOpacity>
  );

  const lengthLabel = (l: Length) => tr(l === 'short' ? 'aisLenShort' : 'aisLenStandard');
  const moreActive = language !== 'auto' || grounding;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={st.bg}>
        {/* Backdrop is an absolute sibling BEHIND the sheet: taps outside close,
            taps on the form do nothing, and it never competes with the scroll pan. */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={st.sheet}>
          <ScrollView
            style={{ flexShrink: 1 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 14 }}
          >
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={19} color={C.accent} />
                <Text style={st.title}>{tr('aiTitle')}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel={tr('aiClose')} accessibilityRole="button">
                  <Ionicons name="close" size={22} color={C.muted} />
                </TouchableOpacity>
              </View>
              <Text style={st.sub}>{tr('aisSub')}</Text>
            </View>

            {/* the prompt box: type, pick nothing, press send */}
            <View style={st.box}>
              <TextInput
                ref={boxRef}
                value={prompt}
                onChangeText={onPrompt}
                placeholder={tr('aisPromptPh')}
                placeholderTextColor={C.faint}
                multiline
                maxLength={MAX_PROMPT}
                style={st.prompt}
                accessibilityLabel={tr('aiPromptLbl')}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingRight: 6, alignItems: 'center' }}>
                  {chip('cards', pages === 1 ? tr('aisCard1') : fill(tr('aisCardsN'), { n: pages }), false)}
                  {chip('length', `${tr('aisLength')}: ${lengthLabel(length)}`, length !== 'standard')}
                  {chip('more', tr('aiMoreOpts'), moreActive)}
                </ScrollView>
                <TouchableOpacity
                  onPress={run}
                  disabled={busy}
                  style={[st.send, !prompt.trim() && st.sendIdle]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={tr('aiGenerate')}
                >
                  {busy
                    ? <ActivityIndicator size="small" color={C.onInk} />
                    : <Ionicons name="arrow-up" size={18} color={prompt.trim() ? C.onInk : C.muted} />}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[st.helper, { alignSelf: 'flex-end', marginTop: -6 }]}>{fill(tr('aiCreditsN'), { n: CAROUSEL_CREDITS })}</Text>

            {panel === 'cards' ? (
              <View style={st.panel}>
                <Text style={st.label}>{tr('aisHowMany')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from({ length: RULES.maxPages - RULES.minPages + 1 }, (_, i) => RULES.minPages + i).map((n) =>
                    option(n, String(n), pages === n, () => { pagesTouched.current = true; setPages(n); }))}
                </View>
              </View>
            ) : null}

            {panel === 'length' ? (
              <View style={st.panel}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(['standard', 'short'] as Length[]).map((l) => option(l, lengthLabel(l), length === l, () => { setLength(l); setPanel(null); }))}
                </View>
              </View>
            ) : null}

            {panel === 'more' ? (
              <View style={[st.panel, { gap: 12 }]}>
                <Text style={st.label}>{tr('aiLanguage')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {AI_LANGUAGES.map((l) => option(l.id, l.id === 'auto' ? tr('aiLangAuto') : l.label, language === l.id, () => setLanguage(l.id)))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowT}>{tr('aisLatest')}</Text>
                    <Text style={st.helper}>{tr('aisLatestSub')}</Text>
                  </View>
                  <PillToggle on={grounding} onPress={() => setGrounding((v) => !v)} />
                </View>
              </View>
            ) : null}

            {err ? <Text style={st.err}>{err}</Text> : null}

            {/* empty state: a few prompts to tap */}
            {!result && !prompt && !busy ? (
              <View style={{ gap: 8 }}>
                <Text style={st.label}>{tr('aiTry')}</Text>
                {EXAMPLES.map((k) => (
                  <TouchableOpacity key={k} onPress={() => { onPrompt(tr(k)); boxRef.current?.focus(); }} style={st.example} activeOpacity={0.75} accessibilityRole="button">
                    <Ionicons name="sparkles-outline" size={13} color={C.accentInk} />
                    <Text style={st.exampleT}>{tr(k)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {busy && !result ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <ActivityIndicator size="small" color={C.accent} />
                <Text style={st.helper}>{grounding ? tr('aiStResearch') : tr('aiWriting')}</Text>
              </View>
            ) : null}

            {result ? (
              <View style={{ gap: 10, opacity: busy ? 0.6 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={previewPages.length > 0 ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={previewPages.length > 0 ? C.greenText : C.redText}
                  />
                  <Text style={st.previewT}>{fill(tr('aisReady'), { n: previewPages.length })}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={run} disabled={busy} style={st.iconBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={tr('aisRegen')}>
                    <Ionicons name="refresh" size={15} color={C.muted} />
                  </TouchableOpacity>
                </View>

                {result.warnings.map((w, i) => (
                  <Text key={i} style={st.helper}>• {w}</Text>
                ))}

                {previewPages.length > 0 ? (
                  <>
                    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                      {previewPages.map((p, i) => (
                        <View key={p.id} style={{ alignItems: 'center', gap: 6 }}>
                          <PostCanvas page={p} ratio={ratio} scale={0.3} />
                          <Text style={st.cardNo}>{fill(tr('aisCardN'), { n: i + 1 })}</Text>
                        </View>
                      ))}
                    </ScrollView>
                    <PrimaryBtn label={tr('aisUse')} onPress={() => onApply(result, brief)} />
                  </>
                ) : (
                  <Text style={st.err}>{tr('aisNothing')}</Text>
                )}
              </View>
            ) : null}
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeSt = (C: Palette) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, maxHeight: '92%' },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted },
  box: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 12, gap: 6 },
  // 16px so iOS never zooms
  prompt: { minHeight: 64, maxHeight: 180, textAlignVertical: 'top', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 22, color: C.ink, padding: 0 },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  sendIdle: { backgroundColor: C.lineSoft },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted },
  chipTOn: { color: C.accentInk },
  panel: { backgroundColor: C.card, borderRadius: R.md, padding: 12, gap: 10 },
  opt: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft, minWidth: 38, alignItems: 'center' },
  optOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  optT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  optTOn: { color: C.accentInk },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.soft },
  helper: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, lineHeight: 16, color: C.faint },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },
  example: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 11 },
  exampleT: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, color: C.soft },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  previewT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.redText },
  cardNo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.muted },
});
