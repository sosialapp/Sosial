import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, Alert, Linking, TextInput, type TextInputInstance,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Palette, R } from '../theme';
import { Txt, PillToggle, SocialGlyph, Seg } from './ui';
import {
  SocialBrief, SocialResult, SocialTone, SocialPlatform, SocialVariant,
  Toggle, RewriteOp, SocialSegmentMedia,
  DEFAULT_SOCIAL_BRIEF, SOCIAL_TONES, SOCIAL_PLATFORMS,
  THREAD_PLATFORM_IDS, THREAD_POST_MIN,
  generateSocial, rewritePosts, capFor, researchNeeded,
} from '../utils/ai/social';
import { MAX_PARTS, MAX_POSTS, MAX_PROMPT, MIN_PARTS, angleFor, creditsFor, readPromptHints } from '../utils/ai/prompt';
import { WRITER_LANGUAGES } from '../utils/ai/languages';
import { tr } from '../i18n';
import AIPictureSheet from './AIPictureSheet';
import MediaSources from './MediaSources';

/**
 * Write with AI, one prompt box. The prompt is the brief ("3 posts announcing
 * our summer sale, friendly tone"); channels, shape, tone and the rest are
 * optional chips that default to Auto and follow what the prompt says. Each
 * result is an editable card that can be re-rolled, refined, sent to the
 * composer or sent to the composer in schedule mode. Mirrors web AiCard.
 */

const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? `{${k}}`));

const REFINEMENTS: [RewriteOp, string][] = [
  ['shorter', 'rfShorter'],
  ['punchier', 'rfPunchier'],
  ['natural', 'rfNatural'],
  ['context', 'rfContext'],
  ['tone', 'rfTone'],
  ['style', 'rfStyle'],
];

const EXAMPLES = ['aiEx1', 'aiEx2', 'aiEx3'];

type Panel = 'channels' | 'shape' | 'tone' | 'more';

/** One generated post (or thread) in the result list. */
interface Card {
  id: number;
  /** Position in the set, picks the writer angle. */
  index: number;
  total: number;
  thread: boolean;
  result: SocialResult | null;
  variants: SocialVariant[];
  tab: number;
  busy: boolean;
  err: string;
  dirty: boolean;
  refineOpen: boolean;
  /** per-post attachments, keyed `${variantIndex}:${postIndex}` */
  media: Record<string, SocialSegmentMedia[]>;
}

const toneLabel = (id: string) => tr(`tone${id[0].toUpperCase()}${id.slice(1)}`);

