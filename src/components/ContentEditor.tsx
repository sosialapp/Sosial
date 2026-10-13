import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { usePost } from '../store/PostContext';
import { uid, PALETTE } from '../constants';
import { BlockType, CardStyle, ContentBlock, PostPage } from '../types';
import { useTheme, Palette, R, DATA } from '../theme';
import { Txt, GhostBtn, PrimaryBtn, Section, Field, Swatches, Seg, Stepper, PillToggle } from './ui';
import AIGenerateSheet from './AIGenerateSheet';
import ImageCropModal from './ImageCropModal';
import { applyGenResult } from '../utils/ai/apply';

/** Saved 'fill' values (short-lived experiment) behave as 'top'. */
function normCardY(c?: string | null): 'top' | 'middle' | 'bottom' | undefined {
  if (c === 'fill') return 'top';
  return (c as 'top' | 'middle' | 'bottom' | undefined) ?? undefined;
}

/**
 * Tallest a card may be (design units) while the title + profile/socials
 * rows still fit on a canvas of design height `designH`. Mirrors web
 * maxCardHeightDesign in apps/web/src/lib/studio/model.ts, keep in sync.
 * Unfloored; callers apply floors.
 */
function maxCardHeightDesign(page: PostPage, designH: number): number {
  const hasTitle = page.title.position !== 'none' && page.title.text.trim().length > 0;
  const titleLines = hasTitle ? Math.max(1, Math.ceil(page.title.text.trim().length / 26)) : 0;
  const titleH = hasTitle
    ? page.title.size * 1.3 * titleLines + ((page.title.subtitle ?? '').trim() ? (page.title.subtitleSize ?? 15) * 1.35 : 0)
    : 0;
  const pfpVisible = !(page.pfp.hidden ?? false);
  const socialsOn = !(page.pfp.socialsHidden ?? false) && page.socials.some((s) => s.visible);
  const socialsBelow = socialsOn && (page.pfp.socialPos ?? 'below') === 'below';
  const socialsAbove = socialsOn && (page.pfp.socialPos ?? 'below') === 'top';
  const photoH = pfpVisible
    ? page.pfp.size + 4 + (page.pfp.username?.trim() ? (page.pfp.handleSize ?? 8.5) + 2 : 0)
    : 0;
  const socialsH = (socialsBelow || socialsAbove) ? (page.pfp.iconSize ?? 17) + 6 : 0;
  const pfpH = (pfpVisible || socialsOn) ? photoH + socialsH : 0;
  return designH - 16 * 2 - titleH - pfpH - 10 * 2;
}
import { GenResult } from '../utils/ai/types';
import { loadAccount } from '../utils/account';

const CARDS: { id: CardStyle; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'threads', label: 'Threads' },
  { id: 'x', label: 'X' },
  { id: 'bluesky', label: 'Bluesky' },
];

const TYPES: { id: BlockType; label: string }[] = [
  { id: 'bullets', label: 'Bullets' },
  { id: 'numbered', label: 'Numbers' },
  { id: 'table', label: 'Table' },
  { id: 'bar', label: 'Chart' },
  { id: 'vbar', label: 'Columns' },
  { id: 'free', label: 'Text' },
  { id: 'image', label: 'Image' },
];

/** Detect the first number anywhere in the line, "$45000", "Jan $40", "40%" all work. */
function parseChartLine(line: string): { label: string; value: number } {
  const m = line.match(/-?[\d,]*\.?\d+/);
  if (!m || m[0].replace(/[.,-]/g, '') === '') return { label: line.trim() || 'Item', value: 0 };
  const value = parseFloat(m[0].replace(/,/g, '')) || 0;
  const label = line.replace(m[0], '').replace(/^[,\s]+|[,\s]+$/g, '').trim() || 'Item';
  return { label, value };
}

