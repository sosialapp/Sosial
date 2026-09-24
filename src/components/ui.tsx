import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, TextInputProps, Platform, ActivityIndicator, DimensionValue } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import FontAwesome6 from '@expo/vector-icons/build/FontAwesome6';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Svg, Path, G } from 'react-native-svg';
import { useTheme, Palette, R } from '../theme';
import { SOCIAL_META } from '../constants';

/** Real brand glyph for a social platform — optically balanced per brand */
const GLYPH_SCALE: Record<string, number> = {
  instagram: 1,
  tiktok: 1.08,
  threads: 1,
  x: 0.92,
  facebook: 1,
  youtube: 0.88,
  whatsapp: 1,
  linkedin: 1,
  pinterest: 1,
  bluesky: 1.05,
  mastodon: 1,
};
export function SocialGlyph({ platform, size = 14, color = '#fff' }: { platform: string; size?: number; color?: string }) {
  const s = size * (GLYPH_SCALE[platform] ?? 1);
  if (platform === 'x') return <FontAwesome6 name="x-twitter" size={s} color={color} />;
  if (platform === 'threads') return <FontAwesome6 name="threads" size={s} color={color} />;
  if (platform === 'mastodon') return <FontAwesome6 name="mastodon" size={s} color={color} />;
  if (platform === 'bluesky') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026"
          fill={color}
        />
      </Svg>
    );
  }
  const map: Record<string, any> = {
    instagram: 'logo-instagram',
    tiktok: 'logo-tiktok',
    facebook: 'logo-facebook',
    youtube: 'logo-youtube',
    whatsapp: 'logo-whatsapp',
    linkedin: 'logo-linkedin',
    pinterest: 'logo-pinterest',
  };
  return <Ionicons name={map[platform] ?? 'ellipse'} size={s} color={color} />;
}

/** Channel avatar: profile picture of a connected account as a circular tile
 *  with the social logo stacked in a larger circular disc in the corner;
 *  falls back to the brand disc when no avatar. */
export function ChannelAvatar({ platform, avatar, size = 38, badge = true }: { platform: string; avatar?: string; size?: number; badge?: boolean }) {
  const { C } = useTheme();
  const bg = SOCIAL_META[platform]?.bg ?? C.ink;
  const badgeSize = Math.max(14, Math.round(size * 0.54));
  return (
    <View style={{ width: size, height: size }}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.lineSoft }} resizeMode="cover" />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <SocialGlyph platform={platform} size={Math.round(size * 0.56)} color="#fff" />
        </View>
      )}
      {avatar && badge ? (
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bone }}>
          <SocialGlyph platform={platform} size={Math.round(badgeSize * 0.62)} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

/** Overlapping profile pictures for a channel's selected accounts (+n overflow).
 *  Pass avatar urls in order; falls back to brand tiles where missing. */
export function AccountStack({ platform, avatars, size = 22, max = 3, ring }: { platform: string; avatars: (string | undefined)[]; size?: number; max?: number; ring?: string }) {
  const { C } = useTheme();
  if (avatars.length === 0) return null;
  const ringColor = ring ?? C.card;
  const shown = avatars.slice(0, max);
  const extra = avatars.length - shown.length;
  const ringR = size / 2 + 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((av, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.38),
            borderWidth: 2,
            borderColor: ringColor,
            borderRadius: ringR,
            backgroundColor: ringColor,
          }}
        >
          <ChannelAvatar platform={platform} avatar={av} size={size} badge={false} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={{
            marginLeft: -Math.round(size * 0.38),
            width: size + 4,
            height: size + 4,
            borderRadius: ringR,
            borderWidth: 2,
            borderColor: ringColor,
            backgroundColor: C.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: Math.max(9, Math.round(size * 0.4)), color: C.soft }}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Numbered editorial section header — "01 · Photo" */
export function Section({ no, title, hint }: { no: string; title: string; hint?: string }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={s.secNo}>{no}</Text>
        <Text style={s.secTitle}>{title}</Text>
      </View>
      {hint ? <Text style={s.secHint}>{hint}</Text> : null}
    </View>
  );
}