export default function AICopySheet({ visible, initialPrompt = '', onClose, onApply, onSchedule }: {
  visible: boolean;
  initialPrompt?: string;
  onClose: () => void;
  onApply: (result: SocialResult, brief: SocialBrief) => void;
  /** When set, cards also offer "Schedule": apply, then the host opens its schedule picker. */
  onSchedule?: () => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useMemo(() => makeSt(C, insets.bottom), [C, insets.bottom]);
  const boxRef = useRef<TextInputInstance>(null);
  const nextId = useRef(1);

  const [prompt, setPrompt] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);

  /* ---------------- options ---------------- */
  const [thread, setThread] = useState(DEFAULT_SOCIAL_BRIEF.thread);
  const [parts, setParts] = useState(DEFAULT_SOCIAL_BRIEF.parts);
  const [count, setCount] = useState(1);
  const [tone, setTone] = useState<SocialTone>(DEFAULT_SOCIAL_BRIEF.tone);
  const [language, setLanguage] = useState<string>(DEFAULT_SOCIAL_BRIEF.language);
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState('');
  const [hashtags, setHashtags] = useState(DEFAULT_SOCIAL_BRIEF.hashtags);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(DEFAULT_SOCIAL_BRIEF.platforms);
  const [research, setResearch] = useState<Toggle>(DEFAULT_SOCIAL_BRIEF.research);
  const [sources, setSources] = useState<Toggle>(DEFAULT_SOCIAL_BRIEF.sources);
  const [emoji, setEmoji] = useState<'auto' | 'on' | 'off'>(DEFAULT_SOCIAL_BRIEF.emoji);
  const [cta, setCta] = useState(DEFAULT_SOCIAL_BRIEF.cta);
  /** Chips the user set by hand; the prompt no longer moves them. */
  const touched = useRef({ shape: false });

  // Content mounts after the slide-in animation lands. Mounting dozens of
  // Text nodes mid-animation races Yoga's background-thread measurement
  // against the mount commit and trips an RN-core crash
  // (TextLayoutManager.checkNotNull on a stale spannable cache). The empty
  // sheet shell still slides up immediately, so it never feels stuck.
  const [mounted, setMounted] = useState(false);
  const [err, setErr] = useState('');
  const [cards, setCards] = useState<Card[]>([]);

  const onPrompt = (text: string) => {
    setPrompt(text.slice(0, MAX_PROMPT));
    if (touched.current.shape) return;
    const h = readPromptHints(text);
    setThread(!!h.thread);
    if (h.parts) setParts(h.parts);
    setCount(h.thread ? 1 : (h.count ?? 1));
  };

  useEffect(() => {
    if (!visible) { setMounted(false); return; }
    const t = setTimeout(() => setMounted(true), 400);
    touched.current.shape = false;
    onPrompt(initialPrompt);
    setCards([]);
    setErr('');
    setPanel(null);
    setLangOpen(false);
    setLangQuery('');
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialPrompt]);

  // Thread chains only exist on four channels.
  const destinations = useMemo<SocialPlatform[]>(() => {
    if (!thread) return platforms;
    const kept = platforms.filter((p) => (THREAD_PLATFORM_IDS as string[]).includes(p));
    return kept.length ? kept : ['x'];
  }, [platforms, thread]);

  const total = thread ? 1 : count;
  const briefFor = (c: { index: number; total: number; thread: boolean }, fresh = false): SocialBrief => ({
    prompt: prompt.trim(), language, tone, style: 'auto', thread: c.thread, parts, hashtags, platforms: destinations,
    research, sources, emoji, cta, instructions: angleFor(c.index, c.total, fresh) ?? '',
  });
  const willResearch = researchNeeded(briefFor({ index: 0, total: 1, thread }));
  const anyBusy = cards.some((c) => c.busy);

  /* ---------------- generation ---------------- */

  const patch = (id: number, p: Partial<Card> | ((c: Card) => Partial<Card>)) =>
    setCards((list) => list.map((c) => (c.id === id ? { ...c, ...(typeof p === 'function' ? p(c) : p) } : c)));

  const writeOne = async (c: Card, fresh: boolean) => {
    const r = await generateSocial(briefFor(c, fresh));
    if (!r.variants.length || !r.variants.some((v) => v.posts.some((p) => p.trim()))) {
      patch(c.id, { busy: false, err: r.warnings[0] ?? tr('aiErr') });
      return;
    }
    patch(c.id, { result: r, variants: r.variants, tab: 0, busy: false, err: '', dirty: false, media: {} });
  };

  const startRun = () => {
    const fresh: Card[] = Array.from({ length: total }, (_, i) => ({
      id: nextId.current++, index: i, total, thread, result: null, variants: [], tab: 0,
      busy: true, err: '', dirty: false, refineOpen: false, media: {},
    }));
    setCards(fresh);
    fresh.forEach((c) => { void writeOne(c, false); });
  };

  const run = () => {
    setPanel(null);
    if (anyBusy) return;
    if (!prompt.trim()) {
      setErr(tr('aiGiveIdea'));
      boxRef.current?.focus();
      return;
    }
    setErr('');
    if (cards.some((c) => c.dirty)) {
      Alert.alert(tr('aiConfirmOver'), undefined, [
        { text: tr('aiCancel'), style: 'cancel' },
        { text: tr('aiRegenAll'), style: 'destructive', onPress: startRun },
      ]);
      return;
    }
    startRun();
  };

  const regenerateOne = (c: Card) => {
    if (c.busy) return;
    if (!prompt.trim()) { setErr(tr('aiGiveIdea')); return; }
    const go = () => {
      patch(c.id, { thread, busy: true, err: '' });
      void writeOne({ ...c, thread }, true);
    };
    if (c.dirty) {
      Alert.alert(tr('aiConfirmOver'), undefined, [
        { text: tr('aiCancel'), style: 'cancel' },
        { text: tr('aiRegenOne'), style: 'destructive', onPress: go },
      ]);
      return;
    }
    go();
  };

  const setPost = (c: Card, pi: number, text: string) => {
    patch(c.id, (cur) => ({
      dirty: true,
      variants: cur.variants.map((v, i) => (i === cur.tab ? { ...v, posts: v.posts.map((p, j) => (j === pi ? text : p)) } : v)),
    }));
  };

  const applyRefine = async (c: Card, op: RewriteOp) => {
    const active = c.variants[c.tab];
    if (!active) return;
    patch(c.id, { busy: true, err: '', refineOpen: false });
    const { posts, warning } = await rewritePosts(active.posts, { ...briefFor(c), platforms: [active.platform] }, op);
    patch(c.id, (cur) => ({
      busy: false,
      dirty: true,
      err: warning ?? '',
      variants: cur.variants.map((v, i) => (i === cur.tab ? { ...v, posts } : v)),
    }));
  };

  const refine = (c: Card, op: RewriteOp) => {
    if (c.dirty) {
      Alert.alert(tr('aiConfirmRewrite'), undefined, [
        { text: tr('aiCancel'), style: 'cancel' },
        { text: tr('aiRefine'), style: 'destructive', onPress: () => { void applyRefine(c, op); } },
      ]);
      return;
    }
    void applyRefine(c, op);
  };

  /* ---------------- per-post media ---------------- */

  const mediaKey = (vi: number, pi: number) => `${vi}:${pi}`;

  /** Picture picker target (card + post), real topical photos. */
  const [picTarget, setPicTarget] = useState<{ id: number; pi: number } | null>(null);
  /** "Add own" target (card + post), browses every source, not just the roll. */
  const [ownTarget, setOwnTarget] = useState<{ id: number; pi: number } | null>(null);

  const addMedia = (t: { id: number; pi: number } | null, items: SocialSegmentMedia[], credit?: string) => {
    if (!t) return;
    patch(t.id, (c) => {
      const k = mediaKey(c.tab, t.pi);
      const next: Partial<Card> = { media: { ...c.media, [k]: [...(c.media[k] ?? []), ...items].slice(0, 4) } };
      if (credit) {
        next.dirty = true;
        next.variants = c.variants.map((v, i) => (i === c.tab ? { ...v, posts: v.posts.map((p, j) => (j === t.pi && !p.includes('Unsplash') ? `${p.trim()}\n\n${credit}`.trim() : p)) } : v));
      }
      return next;
    });
  };

  const removeMedia = (c: Card, pi: number, mi: number) => {
    const k = mediaKey(c.tab, pi);
    patch(c.id, (cur) => ({ media: { ...cur.media, [k]: (cur.media[k] ?? []).filter((_, j) => j !== mi) } }));
  };

  /* ---------------- apply / close ---------------- */

  const close = () => {
    setCards([]);
    setErr('');
    setOwnTarget(null);
    setPicTarget(null);
    onClose();
  };

  const apply = (c: Card, schedule = false) => {
    const active = c.variants[c.tab];
    if (!c.result || !active) return;
    const isThread = c.thread && active.posts.length > 1;
    const out: SocialResult = {
      ...c.result,
      variants: c.variants,
      caption: isThread ? active.posts[0] : active.posts.join('\n\n'),
      thread: isThread ? active.posts : [],
      hashtags: hashtags ? c.result.hashtags : [],
      segmentMedia: active.posts.map((_, pi) => c.media[mediaKey(c.tab, pi)] ?? []),
    };
    onApply(out, briefFor(c));
    if (schedule) onSchedule?.();
    close();
  };

  /* ---------------- labels ---------------- */

  const togglePlatform = (p: SocialPlatform) => {
    if (p === 'any') return setPlatforms(['any']);
    setPlatforms((prev) => {
      const next = prev.filter((x) => x !== 'any');
      const out = next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
      return out.length ? out : ['any'];
    });
  };

  const labelOf = (id: SocialPlatform) => (id === 'any' ? tr('aiAllChannels') : SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id);
  const channelsLabel = destinations.length === 1 ? labelOf(destinations[0]) : fill(tr('aiNChannels'), { n: destinations.length });
  const shapeLabel = thread ? fill(tr('aiThreadN'), { n: parts }) : count === 1 ? tr('aiCount1') : fill(tr('aiCountN'), { n: count });
  const platChoices = thread
    ? THREAD_PLATFORM_IDS.map((id) => SOCIAL_PLATFORMS.find((p) => p.id === id)!).filter(Boolean)
    : SOCIAL_PLATFORMS;
  const moreActive = language !== 'auto' || hashtags || emoji !== 'auto' || cta || research !== 'auto' || sources !== 'auto';
  const toggleOpts: { value: Toggle; label: string }[] = [
    { value: 'auto', label: tr('emAuto') },
    { value: 'on', label: tr('aiOn') },
    { value: 'off', label: tr('aiOff') },
  ];
  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;
  const q = langQuery.trim().toLowerCase();
  const langMatches = q
    ? WRITER_LANGUAGES.filter((l) => l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q)).slice(0, 60)
    : WRITER_LANGUAGES;

  const chip = (id: Panel, label: string, active: boolean, glyph?: React.ReactNode) => {
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
        {glyph}
        <Text style={[st.chipT, (active || open) && st.chipTOn]}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={active || open ? C.accentInk : C.muted} />
      </TouchableOpacity>
    );
  };

  const optionChip = (key: string | number, label: string, on: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} onPress={onPress} style={[st.opt, on && st.optOn]} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[st.optT, on && st.optTOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={st.bg}>
        {/* Backdrop is an absolute sibling BEHIND the sheet: taps outside close,
            taps on the form do nothing, and it never competes with the scroll pan. */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
          <View style={st.sheet}>
            {mounted ? (
            ownTarget ? (
              <MediaSources
                onPickLocal={async () => {
                  const t = ownTarget;
                  setOwnTarget(null);
                  if (!t) return;
                  const c = cards.find((x) => x.id === t.id);
                  const have = c ? (c.media[mediaKey(c.tab, t.pi)]?.length ?? 0) : 0;
                  const remaining = 4 - have;
                  if (remaining <= 0) return;
                  const res = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images', 'videos'],
                    allowsMultipleSelection: remaining > 1,
                    selectionLimit: remaining,
                    quality: 0.9,
                  }).catch(() => null);
                  if (!res || res.canceled) return;
                  const picked = (res.assets ?? []).map((a) => ({
                    uri: a.uri,
                    kind: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
                  }));
                  if (picked.length) addMedia(t, picked);
                }}
                onAttach={(items, credit) => { addMedia(ownTarget, items, credit); setOwnTarget(null); }}
                onClose={() => setOwnTarget(null)}
              />
            ) : (
            <ScrollView
              style={{ flexShrink: 1 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, paddingBottom: Math.max(18, insets.bottom + 8) }}
            >
              {/* header */}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={19} color={C.accent} />
                  <Text style={st.title}>{tr('aiTitle')}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel={tr('aiClose')} accessibilityRole="button">
                    <Ionicons name="close" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={st.sub}>{tr('aiSub')}</Text>
              </View>

              {/* the prompt box: type, pick nothing, press send */}
              <View style={st.box}>
                <TextInput
                  ref={boxRef}
                  value={prompt}
                  onChangeText={onPrompt}
                  placeholder={tr('aiPromptPh')}
                  placeholderTextColor={C.faint}
                  multiline
                  maxLength={MAX_PROMPT}
                  style={st.prompt}
                  accessibilityLabel={tr('aiPromptLbl')}
                />
                <View style={st.boxBar}>
                  <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingRight: 6, alignItems: 'center' }}>
                    {chip('channels', channelsLabel, destinations[0] !== 'any',
                      destinations.length === 1 && destinations[0] !== 'any'
                        ? <SocialGlyph platform={destinations[0]} size={11} color={C.accentInk} />
                        : <Ionicons name="globe-outline" size={12} color={destinations[0] !== 'any' ? C.accentInk : C.muted} />)}
                    {chip('shape', shapeLabel, thread || count > 1)}
                    {chip('tone', `${tr('aiTone')}: ${toneLabel(tone)}`, tone !== 'auto')}
                    {chip('more', tr('aiMoreOpts'), moreActive)}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={run}
                    disabled={anyBusy}
                    style={[st.send, !prompt.trim() && st.sendIdle]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={tr('aiGenerate')}
                  >
                    {anyBusy
                      ? <ActivityIndicator size="small" color={C.onInk} />
                      : <Ionicons name="arrow-up" size={18} color={prompt.trim() ? C.onInk : C.muted} />}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -6 }}>
                {prompt.length > MAX_PROMPT - 60 ? (
                  <Text style={st.helper}>{fill(tr('aiPromptLeft'), { n: MAX_PROMPT - prompt.length })}</Text>
                ) : null}
                <View style={{ flex: 1 }} />
                <Text style={st.helper}>{fill(tr('aiCreditsN'), { n: creditsFor(total, thread) })}</Text>
              </View>

              {/* inline option panels, one at a time */}
              {panel === 'channels' ? (
                <View style={st.panel}>
                  <Text style={st.label}>{tr('aiChannels')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {platChoices.map((p) => {
                      const on = destinations.includes(p.id);
                      return (
                        <TouchableOpacity key={p.id} onPress={() => togglePlatform(p.id)} style={[st.opt, on && st.optOn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: on }}>
                          {p.id === 'any'
                            ? <Ionicons name="globe-outline" size={13} color={on ? C.accentInk : C.muted} />
                            : <SocialGlyph platform={p.id} size={12} color={on ? C.accentInk : C.muted} />}
                          <Text style={[st.optT, on && st.optTOn]}>{labelOf(p.id)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {thread ? <Text style={st.helper}>{tr('aiThreadOnly')}</Text> : null}
                </View>
              ) : null}

              {panel === 'shape' ? (
                <View style={st.panel}>
                  <Seg
                    options={[{ value: 'post', label: tr('aiFmtPost') }, { value: 'thread', label: tr('aiFmtThread') }]}
                    value={thread ? 'thread' : 'post'}
                    onChange={(v) => { touched.current.shape = true; setThread(v === 'thread'); }}
                  />
                  <Text style={st.label}>{thread ? tr('aiThreadLen') : tr('aiHowMany')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(thread
                      ? Array.from({ length: MAX_PARTS - MIN_PARTS + 1 }, (_, i) => MIN_PARTS + i)
                      : Array.from({ length: MAX_POSTS }, (_, i) => i + 1)
                    ).map((n) => optionChip(n, String(n), (thread ? parts : count) === n, () => {
                      touched.current.shape = true;
                      if (thread) setParts(n); else setCount(n);
                    }))}
                  </View>
                </View>
              ) : null}

              {panel === 'tone' ? (
                <View style={st.panel}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {SOCIAL_TONES.map((o) => optionChip(o.id, toneLabel(o.id), tone === o.id, () => { setTone(o.id); setPanel(null); }))}
                  </View>
                  <Text style={st.helper}>{tr('aiAutoHint')}</Text>
                </View>
              ) : null}

              {panel === 'more' ? (
                <View style={[st.panel, { gap: 12 }]}>
                  <TouchableOpacity onPress={() => setLangOpen((v) => !v)} style={st.row} activeOpacity={0.8} accessibilityRole="button">
                    <Text style={st.rowT}>{tr('aiLanguage')}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={st.rowVal}>{language === 'auto' ? tr('aiLangAuto') : langName(language)}</Text>
                    <Ionicons name={langOpen ? 'chevron-up' : 'chevron-down'} size={15} color={C.muted} />
                  </TouchableOpacity>
                  {langOpen ? (
                    <View style={{ gap: 8 }}>
                      <Txt
                        value={langQuery}
                        onChangeText={setLangQuery}
                        placeholder={fill(tr('aiLangSearch'), { n: WRITER_LANGUAGES.length })}
                        accessibilityLabel={tr('aiLanguage')}
                      />
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 6 }}>
                        {[{ id: 'auto', label: tr('aiLangAuto') }, ...langMatches].map((l) => {
                          const on = language === l.id;
                          return (
                            <TouchableOpacity
                              key={l.id}
                              onPress={() => { setLanguage(l.id); setLangOpen(false); setLangQuery(''); }}
                              style={[st.langRow, on && st.langRowOn]}
                              activeOpacity={0.75}
                            >
                              <Text style={[st.langRowT, on && st.langRowTOn]}>{l.label}</Text>
                              <View style={{ flex: 1 }} />
                              {on ? <Ionicons name="checkmark" size={14} color={C.accentInk} /> : null}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View style={st.row}>
                    <Text style={[st.rowT, { flex: 1 }]}>{tr('aiHashtags')}</Text>
                    <PillToggle on={hashtags} onPress={() => setHashtags((v) => !v)} />
                  </View>
                  <View style={st.row}>
                    <Text style={[st.rowT, { flex: 1 }]}>{tr('aiCta')}</Text>
                    <PillToggle on={cta} onPress={() => setCta((v) => !v)} />
                  </View>
                  <Text style={st.label}>{tr('aiEmoji')}</Text>
                  <Seg
                    options={[{ value: 'auto', label: tr('emAuto') }, { value: 'on', label: tr('emSome') }, { value: 'off', label: tr('emNone') }]}
                    value={emoji}
                    onChange={setEmoji}
                  />
                  <Text style={st.label}>{tr('aiResearch')}</Text>
                  <Text style={[st.helper, { marginTop: -6 }]}>{tr('aiResearchSub')}</Text>
                  <Seg options={toggleOpts} value={research} onChange={setResearch} />
                  <Text style={st.label}>{tr('aiSources')}</Text>
                  <Seg options={toggleOpts} value={sources} onChange={setSources} />
                </View>
              ) : null}

              {err ? <Text style={st.err}>{err}</Text> : null}

              {/* empty state: a few prompts to tap */}
              {cards.length === 0 && !prompt ? (
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

              {/* results */}
              {cards.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={st.label}>{cards.length === 1 ? tr('aiResult') : fill(tr('aiNDrafts'), { n: cards.length })}</Text>
                    <View style={{ flex: 1 }} />
                    {cards.length > 1 ? (
                      <TouchableOpacity onPress={run} disabled={anyBusy} style={[st.smallBtn, anyBusy && { opacity: 0.5 }]} activeOpacity={0.75} accessibilityRole="button">
                        <Ionicons name="refresh" size={13} color={C.muted} />
                        <Text style={st.smallBtnT}>{tr('aiRegenAll')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {cards.map((c) => {
                    const active = c.variants[c.tab];
                    const isThreadView = c.thread && (active?.posts.length ?? 0) > 1;
                    const limit = capFor(active?.platform ?? destinations[0], c.thread);
                    const hasCopy = !!active?.posts.some((p) => p.trim());
                    const title = isThreadView
                      ? fill(tr('aiNThread'), { n: active?.posts.length ?? 0 })
                      : c.total > 1 ? fill(tr('aiPostN'), { n: c.index + 1 }) : tr('aiCaption');
                    return (
                      <View key={c.id} style={st.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={st.cardT}>{title}</Text>
                          <View style={{ flex: 1 }} />
                          {hasCopy ? (
                            <TouchableOpacity onPress={() => patch(c.id, { refineOpen: !c.refineOpen })} disabled={c.busy} style={[st.smallBtn, c.refineOpen && st.chipOn]} activeOpacity={0.75} accessibilityRole="button">
                              <Ionicons name="color-wand-outline" size={13} color={c.refineOpen ? C.accentInk : C.muted} />
                              <Text style={[st.smallBtnT, c.refineOpen && { color: C.accentInk }]}>{tr('aiRefine')}</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity onPress={() => regenerateOne(c)} disabled={c.busy} style={st.iconBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={tr('aiRegenOne')}>
                            <Ionicons name="refresh" size={15} color={C.muted} />
                          </TouchableOpacity>
                        </View>

                        {c.refineOpen ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {REFINEMENTS.map(([op, key]) => optionChip(op, tr(key), false, () => refine(c, op)))}
                          </View>
                        ) : null}

                        {c.variants.length > 1 ? (
                          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 6 }}>
                            {c.variants.map((v, i) => {
                              const on = i === c.tab;
                              return (
                                <TouchableOpacity key={v.platform} onPress={() => patch(c.id, { tab: i })} style={[st.opt, on && st.tabOn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} activeOpacity={0.75} accessibilityState={{ selected: on }}>
                                  {v.platform === 'any'
                                    ? <Ionicons name="globe-outline" size={12} color={on ? C.onInk : C.muted} />
                                    : <SocialGlyph platform={v.platform} size={11} color={on ? C.onInk : C.muted} />}
                                  <Text style={[st.optT, on && { color: C.onInk }]}>{labelOf(v.platform)}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        ) : null}

                        {c.busy && !hasCopy ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 }}>
                            <ActivityIndicator size="small" color={C.accent} />
                            <Text style={st.helper}>{willResearch ? tr('aiStResearch') : destinations.length > 1 ? tr('aiStAdapt') : tr('aiWriting')}</Text>
                          </View>
                        ) : null}

                        {c.result && c.result.uncertainties.length ? (
                          <View style={st.noteBox}>
                            <Ionicons name="alert-circle-outline" size={15} color={C.yellowText} />
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={st.noteT}>{tr('aiReview')}</Text>
                              {c.result.uncertainties.map((u, i) => <Text key={i} style={st.noteS}>• {u}</Text>)}
                            </View>
                          </View>
                        ) : null}
                        {c.result?.warnings.map((w, i) => <Text key={i} style={st.helper}>• {w}</Text>)}

                        {active?.posts.map((seg, i) => {
                          const attachments = c.media[mediaKey(c.tab, i)] ?? [];
                          const tooShort = isThreadView && seg.length < THREAD_POST_MIN;
                          const what = active.posts.length > 1 ? fill(tr('aiPostWord'), { n: i + 1 }) : tr('aiCaption');
                          return (
                            <View key={i} style={[st.seg, c.busy && { opacity: 0.6 }]}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={st.segNo}>{active.posts.length > 1 ? fill(tr('aiPostN'), { n: i + 1 }) : tr('aiCaption')}</Text>
                                <Text style={[st.segCount, seg.length > limit && { color: C.redText }, !(seg.length > limit) && tooShort && { color: C.yellowText }]}>
                                  {seg.length}/{limit}{tooShort ? ` · ${fill(tr('aiMin'), { n: THREAD_POST_MIN })}` : ''}
                                </Text>
                              </View>
                              <Txt
                                value={seg}
                                onChangeText={(text) => setPost(c, i, text)}
                                editable={!c.busy}
                                multiline
                                style={st.segInput}
                                accessibilityLabel={fill(tr('aiEditPost'), { what })}
                              />
                              {/* attachments for this post: topical photos or your own */}
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                {attachments.map((m, mi) => (
                                  <View key={`${m.uri}-${mi}`}>
                                    {m.kind === 'video' ? (
                                      <View style={[st.attThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                                        <Ionicons name="play" size={18} color="#fff" />
                                      </View>
                                    ) : (
                                      <Image source={{ uri: m.uri }} style={st.attThumb} resizeMode="cover" />
                                    )}
                                    <TouchableOpacity onPress={() => removeMedia(c, i, mi)} style={st.attX} hitSlop={8} accessibilityLabel={tr('aiRemoveAtt')}>
                                      <Ionicons name="close" size={11} color="#fff" />
                                    </TouchableOpacity>
                                  </View>
                                ))}
                                {attachments.length < 4 ? (
                                  <>
                                    <TouchableOpacity onPress={() => setPicTarget({ id: c.id, pi: i })} style={st.attBtn} activeOpacity={0.75} accessibilityLabel={tr('aiPicture')}>
                                      <Ionicons name="image" size={13} color={C.accentInk} />
                                      <Text style={st.attBtnT}>{tr('aiPicture')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setOwnTarget({ id: c.id, pi: i })} style={st.attBtn} activeOpacity={0.75} accessibilityLabel={tr('aiAddOwn')}>
                                      <Ionicons name="image-outline" size={13} color={C.accentInk} />
                                      <Text style={st.attBtnT}>{tr('aiAddOwn')}</Text>
                                    </TouchableOpacity>
                                  </>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}

                        {hashtags && c.result && c.result.hashtags.length > 0 ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {c.result.hashtags.map((h) => (
                              <View key={h} style={st.tag}><Text style={st.tagT}>{h}</Text></View>
                            ))}
                          </View>
                        ) : null}

                        {c.result && c.result.sources.length ? (
                          <View style={{ gap: 8 }}>
                            <Text style={st.label}>{tr('aiSourcesHdr')}</Text>
                            {c.result.sources.map((s) => (
                              <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url).catch(() => {})} style={st.source} activeOpacity={0.75} accessibilityRole="link">
                                <Ionicons name="link-outline" size={14} color={C.accent} />
                                <View style={{ flex: 1 }}>
                                  <Text style={st.sourceT} numberOfLines={2}>{s.title}</Text>
                                  {s.publisher || s.publishedAt ? (
                                    <Text style={st.sourceS}>{[s.publisher, s.publishedAt].filter(Boolean).join(' · ')}</Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : null}

                        {c.err ? <Text style={st.err}>{c.err}</Text> : null}

                        {hasCopy ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => apply(c)} disabled={c.busy} style={[st.useBtn, c.busy && { opacity: 0.5 }]} activeOpacity={0.85} accessibilityRole="button">
                              <Text style={st.useBtnT}>{tr('aiUse')}</Text>
                            </TouchableOpacity>
                            {onSchedule ? (
                              <TouchableOpacity onPress={() => apply(c, true)} disabled={c.busy} style={[st.schedBtn, c.busy && { opacity: 0.5 }]} activeOpacity={0.85} accessibilityRole="button">
                                <Ionicons name="calendar-outline" size={14} color={C.ink} />
                                <Text style={st.schedBtnT}>{tr('aiSchedule')}</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
            )
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
      {picTarget ? (
        <AIPictureSheet
          visible
          initialTopic={(() => {
            const c = cards.find((x) => x.id === picTarget.id);
            return c?.variants[c.tab]?.posts[picTarget.pi] ?? '';
          })()}
          onPick={(uri) => { addMedia(picTarget, [{ uri, kind: 'image' }]); setPicTarget(null); }}
          onClose={() => setPicTarget(null)}
        />
      ) : null}
    </Modal>
  );
}

const makeSt = (C: Palette, bottomInset: number) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0, maxHeight: '94%', minHeight: Math.min(420, 320 + bottomInset) },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted },
  box: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 12, gap: 6 },
  // 16px so iOS never zooms
  prompt: { minHeight: 72, maxHeight: 200, textAlignVertical: 'top', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 22, color: C.ink, padding: 0 },
  boxBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  sendIdle: { backgroundColor: C.lineSoft },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.soft },
  helper: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, lineHeight: 16, color: C.faint },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted },
  chipTOn: { color: C.accentInk },
  panel: { backgroundColor: C.card, borderRadius: R.md, padding: 12, gap: 10 },
  opt: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft, minWidth: 38, alignItems: 'center' },
  optOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  optT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  optTOn: { color: C.accentInk },
  tabOn: { backgroundColor: C.ink, borderColor: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },
  rowVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.accentInk },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.paper, borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: C.lineSoft },
  langRowOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  langRowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.muted },
  langRowTOn: { color: C.accentInk },
  example: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 11 },
  exampleT: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, color: C.soft },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.redText },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 12, gap: 10 },
  cardT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13.5, color: C.ink },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  smallBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.muted },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  noteBox: { flexDirection: 'row', gap: 9, backgroundColor: C.paleYellow, borderRadius: R.md, padding: 12 },
  noteT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.yellowText },
  noteS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: C.yellowText },
  seg: { backgroundColor: C.paper, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: 11, gap: 7 },
  segNo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: C.accentInk },
  segCount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.faint },
  segInput: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, lineHeight: 20, color: C.soft, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, minHeight: 0 },
  attThumb: { width: 64, height: 64, borderRadius: R.sm + 2, backgroundColor: C.lineSoft, overflow: 'hidden' },
  attX: { position: 'absolute', top: -6, right: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  attBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.lineSoft },
  attBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.accentInk },
  tag: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  tagT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.accentInk },
  source: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: C.paper, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 },
  sourceT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, lineHeight: 17, color: C.ink },
  sourceS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted, marginTop: 2 },
  useBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.md + 2, minHeight: 44, backgroundColor: C.ink },
  useBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.onInk },
  schedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: R.md + 2, minHeight: 44, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  schedBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
});
