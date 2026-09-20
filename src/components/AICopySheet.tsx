import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, Alert, Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Palette, R } from '../theme';
import { Txt, PrimaryBtn, GhostBtn, Stepper, PillToggle, Field, SocialGlyph, Seg } from './ui';
import {
  SocialBrief, SocialResult, SocialTone, SocialPlatform, SocialStyle, SocialVariant,
  SocialPhase, Toggle, RewriteOp, SocialSegmentMedia,
  DEFAULT_SOCIAL_BRIEF, SOCIAL_TONES, SOCIAL_PLATFORMS, SOCIAL_STYLES, SocialStyleMeta,
  THREAD_PLATFORM_IDS, THREAD_POST_MIN, styleSampleFor,
  generateSocial, rewritePosts, capFor, activePlatforms, researchNeeded,
  coverImageUrl, imagePromptFromIdea, stockImageUrl,
} from '../utils/ai/social';
import { WRITER_LANGUAGES } from '../utils/ai/languages';
import { loadAccount } from '../utils/account';

/**
 * Write with AI — the studio.
 *
 * The idea owns the screen. Voice, style, format and destination are one tap away;
 * everything genuinely advanced (live research, sources, emoji, CTA, language,
 * custom direction, graphics) lives behind "Advanced". The model decides the rest.
 */