/** Sentence-case field label with optional hint */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** iOS-style segmented control — tonal track, paper thumb with shadow */
export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={s.segWrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} style={[s.seg, on && s.segOn]} activeOpacity={0.8}>
            <Text style={[s.segT, on && s.segTOn]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Color swatches with offset ink ring when selected (exact dupes collapsed) */
export function Swatches({ colors, value, onChange, size = 30 }: { colors: string[]; value?: string; onChange: (c: string) => void; size?: number }) {
  const { C } = useTheme();
  const s = makeS(C);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const c of colors) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(c);
    }
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {unique.map((c) => {
        const on = value?.toLowerCase() === c.toLowerCase();
        return (
          <TouchableOpacity key={c} onPress={() => onChange(c)} activeOpacity={0.7}>
            <View
              style={{
                width: size + 8, height: size + 8, borderRadius: (size + 8) / 2,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: on ? 2 : 0, borderColor: C.ink,
              }}
            >
              <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, borderWidth: 1, borderColor: '#00000014' }} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Round stepper — tap −/+ or tap the number to type a value */
export function Stepper({ value, onChange, step = 1, min = 0, max = 200, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string }) {
  const { C } = useTheme();
  const s = makeS(C);
  const dec = Math.max(0, (String(step).split('.')[1] ?? '').length);
  const round = (v: number) => Number(v.toFixed(dec));
  const clamp = (v: number) => round(Math.min(max, Math.max(min, v)));
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    setDraft(null);
    const n = parseFloat(raw.replace(',', '.'));
    if (!isNaN(n)) onChange(clamp(n));
  };
  return (
    <View style={s.stepWrap}>
      <TouchableOpacity onPress={() => onChange(clamp(value - step))} style={s.stepBtn} activeOpacity={0.6}>
        <Text style={s.stepT}>−</Text>
      </TouchableOpacity>
      <TextInput
        value={draft ?? (format ? format(value) : String(value))}
        onChangeText={setDraft}
        onBlur={() => { if (draft !== null) commit(draft); }}
        onSubmitEditing={(e) => commit(e.nativeEvent.text)}
        keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
        returnKeyType="done"
        selectTextOnFocus
        style={s.stepVal}
      />
      <TouchableOpacity onPress={() => onChange(clamp(value + step))} style={s.stepBtn} activeOpacity={0.6}>
        <Text style={s.stepT}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Solid ink press button */
export function PrimaryBtn({ label, onPress, icon, loading, loadingLabel }: { label: string; onPress: () => void; icon?: string; loading?: boolean; loadingLabel?: string }) {
  const { C } = useTheme();
  const s = makeS(C);
  const busy = !!loading;
  return (
    <TouchableOpacity onPress={onPress} style={s.btn} activeOpacity={0.85} disabled={busy}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
        {busy ? <ActivityIndicator size="small" color={C.onInk} /> : icon ? <Ionicons name={icon as any} size={15} color={C.onInk} /> : null}
        <Text style={s.btnT}>{busy && loadingLabel ? loadingLabel : label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Quiet tonal button */
export function GhostBtn({ label, onPress, danger, left }: { label: string; onPress: () => void; danger?: boolean; left?: React.ReactNode }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <TouchableOpacity onPress={onPress} style={[s.ghost, danger && s.ghostDanger]} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        {left}
        <Text style={[s.ghostT, danger && { color: C.redText }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Native aspect probe (clamped) — thumbs follow the file instead of forcing a box. */
export function useProbedRatio(uri: string, min: number, max: number): number | null {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setRatio(null);
    Image.getSize(
      uri,
      (w, h) => { if (live && w > 0 && h > 0) setRatio(Math.min(max, Math.max(min, w / h))); },
      () => {},
    );
    return () => { live = false; };
  }, [uri, min, max]);
  return ratio;
}

/** Feed thumbnail: photo in its true aspect (only pathological extremes clamped)
 *  unless `aspect` pins a crop box (e.g. 4/5 portrait previews); video in a
 *  4:5 portrait box to match. Small enough to keep rows compact. */
export function FeedPhoto({ uri, width = 88, min = 0.45, max = 2, radius = 11, aspect }: { uri: string; width?: DimensionValue; min?: number; max?: number; radius?: number; aspect?: number }) {
  const { C } = useTheme();
  const ratio = useProbedRatio(uri, min, max);
  return (
    <Image
      source={{ uri }}
      style={{ width, aspectRatio: aspect ?? ratio ?? 1, borderRadius: radius, backgroundColor: C.lineSoft }}
      resizeMode="cover"
    />
  );
}

export function FeedVideo({ uri, width = 88, radius = 11, aspect = 4 / 5 }: { uri: string; width?: number; radius?: number; aspect?: number }) {
  const { C } = useTheme();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={{ width, aspectRatio: aspect, borderRadius: radius, backgroundColor: C.ink, overflow: 'hidden' }}>
      <VideoView style={{ width: '100%', height: '100%' }} player={player} contentFit="cover" nativeControls={false} />
      <View style={{ position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="play" size={13} color="#fff" />
      </View>
    </View>
  );
}

/** Multicolor Google "G" — Ionicons has no brand-color mark, so draw it. */
export function GoogleGlyph({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </Svg>
  );
}

/** Tonal inset text input */
export function Txt(props: TextInputProps) {  const { C } = useTheme();
  const s = makeS(C);
  return <TextInput {...props} placeholderTextColor={C.faint} style={[s.input, props.multiline && { minHeight: 60, textAlignVertical: 'top' }, props.style as any]} />;
}

/** Native-feel switch */
export function PillToggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <TouchableOpacity onPress={onPress} style={[s.toggle, on && s.toggleOn]} activeOpacity={0.8}>
      <View style={[s.knob, on && s.knobOn]} />
    </TouchableOpacity>
  );
}

/**
 * Custom card action icons — uniform 24 box; odd-grid glyphs scale inside so
 * every icon renders at the passed size. Mirrors the web ICON_PATHS set.
 */
export type ActionIconName =
  | 'fb-like' | 'fb-comment' | 'fb-share'
  | 'ig-heart' | 'ig-comment' | 'ig-plane' | 'ig-bookmark' | 'ig-repost'
  | 'repost';

export function ActionIcon({ name, size, color }: { name: ActionIconName; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {name === 'fb-like' ? (
        <Path d="M7 10v12m8-16.12L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88" />
      ) : name === 'fb-comment' ? (
        <G transform="translate(24 0) scale(-1 1)">
          <Path d="m3 20 1.3-3.9A9 8 0 1 1 7.7 19z" />
        </G>
      ) : name === 'fb-share' ? (
        <Path d="M13 4v4C6.425 9.028 3.98 14.788 3 20c-.037.206 5.384-5.962 10-6v4l8-7z" />
      ) : name === 'ig-heart' ? (
        <G transform="translate(1 2.2) scale(0.043)">
          <Path
            d="M463.044 117.283c-10.125-26.729-28.412-47.537-50.269-60.578-13.478-8.048-28.343-13.125-43.461-14.808-14.879-1.655-30.018.007-44.284 5.407-37.461 14.189-50.601 41.912-66.522 74.028-3.422 6.887-1.964 6.964-5.893.078-17.576-30.87-33.786-63.684-70.127-75.725-12.879-4.26-26.554-5.408-40.088-3.845-13.83 1.606-27.546 6.028-40.207 12.83-25.068 13.485-45.883 36.215-55.382 64.916-31.525 95.237 83.379 188.376 170.42 258.918 12.97 10.506 25.363 20.547 36.834 30.251 15.449-13.288 32.356-26.695 49.995-40.687 87.815-69.634 195.291-154.872 158.984-250.785zm-29.173-95.842c29.483 17.589 54.094 45.531 67.663 81.351 46.924 123.973-73.479 219.471-171.871 297.485-22.829 18.11-44.418 35.228-61.078 50.41-7.626 7.478-19.85 7.894-27.969.711-13.9-12.323-31.033-26.201-49.312-41.01C94.743 332.128-32.73 228.808 7.688 106.7c12.956-39.151 41.144-70.042 75.028-88.266C99.939 9.175 118.705 3.147 137.724.943c19.337-2.232 38.983-.556 57.65 5.619 22.047 7.302 42.601 20.751 59.55 41.271 16.316-18.527 35.37-31.35 55.614-39.018 20.513-7.759 42.13-10.168 63.283-7.816 20.913 2.324 41.453 9.337 60.05 20.442z"
            fill={color}
            stroke="none"
            fillRule="nonzero"
          />
        </G>
      ) : name === 'ig-plane' ? (
        <G transform="translate(1 2.3) scale(0.179)">
          <Path
            d="M96.14,12.47l-76.71-1.1,28.3,27.85L96.14,12.47ZM53.27,49l9.88,39.17L102.1,22,53.27,49ZM117,1.6a5.59,5.59,0,0,1,4.9,8.75L66.06,105.21a5.6,5.6,0,0,1-10.44-1.15L41.74,49,1.67,9.57A5.59,5.59,0,0,1,5.65,0L117,1.6Z"
            fill={color}
            stroke="none"
          />
        </G>
      ) : name === 'ig-bookmark' ? (
        <G transform="translate(2.14 1) scale(0.043)">
          <Path
            d="M32.256 0h394.488c8.895 0 16.963 3.629 22.795 9.462C455.371 15.294 459 23.394 459 32.256v455.929c0 13.074-10.611 23.685-23.686 23.685-7.022 0-13.341-3.07-17.683-7.93L230.124 330.422 39.692 505.576c-9.599 8.838-24.56 8.214-33.398-1.385a23.513 23.513 0 01-6.237-16.006L0 32.256C0 23.459 3.629 15.391 9.461 9.55l.089-.088C15.415 3.621 23.467 0 32.256 0zm379.373 47.371H47.371v386.914l166.746-153.364c8.992-8.198 22.933-8.319 32.013.089l165.499 153.146V47.371z"
            fill={color}
            stroke="none"
            fillRule="nonzero"
          />
        </G>
      ) : name === 'ig-comment' ? (
        <G transform="translate(1 1) scale(0.1789)">
          <Path
            d="M61.44,0a61.46,61.46,0,0,1,54.91,89l6.44,25.74a5.83,5.83,0,0,1-7.25,7L91.62,115A61.43,61.43,0,1,1,61.44,0ZM96.63,26.25a49.78,49.78,0,1,0-9,77.52A5.83,5.83,0,0,1,92.4,103L109,107.77l-4.5-18a5.86,5.86,0,0,1,.51-4.34,49.06,49.06,0,0,0,4.62-11.58,50,50,0,0,0-13-47.62Z"
            fill={color}
            stroke="none"
          />
        </G>
      ) : (
        <>
          <Path d="m2 9 3-3 3 3" />
          <Path d="M13 18H7a2 2 0 0 1-2-2V6" />
          <Path d="m22 15-3 3-3-3" />
          <Path d="M11 6h6a2 2 0 0 1 2 2v10" />
        </>
      )}
    </Svg>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  secNo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.accent },
  secTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, letterSpacing: -0.3, color: C.ink },
  secHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: C.muted },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.soft },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.faint },
  segWrap: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: 3, gap: 2 },
  seg: { flex: 1, minWidth: 0, paddingVertical: 7.5, paddingHorizontal: 2, alignItems: 'center', borderRadius: R.sm },
  segOn: { backgroundColor: C.paper, shadowColor: '#1C1917', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted, textAlign: 'center' },
  segTOn: { fontFamily: 'PlusJakartaSans_700Bold', color: C.ink },
  stepWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  stepBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink, marginTop: -2 },
  stepVal: { minWidth: 50, flexShrink: 1, textAlign: 'center', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink, fontVariant: ['tabular-nums'] },
  btn: { backgroundColor: C.ink, borderRadius: R.md + 2, minHeight: 46, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: 'PlusJakartaSans_700Bold', color: C.onInk, fontSize: 14.5 },
  ghost: { backgroundColor: C.surface, borderRadius: R.md + 2, minHeight: 42, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  ghostDanger: { backgroundColor: C.paleRed },
  ghostT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  input: { fontFamily: 'PlusJakartaSans_400Regular', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14.5, color: C.ink },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D8D1BF', padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: C.accent, alignItems: 'flex-end' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', shadowColor: '#1C1917', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  knobOn: { backgroundColor: '#fff' },
});