function newBlock(type: BlockType): ContentBlock {  if (type === 'table') return { id: uid('b'), type, heading: 'Comparison', items: [], table: [['Feature', 'A', 'B'], ['Price', '$9', '$19'], ['Rating', '4.8', '4.5']] };
  if (type === 'bar' || type === 'vbar') return { id: uid('b'), type, heading: 'Stats', items: [], chart: [{ label: 'Jan', value: 40 }, { label: 'Feb', value: 65 }, { label: 'Mar', value: 50 }] };
  if (type === 'pie') return { id: uid('b'), type, heading: 'Split', items: [], chart: [{ label: 'A', value: 50 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }] };
  if (type === 'numbered') return { id: uid('b'), type, heading: 'Steps', items: ['First step', 'Second step', 'Third step'] };
  if (type === 'free') return { id: uid('b'), type, heading: '', items: ['Write anything here…'] };
  if (type === 'image') return { id: uid('b'), type, heading: '', items: [], imageH: 140 };
  return { id: uid('b'), type: 'bullets', heading: 'Points', items: ['Point one', 'Point two'] };
}

/** Switch row matching the built-in ones (title + sub + pill toggle). */
function ToggleRow({ C, title, sub, on, onPress }: { C: Palette; title: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink }}>{title}</Text>
        {sub ? <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <PillToggle on={on} onPress={onPress} />
    </View>
  );
}