const TOGGLE_OPTS: { value: Toggle; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

export default function AICopySheet({ visible, initialPrompt = '', onClose, onApply }: {
  visible: boolean;
  initialPrompt?: string;
  onClose: () => void;
  onApply: (result: SocialResult, brief: SocialBrief) => void;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useMemo(() => makeSt(C, insets.bottom), [C, insets.bottom]);

  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<string>(DEFAULT_SOCIAL_BRIEF.language);
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState('');
  const [tone, setTone] = useState<SocialTone>(DEFAULT_SOCIAL_BRIEF.tone);
  const [style, setStyle] = useState<SocialStyle>(DEFAULT_SOCIAL_BRIEF.style);
  const [styleOpen, setStyleOpen] = useState(false);
  const [thread, setThread] = useState(DEFAULT_SOCIAL_BRIEF.thread);
  const [parts, setParts] = useState(DEFAULT_SOCIAL_BRIEF.parts);
  const [hashtags, setHashtags] = useState(DEFAULT_SOCIAL_BRIEF.hashtags);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(DEFAULT_SOCIAL_BRIEF.platforms);
  const [cover, setCover] = useState(DEFAULT_SOCIAL_BRIEF.coverImage);
  const [research, setResearch] = useState<Toggle>(DEFAULT_SOCIAL_BRIEF.research);
  const [sources, setSources] = useState<Toggle>(DEFAULT_SOCIAL_BRIEF.sources);
  const [emoji, setEmoji] = useState<'auto' | 'on' | 'off'>(DEFAULT_SOCIAL_BRIEF.emoji);
  const [cta, setCta] = useState(DEFAULT_SOCIAL_BRIEF.cta);
  const [instructions, setInstructions] = useState(DEFAULT_SOCIAL_BRIEF.instructions);
  const [advanced, setAdvanced] = useState(false);

  const [busy, setBusy] = useState(false);
  // Content mounts after the slide-in animation lands. Mounting dozens of
  // Text nodes mid-animation races Yoga's background-thread measurement
  // against the mount commit and trips an RN-core crash
  // (TextLayoutManager.checkNotNull on a stale spannable cache). The empty
  // sheet shell still slides up immediately, so it never feels stuck.
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<SocialPhase | null>(null);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<SocialResult | null>(null);
  const [draft, setDraft] = useState<SocialVariant[]>([]);
  const [tab, setTab] = useState(0);
  const [dirty, setDirty] = useState(false);
  /** per-post attachments, keyed `${variantIndex}:${postIndex}` */
  const [segMedia, setSegMedia] = useState<Record<string, SocialSegmentMedia[]>>({});
  const [plan, setPlan] = useState<'free' | 'pro' | 'team'>('free');
  const aiLocked = plan === 'free';

  useEffect(() => {
    if (!visible) { setMounted(false); return; }
    const t = setTimeout(() => setMounted(true), 400);
    setPrompt(initialPrompt);
    setResult(null);
    setDraft([]);
    setTab(0);
    setDirty(false);
    setSegMedia({});
    setErr('');
    setPhase(null);
    setAdvanced(false);
    setLangOpen(false);
    setLangQuery('');
    loadAccount().then((a) => setPlan(a.plan));
    return () => clearTimeout(t);
  }, [visible, initialPrompt]);

  // Thread chains only exist on four channels — drop anything else on switch.
  useEffect(() => {
    if (!thread) return;
    setPlatforms((prev) => {
      const kept = prev.filter((p) => (THREAD_PLATFORM_IDS as string[]).includes(p));
      return kept.length ? kept : ['x'];
    });
  }, [thread]);

  const brief: SocialBrief = {
    prompt, language, tone, style, thread, parts, hashtags, platforms,
    coverImage: cover, research, sources, emoji, cta, instructions,
  };

  const willResearch = researchNeeded(brief);
  const destCount = activePlatforms(brief).length;

  /* ---------------- generation ---------------- */

  const run = async () => {
    if (aiLocked || busy) return;
    if (!prompt.trim()) {
      setErr('Give the AI a rough thought to work with.');
      return;
    }
    setErr('');
    setResult(null);
    setDraft([]);
    setTab(0);
    setDirty(false);
    setSegMedia({});
    setBusy(true);
    setPhase(null);
    try {
      const r = await generateSocial(brief, setPhase);
      setResult(r);
      setDraft(r.variants);
    } finally {
      setBusy(false);
      setPhase(null);
    }
  };

  /* ---------------- edits + transforms ---------------- */

  const setPost = (vi: number, pi: number, text: string) => {
    setDraft((d) => d.map((v, i) => (i === vi ? { ...v, posts: v.posts.map((p, j) => (j === pi ? text : p)) } : v)));
    setDirty(true);
  };

  /* ---------------- per-post media ---------------- */

  const mediaKey = (vi: number, pi: number) => `${vi}:${pi}`;

  /** Topic-matched AI image for one post (remote URL — downloaded on Apply). */
  const aiImage = (vi: number, pi: number) => {
    const text = draft[vi]?.posts[pi] ?? '';
    if (!text.trim()) return;
    const desc = imagePromptFromIdea(text);
    const seed = Math.floor(Math.random() * 1000000);
    const k = mediaKey(vi, pi);
    setSegMedia((m) => ({ ...m, [k]: [...(m[k] ?? []).slice(0, 3), { uri: coverImageUrl(desc, seed), kind: 'image' }] }));
  };

  /** Real stock photo matched to the finished post text (remote URL — downloaded on Apply). */
  const stockPhoto = (vi: number, pi: number) => {
    const text = draft[vi]?.posts[pi] ?? '';
    if (!text.trim()) return;
    const seed = Math.floor(Math.random() * 1000000);
    const k = mediaKey(vi, pi);
    setSegMedia((m) => ({ ...m, [k]: [...(m[k] ?? []).slice(0, 3), { uri: stockImageUrl(text, seed), kind: 'image' }] }));
  };

  /** The user's own photo/video from the device library. */
  const pickOwnMedia = async (vi: number, pi: number) => {
    const k = mediaKey(vi, pi);
    const have = segMedia[k]?.length ?? 0;
    const remaining = 4 - have;
    if (remaining <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      quality: 0.9,
    }).catch(() => null);
    if (!res || res.canceled) return;
    const picked: SocialSegmentMedia[] = (res.assets ?? []).map((a) => ({
      uri: a.uri,
      kind: a.type === 'video' ? 'video' : 'image',
    }));
    if (!picked.length) return;
    setSegMedia((m) => ({ ...m, [k]: [...(m[k] ?? []), ...picked].slice(0, 4) }));
  };

  const removeMedia = (vi: number, pi: number, mi: number) => {
    const k = mediaKey(vi, pi);
    setSegMedia((m) => ({ ...m, [k]: (m[k] ?? []).filter((_, j) => j !== mi) }));
  };

  const applyTransform = async (op: RewriteOp) => {
    if (!result || !draft[tab]) return;
    setBusy(true);
    setErr('');
    const { posts, warning } = await rewritePosts(draft[tab].posts, brief, op);
    setDraft((d) => d.map((v, i) => (i === tab ? { ...v, posts } : v)));
    setDirty(true);
    if (warning) setErr(warning);
    setBusy(false);
  };

  const transform = (op: RewriteOp) => {
    if (dirty) {
      Alert.alert('Rewrite this version?', 'The AI will replace your manual edits for this channel.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rewrite', style: 'destructive', onPress: () => applyTransform(op) },
      ]);
      return;
    }
    applyTransform(op);
  };

  const regenerate = () => {
    if (dirty) {
      Alert.alert('Start over?', 'You will lose your manual edits.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', style: 'destructive', onPress: run },
      ]);
      return;
    }
    run();
  };

  const createGraphic = () => {
    if (!result) return;
    const desc = result.imagePrompt ?? imagePromptFromIdea(brief.prompt);
    const seed = Math.floor(Math.random() * 1000000);
    setResult({ ...result, imagePrompt: desc, imageSeed: seed, imageUrl: coverImageUrl(desc, seed) });
  };

  /* ---------------- apply / close ---------------- */

  const close = () => {
    setResult(null);
    setDraft([]);
    setSegMedia({});
    setErr('');
    onClose();
  };

  const apply = () => {
    if (!result || !draft.length) return;
    const active = draft[tab];
    const isThread = thread && active.posts.length > 1;
    const out: SocialResult = {
      ...result,
      variants: draft,
      caption: isThread ? active.posts[0] : active.posts.join('\n\n'),
      thread: isThread ? active.posts : [],
      segmentMedia: active.posts.map((_, pi) => segMedia[mediaKey(tab, pi)] ?? []),
    };
    onApply(out, brief);
    close();
  };

  /* ---------------- derived ---------------- */

  const togglePlatform = (p: SocialPlatform) => {
    if (p === 'any') return setPlatforms(['any']);
    setPlatforms((prev) => {
      const next = prev.filter((x) => x !== 'any');
      const out = next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
      return out.length ? out : (thread ? ['x'] : ['any']);
    });
  };

  const stageList = useMemo(() => {
    const list: { id: SocialPhase; label: string }[] = [];
    if (willResearch) list.push({ id: 'research', label: 'Researching current information' });
    list.push({ id: 'write', label: 'Writing' });
    if (destCount > 1) list.push({ id: 'adapt', label: 'Adapting for each channel' });
    list.push({ id: 'finalize', label: 'Finalizing' });
    return list;
  }, [willResearch, destCount]);

  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;
  const q = langQuery.trim().toLowerCase();
  const langMatches = q
    ? WRITER_LANGUAGES.filter((l) => l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q)).slice(0, 60)
    : WRITER_LANGUAGES;
  const sampleFor = (s: SocialStyleMeta) => styleSampleFor(s, language);

  const active = draft[tab];
  const isThreadView = thread && (active?.posts.length ?? 0) > 1;
  const limit = capFor(active?.platform ?? platforms[0], isThreadView);
  const hasCopy = !!result && draft.some((v) => v.posts.some((p) => p.trim()));
  const labelOf = (id: SocialPlatform) => SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;

  const styleLabel = SOCIAL_STYLES.find((s) => s.id === style)?.label ?? 'Auto';
  // Thread chains only exist natively on four channels (X, Threads, Mastodon, Bluesky).
  const platChoices = thread
    ? THREAD_PLATFORM_IDS.map((id) => SOCIAL_PLATFORMS.find((p) => p.id === id)!).filter(Boolean)
    : SOCIAL_PLATFORMS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={st.bg}>
        {/* Backdrop is an absolute sibling BEHIND the sheet: taps outside close,
            taps on the form do nothing, and it never competes with the scroll pan. */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
          <View style={st.sheet}>
            {mounted ? (
            <>
            <ScrollView
              style={{ flexShrink: 1 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
            >
              {/* header */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={19} color={C.accent} />
                  <Text style={st.title}>Write with AI</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel="Close" accessibilityRole="button">
                    <Ionicons name="close" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={st.sub}>Give it a rough thought. It handles the structure, voice and length.</Text>
              </View>

              {/* the idea owns the screen */}
              <Txt
                value={prompt}
                onChangeText={setPrompt}
                placeholder={'What do you want to say?\n\ne.g. why I stopped chasing viral hacks and started posting one honest update a day…'}
                multiline
                style={st.idea}
                accessibilityLabel="Your idea"
              />
              <Text style={st.ideaHint}>Rough thoughts are enough — a phrase works.</Text>

              {/* language first — voice, style and examples all follow it */}
              <View style={{ gap: 9 }}>
                <Text style={st.label}>Language</Text>
                <TouchableOpacity onPress={() => setLangOpen((v) => !v)} style={st.rowBtn} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={st.rowVal}>{language === 'auto' ? 'Auto' : langName(language)}</Text>
                  <View style={{ flex: 1 }} />
                  <Ionicons name={langOpen ? 'chevron-up' : 'chevron-down'} size={15} color={C.muted} />
                </TouchableOpacity>
                {!langOpen ? (
                  <Text style={st.helper}>Auto mirrors the language of your idea. Pick one to force it.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Txt
                      value={langQuery}
                      onChangeText={setLangQuery}
                      placeholder={`Search ${WRITER_LANGUAGES.length} languages…`}
                      accessibilityLabel="Search languages"
                    />
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 264 }} contentContainerStyle={{ gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => { setLanguage('auto'); setLangOpen(false); setLangQuery(''); }}
                        style={[st.langRow, language === 'auto' && st.langRowOn]}
                        activeOpacity={0.75}
                      >
                        <Text style={[st.langRowT, language === 'auto' && st.langRowTOn]}>Auto — match my idea</Text>
                        {language === 'auto' ? <View style={{ flex: 1 }} /> : null}
                        {language === 'auto' ? <Ionicons name="checkmark" size={14} color={C.accentInk} /> : null}
                      </TouchableOpacity>
                      {langMatches.map((l) => {
                        const on = language === l.id;
                        return (
                          <TouchableOpacity
                            key={l.id}
                            onPress={() => { setLanguage(l.id); setLangOpen(false); setLangQuery(''); }}
                            style={[st.langRow, on && st.langRowOn]}
                            activeOpacity={0.75}
                          >
                            <Text style={[st.langRowT, on && st.langRowTOn]}>{l.label}</Text>
                            {l.label !== l.id ? <Text style={st.langRowS}>{l.id}</Text> : null}
                            {on ? <View style={{ flex: 1 }} /> : null}
                            {on ? <Ionicons name="checkmark" size={14} color={C.accentInk} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* voice — every option visible, nothing hidden behind "More" */}
              <View style={{ gap: 9 }}>
                <Text style={st.label}>How should it sound?</Text>
                <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {SOCIAL_TONES.map((t) => {
                    const on = tone === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setTone(t.id)}
                        style={[st.chip, on && st.chipOn]}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[st.chipT, on && st.chipTOn]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* style — collapsed by default, Autopicks */}
              <View style={{ gap: 9 }}>
                <TouchableOpacity onPress={() => setStyleOpen((v) => !v)} style={st.rowBtn} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={st.label}>Style</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={st.rowVal}>{styleLabel}</Text>
                  <Ionicons name={styleOpen ? 'chevron-up' : 'chevron-down'} size={15} color={C.muted} />
                </TouchableOpacity>
                {styleOpen ? (
                  <View style={{ gap: 8 }}>
                    {SOCIAL_STYLES.map((s) => {
                      const on = style === s.id;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => setStyle(s.id)}
                          style={[st.styleRow, on && st.styleRowOn]}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[st.radio, on && st.radioOn]}>
                              {on ? <View style={st.radioDot} /> : null}
                            </View>
                            <Text style={st.styleName}>{s.label}</Text>
                            <View style={{ flex: 1 }} />
                            <Text style={st.styleHint}>{s.hint}</Text>
                          </View>
                          <Text style={st.styleSample} numberOfLines={2}>e.g. “{sampleFor(s)}”</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              {/* format */}
              <View style={{ gap: 9 }}>
                <Text style={st.label}>Format</Text>
                <Seg
                  options={[{ value: 'post', label: 'Post' }, { value: 'thread', label: 'Thread' }]}
                  value={thread ? 'thread' : 'post'}
                  onChange={(v) => setThread(v === 'thread')}
                />
                {thread ? (
                  <View style={st.rowBtn}>
                    <Text style={st.label}>Posts</Text>
                    <View style={{ flex: 1 }} />
                    <Stepper value={parts} onChange={setParts} step={1} min={3} max={12} format={(v) => `${v}`} />
                  </View>
                ) : null}
              </View>

              {/* destination — threads only go where reply-chains exist */}
              <View style={{ gap: 9 }}>
                <Text style={st.label}>Post to{thread ? ' (thread channels)' : ''}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {platChoices.map((p) => {
                    const on = platforms.includes(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => togglePlatform(p.id)}
                        style={[st.plat, on && st.platOn]}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        {p.id === 'any'
                          ? <Ionicons name="globe-outline" size={13} color={on ? C.accentInk : C.muted} />
                          : <SocialGlyph platform={p.id} size={12} color={on ? C.accentInk : C.muted} />}
                        <Text style={[st.platT, on && st.platTOn]}>{p.label}</Text>
                        {on && p.id !== 'any' ? <Ionicons name="checkmark" size={13} color={C.accentInk} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {destCount > 1 ? (
                  <Text style={st.helper}>Same facts everywhere — the wording adapts to each channel.</Text>
                ) : null}
              </View>

              {/* advanced */}
              <View style={{ gap: 12 }}>
                <TouchableOpacity onPress={() => setAdvanced((v) => !v)} style={st.rowBtn} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={st.label}>Advanced options</Text>
                  <View style={{ flex: 1 }} />
                  <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={15} color={C.muted} />
                </TouchableOpacity>

                {advanced ? (
                  <View style={{ gap: 14 }}>
                    <View style={st.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.toggleT}>Add hashtags</Text>
                        <Text style={st.toggleS}>Kept separate from the copy</Text>
                      </View>
                      <PillToggle on={hashtags} onPress={() => setHashtags((v) => !v)} />
                    </View>

                    <View style={st.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.toggleT}>Live research</Text>
                        <Text style={st.toggleS}>Searches the web for current facts. Auto detects news topics.</Text>
                      </View>
                    </View>
                    <Seg options={TOGGLE_OPTS} value={research} onChange={setResearch} />

                    <View style={st.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.toggleT}>Include sources</Text>
                        <Text style={st.toggleS}>Links the reporting used, when research ran</Text>
                      </View>
                    </View>
                    <Seg options={TOGGLE_OPTS} value={sources} onChange={setSources} />

                    <View style={st.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.toggleT}>Emoji</Text>
                        <Text style={st.toggleS}>Auto keeps them only when they fit</Text>
                      </View>
                    </View>
                    <Seg
                      options={[{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'Some' }, { value: 'off', label: 'None' }]}
                      value={emoji}
                      onChange={setEmoji}
                    />

                    <View style={st.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.toggleT}>Soft call-to-action</Text>
                        <Text style={st.toggleS}>Closes with an invitation, not a demand</Text>
                      </View>
                      <PillToggle on={cta} onPress={() => setCta((v) => !v)} />
                    </View>

                    <View style={st.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.toggleT}>AI cover image</Text>
                        <Text style={st.toggleS}>Topic-matched graphic, made fresh each run</Text>
                      </View>
                      <PillToggle on={cover} onPress={() => setCover((v) => !v)} />
                    </View>

                    <Field label="Custom instructions" hint="Optional">
                      <Txt
                        value={instructions}
                        onChangeText={setInstructions}
                        placeholder="e.g. mention our launch on Friday, keep it under 3 lines…"
                        multiline
                        style={{ minHeight: 62, textAlignVertical: 'top' }}
                      />
                    </Field>
                  </View>
                ) : null}
              </View>

              {/* progress */}
              {busy ? (
                <View style={{ gap: 8 }}>
                  {stageList.map((s, i) => {
                    const idx = phase ? stageList.findIndex((x) => x.id === phase) : 0;
                    const done = i < idx;
                    const activeNow = i === Math.max(0, idx);
                    return (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                        {done ? (
                          <Ionicons name="checkmark-circle" size={16} color={C.greenText} />
                        ) : activeNow ? (
                          <ActivityIndicator size="small" color={C.accent} />
                        ) : (
                          <Ionicons name="ellipse-outline" size={16} color={C.faint} />
                        )}
                        <Text style={[st.stageT, !done && !activeNow && { color: C.faint }]}>{s.label}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {err ? <Text style={st.err}>{err}</Text> : null}

              {/* result */}
              {result && !busy ? (
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={hasCopy ? 'checkmark-circle' : 'alert-circle'} size={18} color={hasCopy ? C.greenText : C.redText} />
                    <Text style={st.previewT}>
                      {result.thread.length > 1 ? `${draft[tab]?.posts.length ?? 0}-post thread` : 'Caption'} · {result.provider}
                    </Text>
                  </View>

                  {result.generation.voiceUsed !== 'auto' || result.generation.styleUsed !== 'auto' ? (
                    <Text style={st.helper}>
                      Auto picked: {SOCIAL_STYLES.find((s) => s.id === result.generation.styleUsed)?.label ?? 'Auto'}
                      {' · '}
                      {SOCIAL_TONES.find((t) => t.id === result.generation.voiceUsed)?.label ?? 'Auto'}
                    </Text>
                  ) : null}

                  {result.warnings.map((w, i) => (
                    <Text key={i} style={st.warn}>• {w}</Text>
                  ))}

                  {result.uncertainties.length ? (
                    <View style={st.noteBox}>
                      <Ionicons name="alert-circle-outline" size={15} color={C.yellowText} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={st.noteT}>Review before publishing</Text>
                        {result.uncertainties.map((u, i) => <Text key={i} style={st.noteS}>• {u}</Text>)}
                      </View>
                    </View>
                  ) : null}

                  {draft.length > 1 ? (
                    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                      {draft.map((v, i) => {
                        const on = i === tab;
                        return (
                          <TouchableOpacity key={v.platform} onPress={() => setTab(i)} style={[st.chip, on && st.chipOn]} activeOpacity={0.75} accessibilityState={{ selected: on }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {v.platform === 'any'
                                ? <Ionicons name="globe-outline" size={12} color={on ? C.onInk : C.muted} />
                                : <SocialGlyph platform={v.platform} size={11} color={on ? C.onInk : C.muted} />}
                              <Text style={[st.chipT, on && st.chipTOn]}>{labelOf(v.platform)}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : null}

                  {active?.posts.map((seg, i) => {
                    const attachments = segMedia[mediaKey(tab, i)] ?? [];
                    const tooShort = isThreadView && seg.length < THREAD_POST_MIN;
                    return (
                      <View key={i} style={st.seg}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={st.segNo}>{active.posts.length > 1 ? `Post ${i + 1}` : 'Caption'}</Text>
                          <Text style={[st.segCount, seg.length > limit && { color: C.redText }, !(seg.length > limit) && tooShort && { color: C.yellowText }]}>
                            {seg.length}/{limit}{tooShort ? ` (min ${THREAD_POST_MIN})` : ''}
                          </Text>
                        </View>
                        <Txt
                          value={seg}
                          onChangeText={(t) => setPost(tab, i, t)}
                          multiline
                          style={st.segInput}
                          accessibilityLabel={`Edit ${active.posts.length > 1 ? `post ${i + 1}` : 'caption'}`}
                        />
                        {/* attachments for this post: AI-made or your own */}
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
                              <TouchableOpacity
                                onPress={() => removeMedia(tab, i, mi)}
                                style={st.attX}
                                hitSlop={8}
                                accessibilityLabel="Remove attachment"
                              >
                                <Ionicons name="close" size={11} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          {attachments.length < 4 ? (
                            <>
                              <TouchableOpacity onPress={() => aiImage(tab, i)} style={st.attBtn} activeOpacity={0.75} accessibilityLabel="Generate AI image for this post">
                                <Ionicons name="sparkles" size={13} color={C.accentInk} />
                                <Text style={st.attBtnT}>AI image</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => stockPhoto(tab, i)} style={st.attBtn} activeOpacity={0.75} accessibilityLabel="Fetch a stock photo matching this post">
                                <Ionicons name="globe-outline" size={13} color={C.accentInk} />
                                <Text style={st.attBtnT}>Stock</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => pickOwnMedia(tab, i)} style={st.attBtn} activeOpacity={0.75} accessibilityLabel="Add your own photo or video">
                                <Ionicons name="image-outline" size={13} color={C.accentInk} />
                                <Text style={st.attBtnT}>Add own</Text>
                              </TouchableOpacity>
                            </>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {result.hashtags.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {result.hashtags.map((h) => (
                        <View key={h} style={st.tag}><Text style={st.tagT}>{h}</Text></View>
                      ))}
                    </View>
                  ) : null}

                  {result.sources.length ? (
                    <View style={{ gap: 8 }}>
                      <Text style={st.label}>Sources</Text>
                      {result.sources.map((s) => (
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

                  {result.imageUrl ? (
                    <View style={{ gap: 8 }}>
                      <Image source={{ uri: result.imageUrl }} style={st.cover} resizeMode="cover" />
                      <GhostBtn label="New image" onPress={createGraphic} />
                    </View>
                  ) : null}

                  {/* transforms */}
                  <View style={{ gap: 9 }}>
                    <Text style={st.label}>Refine</Text>
                    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                      {([
                        ['shorter', 'Shorter'],
                        ['punchier', 'Punchier'],
                        ['natural', 'More natural'],
                        ['context', 'Add context'],
                        ['tone', 'Change tone'],
                        ['style', 'Change style'],
                      ] as [RewriteOp, string][]).map(([op, l]) => (
                        <TouchableOpacity key={op} onPress={() => transform(op)} style={st.chip} activeOpacity={0.75} disabled={busy}>
                          <Text style={st.chipT}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                      {!result.imageUrl ? (
                        <TouchableOpacity onPress={createGraphic} style={st.chip} activeOpacity={0.75}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="image-outline" size={13} color={C.muted} />
                            <Text style={st.chipT}>Create graphics</Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity onPress={regenerate} style={st.chip} activeOpacity={0.75} disabled={busy}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="refresh" size={13} color={C.muted} />
                          <Text style={st.chipT}>Regenerate</Text>
                        </View>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* sticky CTA */}
            <View style={st.footer}>
              {aiLocked ? (
                <View style={st.lockBox}>
                  <Ionicons name="lock-closed" size={16} color={C.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.lockT}>AI writing is a Pro & Team feature.</Text>
                    <Text style={st.lockS}>Upgrade in Profile → Account to write with AI.</Text>
                  </View>
                </View>
              ) : result && hasCopy ? (
                <PrimaryBtn
                  label={result.thread.length > 1 ? `Use this thread (${draft[tab]?.posts.length ?? 0})` : 'Use this caption'}
                  onPress={apply}
                />
              ) : (
                <PrimaryBtn
                  label={busy ? 'Writing…' : 'Generate'}
                  icon="sparkles"
                  loading={busy}
                  onPress={run}
                />
              )}
            </View>
            </>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeSt = (C: Palette, bottomInset: number) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0, maxHeight: '94%' },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted },
  idea: { minHeight: 118, textAlignVertical: 'top', fontSize: 16, lineHeight: 23, paddingVertical: 14 },
  ideaHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.faint, marginTop: -12 },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.soft },
  helper: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, lineHeight: 16, color: C.faint },
  chip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  chipTOn: { color: C.onInk },
  rowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 11 },
  rowVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.accentInk },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: C.lineSoft },
  langRowOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  langRowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.muted },
  langRowTOn: { color: C.accentInk },
  langRowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.faint },
  plat: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  platOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  platT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  platTOn: { color: C.accentInk },
  toggleRow: { backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12 },
  toggleT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  toggleS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 },
  stageT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.soft },
  previewT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  warn: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, color: C.muted },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.redText },
  noteBox: { flexDirection: 'row', gap: 9, backgroundColor: C.paleYellow, borderRadius: R.md, padding: 12 },
  noteT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.yellowText },
  noteS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: C.yellowText },
  seg: { backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: 12, gap: 7 },
  segNo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: C.accentInk },
  segCount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.faint },
  segInput: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, lineHeight: 20, color: C.soft, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, minHeight: 0 },
  styleRow: { backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 12, paddingVertical: 10, gap: 5 },
  styleRowOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.accentInk },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accentInk },
  styleName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },
  styleHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.faint },
  styleSample: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: C.muted },
  attThumb: { width: 64, height: 64, borderRadius: R.sm + 2, backgroundColor: C.lineSoft, overflow: 'hidden' },
  attX: { position: 'absolute', top: -6, right: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  attBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.lineSoft },
  attBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.accentInk },
  tag: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  tagT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.accentInk },
  source: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 },
  sourceT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, lineHeight: 17, color: C.ink },
  sourceS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted, marginTop: 2 },
  cover: { width: '100%', aspectRatio: 4 / 5, borderRadius: R.lg, backgroundColor: C.card },
  footer: { paddingTop: 12, paddingBottom: Math.max(14, bottomInset), paddingHorizontal: 20, marginHorizontal: -20, backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.lineSoft },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 },
  lockT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  lockS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 },
});