export default function ContentEditor() {
  const { C } = useTheme();
  const st = makeSt(C);
  const { page, setBlocks, patchPage, setPages, sizeRatio } = usePost();
  const [openId, setOpenId] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const [cropId, setCropId] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro' | 'team'>('free');
  useEffect(() => { loadAccount().then((a) => setPlan(a.plan)); }, []);
  if (!page) return null;
  // Tallest the fixed card may be while the title + profile/socials rows
  // still fit, the stepper stops here so raising px can never shove them
  // off the canvas.
  const cardMaxH = Math.max(120, Math.min(640, Math.floor(maxCardHeightDesign(page, 340 * sizeRatio))));
  const wmOn = page.showWatermark ?? true;
  const toggleWm = () => {
    if (wmOn && plan === 'free') {
      Alert.alert('Pro feature', 'Removing the watermark needs Pro or Team. Upgrade in Account to turn it off.');
      return;
    }
    patchPage({ showWatermark: !wmOn });
  };
  const blocks = page.blocks;
  const cropBlock = cropId ? blocks.find((b) => b.id === cropId) ?? null : null;
  const commonInk =
    blocks.length > 0 && blocks.every((b) => (b.textColor ?? '#111111') === (blocks[0].textColor ?? '#111111'))
      ? (blocks[0].textColor ?? '#111111')
      : undefined;

  const add = (t: BlockType) => {
    const b = newBlock(t);
    setBlocks([...blocks, b]);
    setOpenId(b.id);
  };
  // +Image goes straight to the gallery, then the block opens with a Square/Wide crop choice
  const addImage = async () => {
    if (blocks.some((b) => b.type === 'image')) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    const b: ContentBlock = { id: uid('b'), type: 'image', heading: '', items: [], imageUri: res.assets[0].uri, imageAspect: 'wide' };
    setBlocks([...blocks, b]);
    setOpenId(b.id);
  };
  const update = (id: string, patch: Partial<ContentBlock>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const patchStyle = (b: ContentBlock, patch: Partial<NonNullable<ContentBlock['style']>>) =>
    update(b.id, { style: { ...(b.style ?? {}), ...patch } });
  const remove = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));
  const pickImage = async (id: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) update(id, { imageUri: res.assets[0].uri });
  };
  const pickChartRowImage = async (b: ContentBlock, row: number) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    const img = res.assets[0].uri;
    update(b.id, { chart: (b.chart ?? []).map((c, k) => (k === row ? { ...c, img } : c)) });
  };
  // raw text drafts for table/chart editors, parsed into the model on blur,
  // so normalization never fights the cursor mid-typing
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftKey = (b: ContentBlock, kind: 'table' | 'chart') => `${b.id}:${kind}`;
  const draftFor = (b: ContentBlock, kind: 'table' | 'chart'): string => {
    const hit = drafts[draftKey(b, kind)];
    if (hit !== undefined) return hit;
    if (kind === 'table') return (b.table ?? []).map((r) => r.join(', ')).join('\n');
    return (b.chart ?? []).map((c) => `${c.label}, ${c.value}`).join('\n');
  };
  const commitDraft = (b: ContentBlock, kind: 'table' | 'chart') => {
    const k = draftKey(b, kind);
    const raw = drafts[k];
    if (raw === undefined) return;
    if (kind === 'table') {
      update(b.id, { table: raw.split('\n').map((r) => r.split(',').map((c) => c.trim())) });
    } else {
      const prev = b.chart ?? [];
      update(b.id, {
        chart: raw.split('\n').filter(Boolean).map((line, idx) => {
          const parsed = parseChartLine(line);
          return { ...parsed, color: prev[idx]?.color };
        }),
      });
    }
    // keep the raw text in the box, no surprise rewrite after typing
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  /** AI result → cloned template pages with fitted card heights. */
  const applyAi = (result: GenResult) => {
    if (result.pages.length === 0) {
      Alert.alert('Nothing to apply', result.warnings.join('\n') || 'Try a more specific topic.');
      return;
    }
    try {
      const pages = applyGenResult(result, { template: page, contentScale: page.contentScale ?? 1 });
      setPages(pages);
      setAi(false);
      setOpenId(null);
      Alert.alert('Content generated', `Filled ${pages.length} card${pages.length === 1 ? '' : 's'} and sized each one to fit. Your template was kept.`);
    } catch (e: any) {
      Alert.alert('Could not apply', e?.message ?? 'Something went wrong.');
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <TouchableOpacity onPress={() => setAi(true)} style={st.aiBtn} activeOpacity={0.85}>
        <Ionicons name="sparkles" size={15} color={C.onInk} />
        <Text style={st.aiT}>Generate with AI</Text>
      </TouchableOpacity>

      <View style={{ gap: 12 }}>
        <Section no="01" title="Card style" hint="The inner card dressed as a social post." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CARDS.map((c) => {
            const on = (page.cardStyle ?? 'minimal') === c.id;
            return (
              <TouchableOpacity key={c.id} onPress={() => patchPage({ cardStyle: c.id })} style={[st.cardBtn, on && st.cardBtnOn]} activeOpacity={0.7}>
                <Text style={[st.cardBtnT, on && st.cardBtnTOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Field label="Card color">
          <Swatches colors={PALETTE} value={page.cardColor ?? '#FFFFFF'} onChange={(c) => patchPage({ cardColor: c })} />
        </Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink }}>Full card</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 }}>Content card fills the whole canvas, single card</Text>
          </View>
          <PillToggle on={page.fullCard ?? false} onPress={() => patchPage({ fullCard: !(page.fullCard ?? false) })} />
        </View>
        {page.fullCard ? (
          <>
            <ToggleRow C={C} title="Title inside card" sub="Card renders the title row itself" on={page.fullCardTitle ?? false} onPress={() => patchPage({ fullCardTitle: !(page.fullCardTitle ?? false) })} />
            <ToggleRow C={C} title="Avatar header" sub="Name + avatar at the top of the card" on={page.fullCardAvatar ?? false} onPress={() => patchPage({ fullCardAvatar: !(page.fullCardAvatar ?? false) })} />
            <ToggleRow C={C} title="Socials footer" sub="Handles row at the bottom of the card" on={page.fullCardSocials ?? false} onPress={() => patchPage({ fullCardSocials: !(page.fullCardSocials ?? false) })} />
          </>
        ) : null}
        {!page.fullCard ? (
        <>
        <Field label="Inner card height" hint="The social card (Minimal, Instagram, X…). Auto hugs your content, Fixed sets an exact height.">
          <Seg options={[{ value: 'auto', label: 'Auto' }, { value: 'fixed', label: 'Fixed' }]} value={page.cardH ? 'fixed' : 'auto'} onChange={(v) => patchPage({ cardH: v === 'fixed' ? Math.min(page.cardH ?? 300, cardMaxH) : null, cardY: v === 'fixed' ? (normCardY(page.cardY) ?? 'top') : page.cardY })} />
        </Field>
        {page.cardH ? (
          <>
            <Stepper value={Math.min(page.cardH, cardMaxH)} onChange={(v) => patchPage({ cardH: v })} step={20} min={120} max={cardMaxH} format={(v) => `${v}px`} />
            <Field label="Card position" hint="Where the fixed-height card sits.">
              <Seg
                options={[
                  { value: 'top', label: 'Top' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'bottom', label: 'Bottom' },
                ]}
                value={normCardY(page.cardY) ?? 'top'}
                onChange={(v) => patchPage({ cardY: v as 'top' | 'middle' | 'bottom' })}
              />
            </Field>
          </>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink }}>Stick photo to card</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 }}>Photo + badges follow the card position</Text>
          </View>
          <PillToggle on={page.stickToCard ?? false} onPress={() => patchPage({ stickToCard: !(page.stickToCard ?? false) })} />
        </View>
        </>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 }}>
          <View>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink }}>Verified check</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 }}>Blue tick after the handle</Text>
          </View>
          <PillToggle on={page.verified ?? true} onPress={() => patchPage({ verified: !(page.verified ?? true) })} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 15, paddingVertical: 13 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink }}>Watermark {plan === 'free' ? '· Solo to remove' : ''}</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 }}>Made with Sosial badge in the card</Text>
          </View>
          <PillToggle on={wmOn} onPress={toggleWm} />
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Section no="02" title="Blocks" hint="Stack content inside the card." />
        <View style={st.chips}>
          {TYPES.filter((t) => t.id !== 'image' || !blocks.some((b) => b.type === 'image')).map((t) => (
            <TouchableOpacity key={t.id} onPress={() => (t.id === 'image' ? addImage() : add(t.id))} style={st.chip} activeOpacity={0.75}>
              <Text style={st.chipT}>+ {t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      {blocks.map((b, idx) => {
        const open = openId === b.id;
        return (
          <View key={b.id} style={[st.card, open && st.cardOpen]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity onPress={() => setOpenId(open ? null : b.id)} style={{ flex: 1 }} activeOpacity={0.7}>
                <Text style={st.cardT} numberOfLines={1}>{idx + 1} · {b.type === 'bar' || b.type === 'pie' || b.type === 'vbar' ? 'chart' : b.type}</Text>
                <Text style={st.cardS} numberOfLines={1}>{b.heading || 'No heading'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => move(b.id, -1)} style={st.icon} activeOpacity={0.6}><Text style={st.iconT}>↑</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => move(b.id, 1)} style={st.icon} activeOpacity={0.6}><Text style={st.iconT}>↓</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(b.id)} style={[st.icon, st.del]} activeOpacity={0.6}><Ionicons name="close-circle" size={16} color={C.redText} /></TouchableOpacity>
            </View>
            {open ? (
              <View style={{ gap: 10, marginTop: 12 }}>
                {(b.type === 'bar' || b.type === 'pie' || b.type === 'vbar') ? (
                  <Seg
                    options={[{ value: 'bar', label: 'Bars' }, { value: 'vbar', label: 'Columns' }, { value: 'pie', label: 'Pie' }]}
                    value={b.type}
                    onChange={(v) => update(b.id, { type: v as BlockType })}
                  />
                ) : null}
                <Txt value={b.heading ?? ''} onChangeText={(v) => update(b.id, { heading: v })} placeholder="Heading (optional)" />
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <Field label="Width">
                      <Seg
                        options={[{ value: '1', label: 'Full' }, { value: '0.75', label: '75%' }, { value: '0.5', label: '50%' }]}
                        value={String(b.style?.width ?? 1)}
                        onChange={(v) => patchStyle(b, { width: Number(v) })}
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <Field label="Align">
                      <Seg
                        options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Mid' }, { value: 'right', label: 'Right' }]}
                        value={b.style?.align ?? 'left'}
                        onChange={(v) => patchStyle(b, { align: v as 'left' | 'center' | 'right' })}
                      />
                    </Field>
                  </View>
                </View>
                {b.type !== 'image' ? (
                  <Field label="Ink">
                    <Swatches colors={PALETTE} value={b.textColor ?? '#111111'} onChange={(c) => update(b.id, { textColor: c })} />
                  </Field>
                ) : null}
                {(b.type === 'bullets' || b.type === 'numbered' || b.type === 'free') ? (
                  <>
                    {(b.items ?? []).map((line, li) => (
                      <View key={li} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Txt value={line} onChangeText={(v) => { const items = [...(b.items ?? [])]; items[li] = v; update(b.id, { items }); }} multiline />
                        </View>
                        <TouchableOpacity onPress={() => update(b.id, { items: (b.items ?? []).filter((_, k) => k !== li) })} style={[st.icon, st.del]} activeOpacity={0.6}>
                          <Ionicons name="close-circle" size={16} color={C.redText} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <GhostBtn label="Add line" onPress={() => update(b.id, { items: [...(b.items ?? []), 'New line'] })} />
                  </>
                ) : null}
                {b.type === 'table' ? (
                  <>
                    <Text style={st.hint}>One row per line, commas separate columns.</Text>
                    <Txt
                      value={draftFor(b, 'table')}
                      onChangeText={(v) => setDrafts((d) => ({ ...d, [draftKey(b, 'table')]: v }))}
                      onBlur={() => commitDraft(b, 'table')}
                      style={{ minHeight: 90, textAlignVertical: 'top' }}
                      multiline
                    />
                    <Field label="Column widths">
                      <Seg
                        options={[{ value: 'equal', label: 'Equal' }, { value: 'first', label: 'Wide first' }, { value: 'last', label: 'Wide last' }]}
                        value={b.style?.tableColWidths ? (b.style.tableColWidths[0] > 1 ? 'first' : 'last') : 'equal'}
                        onChange={(v) =>
                          patchStyle(b, {
                            tableColWidths:
                              v === 'equal' ? undefined : (b.table?.[0] ?? []).map((_, ci, arr) => (v === 'first' ? (ci === 0 ? 1.8 : 1) : ci === arr.length - 1 ? 1.8 : 1)),
                          })
                        }
                      />
                    </Field>
                    <Field label="Text size">
                      <Stepper
                        value={b.style?.tableScale ?? 1}
                        onChange={(v) => patchStyle(b, { tableScale: v })}
                        step={0.1}
                        min={0.6}
                        max={1.6}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Field>
                    <ToggleRow C={C} title="Header fill" on={b.style?.tableHeaderBg ?? true} onPress={() => patchStyle(b, { tableHeaderBg: !(b.style?.tableHeaderBg ?? true) })} />
                    <ToggleRow C={C} title="Zebra rows" on={b.style?.tableZebra ?? false} onPress={() => patchStyle(b, { tableZebra: !(b.style?.tableZebra ?? false) })} />
                  </>
                ) : null}
                {(b.type === 'bar' || b.type === 'pie' || b.type === 'vbar') ? (
                  <>
                    <Text style={st.hint}>One per line, any format, the number is detected. Example: Jan $40</Text>
                    <Txt
                      value={draftFor(b, 'chart')}
                      onChangeText={(v) => setDrafts((d) => ({ ...d, [draftKey(b, 'chart')]: v }))}
                      onBlur={() => commitDraft(b, 'chart')}
                      style={{ minHeight: 90, textAlignVertical: 'top' }}
                      multiline
                    />
                    {(b.chart ?? []).map((d, di) => (
                      <View key={di} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => pickChartRowImage(b, di)}
                          style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#00000014', backgroundColor: '#00000008', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
                          activeOpacity={0.7}
                        >
                          {d.img ? (
                            <Image source={{ uri: d.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : (
                            <Text style={{ fontSize: 12, color: C.muted }}>+</Text>
                          )}
                        </TouchableOpacity>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: d.color ?? DATA[di % DATA.length], borderWidth: 1, borderColor: '#00000014' }} />
                        <Text style={st.itemLabel} numberOfLines={1}>{d.label}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                          {[...DATA, '#111111'].map((c) => (
                            <TouchableOpacity key={c} onPress={() => update(b.id, { chart: (b.chart ?? []).map((cc, k) => (k === di ? { ...cc, color: c } : cc)) })} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: (d.color ?? DATA[di % DATA.length]).toLowerCase() === c.toLowerCase() ? 2 : 1, borderColor: (d.color ?? DATA[di % DATA.length]).toLowerCase() === c.toLowerCase() ? C.ink : '#00000014' }} activeOpacity={0.7} />
                          ))}
                        </ScrollView>
                      </View>
                    ))}
                    {b.type === 'pie' ? (
                      <>
                        <Field label="Legend">
                          <Seg
                            options={[{ value: 'right', label: 'Right' }, { value: 'bottom', label: 'Below' }, { value: 'none', label: 'None' }]}
                            value={b.style?.chartLegend ?? 'right'}
                            onChange={(v) => patchStyle(b, { chartLegend: v as 'right' | 'bottom' | 'none' })}
                          />
                        </Field>
                        <Field label="Ring thickness">
                          <Stepper
                            value={b.style?.chartThickness ?? 0.35}
                            onChange={(v) => patchStyle(b, { chartThickness: v })}
                            step={0.05}
                            min={0.15}
                            max={0.8}
                            format={(v) => `${Math.round(v * 100)}%`}
                          />
                        </Field>
                      </>
                    ) : (
                      <Field label="Thickness">
                        <Stepper
                          value={b.style?.chartThickness ?? 1}
                          onChange={(v) => patchStyle(b, { chartThickness: v })}
                          step={0.1}
                          min={0.3}
                          max={1.6}
                          format={(v) => `${Math.round(v * 100)}%`}
                        />
                      </Field>
                    )}
                    <Field label="Corner rounding" hint="0 = style default">
                      <Stepper
                        value={b.style?.chartRadius ?? 0}
                        onChange={(v) => patchStyle(b, { chartRadius: v })}
                        step={0.1}
                        min={0}
                        max={1}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Field>
                    {b.type === 'vbar' ? (
                      <Field label="Column height">
                        <Stepper
                          value={b.style?.chartHeight ?? 1}
                          onChange={(v) => patchStyle(b, { chartHeight: v })}
                          step={0.1}
                          min={0.4}
                          max={1.6}
                          format={(v) => `${Math.round(v * 100)}%`}
                        />
                      </Field>
                    ) : null}
                    <ToggleRow C={C} title="Show values" on={b.style?.chartShowValues ?? true} onPress={() => patchStyle(b, { chartShowValues: !(b.style?.chartShowValues ?? true) })} />
                    <ToggleRow C={C} title="Show labels" on={b.style?.chartShowLabels ?? true} onPress={() => patchStyle(b, { chartShowLabels: !(b.style?.chartShowLabels ?? true) })} />
                    {b.type !== 'pie' ? (
                      <>
                        <Field label="Values sit">
                          <Seg options={[{ value: 'out', label: 'Above' }, { value: 'in', label: 'In bar' }]} value={b.style?.chartValuePos ?? 'out'} onChange={(v) => patchStyle(b, { chartValuePos: v as 'out' | 'in' })} />
                        </Field>
                        <Field label="Labels sit">
                          <Seg options={[{ value: 'out', label: 'Outside' }, { value: 'in', label: 'In bar' }]} value={b.style?.chartLabelPos ?? 'out'} onChange={(v) => patchStyle(b, { chartLabelPos: v as 'out' | 'in' })} />
                        </Field>
                        <Field label="Bar picture" hint="Uses each row's photo, fill the bar or a small tile">
                          <Seg options={[{ value: 'none', label: 'None' }, { value: 'fill', label: 'Fill' }, { value: 'tile', label: 'Tile' }]} value={b.style?.chartBarImg ?? 'none'} onChange={(v) => patchStyle(b, { chartBarImg: v as 'none' | 'fill' | 'tile' })} />
                        </Field>
                        {(b.style?.chartBarImg ?? 'none') === 'tile' ? (
                          <Field label="Tile position">
                            <Seg options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]} value={b.style?.chartBarImgPos ?? 'middle'} onChange={(v) => patchStyle(b, { chartBarImgPos: v as 'top' | 'middle' | 'bottom' })} />
                          </Field>
                        ) : null}
                        <Field label="Label picture" hint="Show each row's photo as a small thumb beside the label">
                          <Seg options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} value={(b.style?.chartLabelImg ?? true) ? 'on' : 'off'} onChange={(v) => patchStyle(b, { chartLabelImg: v === 'on' })} />
                        </Field>
                        {(b.style?.chartLabelImg ?? true) ? (
                          <Field label="Photo size">
                            <Stepper value={b.style?.chartLabelImgSize ?? 1} onChange={(v) => patchStyle(b, { chartLabelImgSize: v })} step={0.1} min={0.5} max={2} format={(v) => `${Math.round(v * 100)}%`} />
                          </Field>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {b.type === 'image' ? (
                  <>
                    {b.imageUri ? (
                      <Image source={{ uri: b.imageUri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryBtn label={b.imageUri ? 'Change image' : 'Pick image'} onPress={() => pickImage(b.id)} />
                      </View>
                      {b.imageUri ? (
                        <GhostBtn label="Remove" danger onPress={() => remove(b.id)} />
                      ) : null}
                    </View>
                    <Field label="Size" hint="Square 1:1, Wide 16:9, or your own height.">
                      <Seg
                        options={[{ value: 'square', label: 'Square' }, { value: 'wide', label: 'Wide' }, { value: 'custom', label: 'Custom' }]}
                        value={b.imageAspect ?? (b.imageH !== undefined ? 'custom' : 'wide')}
                        onChange={(v) => update(b.id, { imageAspect: v as 'square' | 'wide' | 'custom' })}
                      />
                    </Field>
                    {(b.imageAspect ?? (b.imageH !== undefined ? 'custom' : 'wide')) === 'custom' ? (
                      <Field label="Height" hint={`${b.imageH ?? 140}px`}>
                        <Stepper value={b.imageH ?? 140} onChange={(v) => update(b.id, { imageH: v })} step={10} min={60} max={300} format={(v) => `${v}`} />
                      </Field>
                    ) : null}
                    <Field label="Fit">
                      <Seg
                        options={[{ value: 'cover', label: 'Fill' }, { value: 'contain', label: 'Fit' }]}
                        value={b.style?.imageFit ?? 'cover'}
                        onChange={(v) => patchStyle(b, { imageFit: v as 'cover' | 'contain' })}
                      />
                    </Field>
                    <Field label="Corners" hint="0 = default">
                      <Stepper
                        value={b.style?.imageRadius ?? 0}
                        onChange={(v) => patchStyle(b, { imageRadius: v })}
                        step={0.05}
                        min={0}
                        max={0.5}
                        format={(v) => `${Math.round(v * 200)}%`}
                      />
                    </Field>
                    {b.imageUri ? (
                      <Field label="Crop" hint="Drag & zoom for full control, or tap a focal point.">
                        <View style={{ gap: 10 }}>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <GhostBtn label={b.imageCrop ? 'Edit crop' : 'Crop manually'} onPress={() => setCropId(b.id)} />
                            </View>
                            {b.imageCrop ? (
                              <TouchableOpacity onPress={() => update(b.id, { imageCrop: undefined })} style={st.icon} activeOpacity={0.7}>
                                <Text style={[st.iconT, { color: C.redText }]}>↺</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                          <View style={{ gap: 4 }}>
                          {[0, 1, 2].map((ry) => (
                            <View key={ry} style={{ flexDirection: 'row', gap: 4 }}>
                              {[0, 1, 2].map((rx) => {
                                const f = ry * 3 + rx;
                                const on = (b.imageFocus ?? 4) === f;
                                return (
                                  <TouchableOpacity
                                    key={f}
                                    onPress={() => update(b.id, { imageFocus: f })}
                                    style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: on ? C.accent : C.card, borderWidth: 1, borderColor: on ? C.accent : C.lineSoft }}
                                    activeOpacity={0.7}
                                  />
                                );
                              })}
                            </View>
                          ))}
                          </View>
                        </View>
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {blocks.length === 0 ? (
        <View style={st.emptyBlocks}>
          <Text style={st.emptyBlocksT}>Empty card</Text>
          <Text style={st.emptyBlocksS}>Add a block above to fill it.</Text>
        </View>
      ) : null}
      {/* Global text styling rides under the blocks whose text it dresses. */}
      {blocks.length > 0 ? (
        <Field label="Content ink">
          <Swatches colors={PALETTE} value={commonInk} onChange={(c) => setBlocks(blocks.map((b) => ({ ...b, textColor: c })))} />
        </Field>
      ) : null}
      <Field label="Content size" hint={`${Math.round((page.contentScale ?? 1) * 100)}%`}>
        <Stepper value={page.contentScale ?? 1} onChange={(v) => patchPage({ contentScale: v })} step={0.05} min={0.5} max={1.5} format={(v) => `${Math.round(v * 100)}%`} />
      </Field>
      </View>

      <AIGenerateSheet visible={ai} template={page} ratio={sizeRatio} onClose={() => setAi(false)} onApply={applyAi} />
      <ImageCropModal
        visible={!!cropBlock}
        uri={cropBlock?.imageUri}
        aspect={cropBlock?.imageAspect ?? (cropBlock?.imageH !== undefined ? 'custom' : 'wide')}
        customH={cropBlock?.imageH}
        value={cropBlock?.imageCrop}
        onDone={(c) => { update(cropBlock!.id, { imageCrop: c }); setCropId(null); }}
        onClose={() => setCropId(null)}
      />
    </View>
  );
}

const makeSt = (C: Palette) => StyleSheet.create({
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.ink, borderRadius: 999, paddingVertical: 12 },
  aiT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.onInk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: C.card },
  chipT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink },
  cardBtn: { flexGrow: 1, minWidth: '30%', paddingVertical: 11, borderRadius: R.md, alignItems: 'center', backgroundColor: C.card },
  cardBtnOn: { backgroundColor: C.ink },
  cardBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  cardBtnTOn: { color: C.onInk },
  card: { borderRadius: R.lg, padding: 14, backgroundColor: C.card },
  cardOpen: { backgroundColor: C.paper, shadowColor: '#1C1917', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, letterSpacing: -0.2, color: C.ink, textTransform: 'capitalize' },
  cardS: { fontFamily: 'PlusJakartaSans_400Regular', color: C.muted, fontSize: 12, marginTop: 2 },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  iconT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },
  del: { backgroundColor: C.paleRed },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted },
  itemLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.ink, maxWidth: 70 },
  emptyBlocks: { backgroundColor: C.card, borderRadius: R.lg, padding: 24, alignItems: 'center' },
  emptyBlocksT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  emptyBlocksS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 4 },
});