import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, TextInputProps, Platform, ActivityIndicator, DimensionValue } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import FontAwesome6 from '@expo/vector-icons/build/FontAwesome6';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Svg, Path, G } from 'react-native-svg';
import { useTheme, Palette, R } from '../theme';
import { SOCIAL_META } from '../constants';
import { useFocusScrollContext } from './FocusScroll';

/** Filled circle-check (Ionicons checkmark-circle shape, 512 viewBox) — the
 *  shared "connected/done" icon used everywhere ✓ used to be typed. */
export function CheckIcon({ size = 16, color }: { size?: number; color?: string }) {
  return (
    <Ionicons
      name="checkmark-circle"
      size={size}
      color={color}
      style={{ opacity: 1 }}
    />
  );
}

/** Filled circle-cross (Ionicons close-circle shape) — the shared "remove"
 *  icon used everywhere ✕/× used to be typed. */
export function CrossIcon({ size = 16, color }: { size?: number; color?: string }) {
  return (
    <Ionicons
      name="close-circle"
      size={size}
      color={color}
      style={{ opacity: 1 }}
    />
  );
}

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
  telegram: 1.1,
  discord: 1,
  wordpress: 1,
  devto: 1,
  hashnode: 1,
  ghost: 1,
  vk: 1,
  gmb: 1.15,
};
export function SocialGlyph({ platform, size = 14, color = '#fff' }: { platform: string; size?: number; color?: string }) {
  const s = size * (GLYPH_SCALE[platform] ?? 1);
  if (platform === 'x') return <FontAwesome6 name="x-twitter" size={s} color={color} />;
  if (platform === 'threads') return <FontAwesome6 name="threads" size={s} color={color} />;
  if (platform === 'mastodon') return <FontAwesome6 name="mastodon" size={s} color={color} />;
  if (platform === 'telegram') return <FontAwesome6 name="telegram" size={s} color={color} />;
  if (platform === 'discord') return <FontAwesome6 name="discord" size={s} color={color} />;
  if (platform === 'wordpress') return <FontAwesome6 name="wordpress" size={s} color={color} />;
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
  if (platform === 'devto') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z"
          fill={color}
        />
      </Svg>
    );
  }
  if (platform === 'hashnode') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M22.351 8.019l-6.37-6.37a5.63 5.63 0 0 0-7.962 0l-6.37 6.37a5.63 5.63 0 0 0 0 7.962l6.37 6.37a5.63 5.63 0 0 0 7.962 0l6.37-6.37a5.63 5.63 0 0 0 0-7.962zM12 15.953a3.953 3.953 0 1 1 0-7.906 3.953 3.953 0 0 1 0 7.906z"
          fill={color}
        />
      </Svg>
    );
  }
  if (platform === 'ghost') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.256 2.313c2.47.005 5.116 2.008 5.898 2.962l.244.3c1.64 1.994 3.569 4.34 3.569 6.966 0 3.719-2.98 5.808-6.158 7.508-1.433.766-2.98 1.508-4.748 1.508-4.543 0-8.366-3.569-8.366-8.112 0-.706.17-1.425.342-2.15.122-.515.244-1.033.307-1.549.548-4.539 2.967-6.795 8.422-7.408a4.29 4.29 0 01.49-.026Z"
          fill={color}
        />
      </Svg>
    );
  }
  if (platform === 'vk') {
    return (
      <Svg width={s} height={s} viewBox="0 0 20 20">
        <Path
          d="M17.802 12.298s1.617 1.597 2.017 2.336a.1.1 0 0 1 .018.035q.244.409.123.645c-.135.261-.592.392-.747.403h-2.858c-.199 0-.613-.052-1.117-.4c-.385-.269-.768-.712-1.139-1.145c-.554-.643-1.033-1.201-1.518-1.201a.6.6 0 0 0-.18.03c-.367.116-.833.639-.833 2.032c0 .436-.344.684-.585.684H9.674c-.446 0-2.768-.156-4.827-2.327C2.324 10.732.058 5.4.036 5.353c-.141-.345.155-.533.475-.533h2.886c.387 0 .513.234.601.444c.102.241.48 1.205 1.1 2.288c1.004 1.762 1.621 2.479 2.114 2.479a.53.53 0 0 0 .264-.07c.644-.354.524-2.654.494-3.128c0-.092-.001-1.027-.331-1.479c-.236-.324-.638-.45-.881-.496c.065-.094.203-.238.38-.323c.441-.22 1.238-.252 2.029-.252h.439c.858.012 1.08.067 1.392.146c.628.15.64.557.585 1.943c-.016.396-.033.842-.033 1.367c0 .112-.005.237-.005.364c-.019.711-.044 1.512.458 1.841a.4.4 0 0 0 .217.062c.174 0 .695 0 2.108-2.425c.62-1.071 1.1-2.334 1.133-2.429c.028-.053.112-.202.214-.262a.5.5 0 0 1 .236-.056h3.395c.37 0 .621.056.67.196c.082.227-.016.92-1.566 3.016c-.261.349-.49.651-.691.915c-1.405 1.844-1.405 1.937.083 3.337"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }
  if (platform === 'gmb') {
    // Official storefront mark (user-supplied art).
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M3.273 1.636c-.736 0-1.363.492-1.568 1.16L0 9.272c0 1.664 1.336 3 3 3a3 3 0 0 0 3-3c0 1.664 1.336 3 3 3a3 3 0 0 0 3-3c0 1.65 1.35 3 3 3c1.664 0 3-1.336 3-3c0 1.664 1.336 3 3 3s3-1.336 3-3l-1.705-6.476a1.65 1.65 0 0 0-1.568-1.16zm8.729 9.326c-.604 1.063-1.703 1.81-3.002 1.81c-1.304 0-2.398-.747-3-1.806c-.604 1.06-1.702 1.806-3 1.806c-.484 0-.944-.1-1.363-.277v8.232c0 .9.736 1.637 1.636 1.637h17.454c.9 0 1.636-.737 1.636-1.637v-8.232a3.5 3.5 0 0 1-1.363.277c-1.304 0-2.398-.746-3-1.804c-.602 1.058-1.696 1.804-3 1.804c-1.299 0-2.394-.75-2.998-1.81m5.725 3.765c.808 0 1.488.298 2.007.782l-.859.859a1.62 1.62 0 0 0-1.148-.447c-.98 0-1.772.827-1.772 1.806s.792 1.807 1.772 1.807c.882 0 1.485-.501 1.615-1.191h-1.615v-1.16h2.826q.053.294.054.613c0 1.714-1.147 2.931-2.88 2.931a3 3 0 0 1 0-6"
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
  const badgeSize = Math.max(12, Math.round(size * 0.48));
  // Stored avatar URLs die (fbcdn/TikTok sign theirs with expiries) — a dead
  // photo falls back to the brand disc, never a blank hole (web parity).
  const [dead, setDead] = useState(false);
  useEffect(() => setDead(false), [avatar]);
  const live = !!avatar && !dead;
  return (
    <View style={{ width: size, height: size }}>
      {live ? (
        <Image
          source={{ uri: avatar }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.lineSoft }}
          resizeMode="cover"
          onError={() => setDead(true)}
        />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <SocialGlyph platform={platform} size={Math.round(size * 0.56)} color="#fff" />
        </View>
      )}
      {live && badge ? (
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
export function GhostBtn({ label, onPress, danger, left, disabled }: { label: string; onPress: () => void; danger?: boolean; left?: React.ReactNode; disabled?: boolean }) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <TouchableOpacity onPress={onPress} style={[s.ghost, danger && s.ghostDanger, disabled && { opacity: 0.5 }]} activeOpacity={0.8} disabled={disabled}>
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

/** Tonal inset text input — reports focus to the FocusScrollBridge (if any),
 *  so the typed box scrolls above the keyboard on every screen that mounts
 *  `useFocusScrollPanel`. Screens without the bridge behave exactly as before. */
export function Txt(props: TextInputProps) {
  const { C } = useTheme();
  const s = makeS(C);
  const { ensureVisible } = useFocusScrollContext();
  const ref = useRef<TextInput>(null);
  const { onFocus, ...rest } = props;
  return (
    <TextInput
      ref={ref}
      {...rest}
      onFocus={(e) => {
        onFocus?.(e);
        ensureVisible(ref.current);
      }}
      placeholderTextColor={C.faint}
      style={[s.input, props.multiline && { minHeight: 60, textAlignVertical: 'top' }, props.style as any]}
    />
  );
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
 * Scalloped verified seal (check laid over it by the caller in white).
 * Mirrors the web VERIFIED_SEAL.
 */
export const VERIFIED_SEAL =
  'M22.02 11.164a1.84 1.84 0 0 0-.57-.67l-1.33-1a.35.35 0 0 1-.14-.2a.36.36 0 0 1 0-.25l.55-1.63a2 2 0 0 0 .06-.9a1.8 1.8 0 0 0-.36-.84a1.86 1.86 0 0 0-.7-.57a1.75 1.75 0 0 0-.85-.17h-1.5a.41.41 0 0 1-.39-.3l-.43-1.5a1.9 1.9 0 0 0-.46-.81a2 2 0 0 0-.78-.49a2 2 0 0 0-.92-.06a1.9 1.9 0 0 0-.83.39l-1.14.9a.35.35 0 0 1-.23.09a.36.36 0 0 1-.22-.05l-1.13-.9a1.85 1.85 0 0 0-.8-.38a1.9 1.9 0 0 0-.88 0a1.9 1.9 0 0 0-.78.43a2.1 2.1 0 0 0-.51.79l-.43 1.51a.38.38 0 0 1-.15.22a.4.4 0 0 1-.27.07H5.41a1.9 1.9 0 0 0-.89.18a1.8 1.8 0 0 0-.71.57a1.9 1.9 0 0 0-.36.83c-.05.293-.03.595.06.88L4 8.993a.41.41 0 0 1-.14.45l-1.33 1c-.242.18-.44.412-.58.68a1.93 1.93 0 0 0 0 1.71a2 2 0 0 0 .58.68l1.33 1a.41.41 0 0 1 .14.45l-.55 1.63a2 2 0 0 0-.07.91c.05.298.174.58.36.82c.183.25.428.45.71.58c.265.126.557.184.85.17h1.49a.38.38 0 0 1 .25.08a.34.34 0 0 1 .14.21l.43 1.51a2 2 0 0 0 .46.8a1.89 1.89 0 0 0 2.54.17l1.15-.91a.39.39 0 0 1 .49 0l1.13.9c.24.202.53.337.84.39q.17.015.34 0a1.9 1.9 0 0 0 .58-.09a1.87 1.87 0 0 0 1.24-1.28l.44-1.52a.34.34 0 0 1 .14-.21a.4.4 0 0 1 .27-.08h1.43a2 2 0 0 0 .89-.17a1.91 1.91 0 0 0 1.06-1.4a1.9 1.9 0 0 0-.07-.92l-.54-1.62a.36.36 0 0 1 0-.25a.35.35 0 0 1 .14-.2l1.33-1a1.9 1.9 0 0 0 .57-.68a1.8 1.8 0 0 0 .21-.86a1.9 1.9 0 0 0-.23-.78';

/**
 * Custom card action icons — uniform 24 box; odd-grid glyphs scale inside so
 * every icon renders at the passed size. Mirrors the web ICON_PATHS set.
 */
export type ActionIconName =
  | 'fb-like' | 'fb-comment' | 'fb-share'
  | 'ig-heart' | 'ig-comment' | 'ig-plane' | 'ig-bookmark' | 'ig-repost'
  | 'th-heart' | 'th-comment' | 'th-repost' | 'th-send'
  | 'x-comment' | 'x-retweet' | 'x-views' | 'x-bookmark' | 'x-share'
  | 'bsky-comment' | 'bsky-repost' | 'bsky-heart' | 'bsky-bookmark' | 'bsky-share'
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
        <G transform="scale(1.16)">
          <Path
            d="M10.5167 17.3417C10.2334 17.4417 9.76669 17.4417 9.48335 17.3417C7.06669 16.5167 1.66669 13.075 1.66669 7.24166C1.66669 4.66666 3.74169 2.58333 6.30002 2.58333C7.81669 2.58333 9.15835 3.31666 10 4.45C10.4282 3.87156 10.9858 3.40143 11.6283 3.07728C12.2709 2.75313 12.9804 2.58396 13.7 2.58333C16.2584 2.58333 18.3334 4.66666 18.3334 7.24166C18.3334 13.075 12.9334 16.5167 10.5167 17.3417Z"
            fill="none"
            strokeWidth={1.42}
          />
        </G>
      ) : name === 'ig-plane' ? (
        <G transform="scale(1.16)">
          <Path
            d="M101.077 10.8214L108.274 7.5M100.817 4.31416L108.274 4.25755C111.621 4.23214 112.726 6.41369 110.746 9.10883L106.317 15.1088C103.341 19.145 100.868 18.3415 100.833 13.3268L100.816 11.1133L99.0348 9.79858C94.9987 6.82234 95.7995 4.35752 100.817 4.31416Z"
            fill="none"
            strokeWidth={1.42}
            transform="translate(-93.5 -1.3)"
          />
        </G>
      ) : name === 'ig-repost' ? (
        <G transform="scale(1.16)">
          <Path
            d="M74.0167 4.29999H67.5C66.1167 4.29999 65 5.41665 65 6.79999V11"
            fill="none"
            strokeWidth={1.42}
            transform="translate(-63.3 -0.9)"
          />
          <Path
            d="M72.6333 7.01667L75.2667 4.38333L72.6333 1.75"
            fill="none"
            strokeWidth={1.42}
            transform="translate(-63.3 -0.9)"
          />
          <Path
            d="M70.2333 15.7H76.75C78.1333 15.7 79.25 14.5834 79.25 13.2V9"
            fill="none"
            strokeWidth={1.42}
            transform="translate(-63.3 -0.9)"
          />
          <Path
            d="M71.6167 12.9833L68.9833 15.6167L71.6167 18.25"
            fill="none"
            strokeWidth={1.42}
            transform="translate(-63.3 -0.9)"
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
        <G transform="scale(1.16)">
          <Path
            d="M41 17.5C39.5166 17.5 38.0666 17.0601 36.8332 16.236C35.5999 15.4119 34.6386 14.2406 34.0709 12.8701C33.5032 11.4997 33.3547 9.99168 33.6441 8.53683C33.9335 7.08197 34.6478 5.7456 35.6967 4.6967C36.7456 3.64781 38.082 2.9335 39.5368 2.64411C40.9917 2.35472 42.4997 2.50325 43.8701 3.07091C45.2406 3.63856 46.4119 4.59986 47.236 5.83323C48.0601 7.0666 48.5 8.51664 48.5 10C48.5 11.24 48.2 12.4083 47.6667 13.4392L48.5 17.5L44.4392 16.6667C43.4092 17.1992 42.2392 17.5 41 17.5Z"
            fill="none"
            strokeWidth={1.42}
            transform="translate(-30.7 -0.3)"
          />
        </G>
      ) : name === 'th-heart' ? (
        <G transform="translate(2 2)">
          <Path
            d="M10.5167 17.3417C10.2334 17.4417 9.76669 17.4417 9.48335 17.3417C7.06669 16.5167 1.66669 13.075 1.66669 7.24166C1.66669 4.66666 3.74169 2.58333 6.30002 2.58333C7.81669 2.58333 9.15835 3.31666 10 4.45C10.4282 3.87156 10.9858 3.40143 11.6283 3.07728C12.2709 2.75313 12.9804 2.58396 13.7 2.58333C16.2584 2.58333 18.3334 4.66666 18.3334 7.24166C18.3334 13.075 12.9334 16.5167 10.5167 17.3417Z"
            fill="none"
            strokeWidth={1.5}
          />
        </G>
      ) : name === 'th-comment' ? (
        <G transform="translate(-30 2)">
          <Path
            d="M41 17.5C39.5166 17.5 38.0666 17.0601 36.8332 16.236C35.5999 15.4119 34.6386 14.2406 34.0709 12.8701C33.5032 11.4997 33.3547 9.99168 33.6441 8.53683C33.9335 7.08197 34.6478 5.7456 35.6967 4.6967C36.7456 3.64781 38.082 2.9335 39.5368 2.64411C40.9917 2.35472 42.4997 2.50325 43.8701 3.07091C45.2406 3.63856 46.4119 4.59986 47.236 5.83323C48.0601 7.0666 48.5 8.51664 48.5 10C48.5 11.24 48.2 12.4083 47.6667 13.4392L48.5 17.5L44.4392 16.6667C43.4092 17.1992 42.2392 17.5 41 17.5Z"
            fill="none"
            strokeWidth={1.5}
          />
        </G>
      ) : name === 'th-repost' ? (
        <G transform="translate(-60 2.1)">
          <Path
            d="M79.1776 7.70637C79.3125 8.09802 79.7393 8.30619 80.1309 8.17134C80.5226 8.03648 80.7308 7.60967 80.5959 7.21802L79.8868 7.4622L79.1776 7.70637ZM64.9765 7.42151L65.6843 7.66955C66.041 6.65182 66.6235 5.72807 67.3881 4.9676L66.8592 4.43582L66.3303 3.90405C65.4051 4.82423 64.7003 5.94199 64.2687 7.17347L64.9765 7.42151ZM66.8592 4.43582L67.3881 4.9676C68.1527 4.20713 69.0796 3.62968 70.0993 3.27858L69.8551 2.56944L69.611 1.8603C68.3771 2.28514 67.2556 2.98386 66.3303 3.90405L66.8592 4.43582ZM69.8551 2.56944L70.0993 3.27858C71.8903 2.66188 73.853 2.78192 75.5555 3.6123L75.8843 2.9382L76.213 2.26411C74.153 1.25934 71.7781 1.11409 69.611 1.8603L69.8551 2.56944ZM75.8843 2.9382L75.5555 3.6123C77.258 4.44267 78.5609 5.91535 79.1776 7.70637L79.8868 7.4622L80.5959 7.21802C79.8497 5.05085 78.2731 3.26887 76.213 2.26411L75.8843 2.9382Z"
            fill={color}
            stroke="none"
          />
          <Path
            d="M64.2687 12.8742C64.1317 12.4833 64.3376 12.0554 64.7285 11.9184C65.1194 11.7814 65.5473 11.9873 65.6843 12.3782L64.9765 12.6262L64.2687 12.8742ZM64.9765 12.6262L65.6843 12.3782C66.041 13.3959 66.6235 14.3196 67.3881 15.0801L66.8592 15.6119L66.3303 16.1437C65.4051 15.2235 64.7003 14.1057 64.2687 12.8742L64.9765 12.6262ZM66.8592 15.6119L67.3881 15.0801C68.1527 15.8406 69.0796 16.418 70.0993 16.7691L69.8551 17.4783L69.611 18.1874C68.3771 17.7626 67.2556 17.0639 66.3303 16.1437L66.8592 15.6119ZM69.8551 17.4783L70.0993 16.7691C71.8903 17.3858 73.853 17.2658 75.5555 16.4354L75.8843 17.1095L76.213 17.7836C74.153 18.7884 71.7781 18.9336 69.611 18.1874L69.8551 17.4783ZM75.8843 17.1095L75.5555 16.4354C77.258 15.605 78.5609 14.1324 79.1776 12.3413L79.8868 12.5855L80.5959 12.8297C79.8497 14.9969 78.2731 16.7788 76.213 17.7836L75.8843 17.1095Z"
            fill={color}
            stroke="none"
          />
          <Path d="M63.8621 3.99999V7.72409H67.5862" fill="none" strokeWidth={1.5} />
          <Path d="M80.9167 15.5144L80.6569 11.7994L76.9419 12.0592" fill="none" strokeWidth={1.5} />
        </G>
      ) : name === 'th-send' ? (
        <G transform="translate(-92 2.2)">
          <Path
            d="M98.9136 9.85948L110.549 10.0009M101.636 3.94336L108.306 7.27854C111.3 8.77525 111.294 11.2207 108.306 12.7233L101.636 16.0585C97.1518 18.3035 95.3133 16.465 97.5584 11.9808L98.5483 10.0009L97.5584 8.021C95.3133 3.53677 97.1459 1.70418 101.636 3.94336Z"
            fill="none"
            strokeWidth={1.5}
          />
        </G>
      ) : name === 'x-comment' ? (
        <Path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      ) : name === 'x-retweet' ? (
        <G transform="scale(1.1429)">
          <Path d="m13.5 13.5 3 3 3-3" />
          <Path d="M9.5 4.5h3a4 4 0 0 1 4 4v8m-9-9-3-3-3 3" />
          <Path d="M11.5 16.5h-3a4 4 0 0 1-4-4v-8" />
        </G>
      ) : name === 'x-views' ? (
        <Path d="M4 9v11M8 4v16m4-9v9m4-13v13m4-6v6" />
      ) : name === 'x-bookmark' ? (
        <G transform="translate(1.5 1.5) scale(0.041)">
          <Path
            d="M352 48H160a48 48 0 0 0-48 48v368l144-128 144 128V96a48 48 0 0 0-48-48"
            fill={color}
            stroke="none"
          />
        </G>
      ) : name === 'x-share' ? (
        <G transform="translate(1 4.2) scale(0.8)">
          <Path
            d="M22 18.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0M18.5 20a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3M9 11.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0M5.5 13a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3M22 5.5a3.5 3.5 0 1 0-7 0a3.5 3.5 0 0 0 7 0M18.5 4a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3"
            fill={color}
            stroke="none"
            fillRule="evenodd"
          />
          <Path
            d="M16.617 18.065a1 1 0 0 0-.388-1.36l-8.243-4.58a1 1 0 0 0-.972 1.75l8.244 4.579a1 1 0 0 0 1.36-.389Zm.115-12.168a1 1 0 0 1-.508 1.32l-8.318 3.697a1 1 0 0 1-.812-1.828l8.318-3.697a1 1 0 0 1 1.32.508"
            fill={color}
            stroke="none"
            fillRule="evenodd"
          />
        </G>
      ) : name === 'bsky-comment' ? (
        <G transform="translate(-1.401 -2.77) scale(0.042)">
          <Path
            d="m267.7 576.9-37.8 26.7c-7.3 5.2-16.9 5.8-24.9 1.7S192 593 192 584v-72h-32c-53 0-96-43-96-96V192c0-53 43-96 96-96h320c53 0 96 43 96 96v224c0 53-43 96-96 96H359.6zM332 472.8c8.1-5.7 17.8-8.8 27.7-8.8H480c26.5 0 48-21.5 48-48V192c0-26.5-21.5-48-48-48H160c-26.5 0-48 21.5-48 48v224c0 26.5 21.5 48 48 48h56c10.4 0 19.3 6.6 22.6 15.9c.9 2.5 1.4 5.2 1.4 8.1v49.7c32.7-23.1 63.3-44.7 91.9-64.9z"
            fill={color}
            stroke="none"
          />
        </G>
      ) : name === 'bsky-repost' ? (
        <G transform="translate(-0.542 -0.542) scale(1.194)">
          <Path d="m13.5 13.5 3 3 3-3" />
          <Path d="M9.5 4.5h3a4 4 0 0 1 4 4v8m-9-9-3-3-3 3" />
          <Path d="M11.5 16.5h-3a4 4 0 0 1-4-4v-8" />
        </G>
      ) : name === 'bsky-heart' ? (
        <G transform="translate(-2.252 -2.278) scale(0.056)">
          <Path
            d="M352.92 80C288 80 256 144 256 144s-32-64-96.92-64c-52.76 0-94.54 44.14-95.08 96.81c-1.1 109.33 86.73 187.08 183 252.42a16 16 0 0 0 18 0c96.26-65.34 184.09-143.09 183-252.42c-.54-52.67-42.32-96.81-95.08-96.81"
            fill={color}
            stroke="none"
          />
        </G>
      ) : name === 'bsky-bookmark' ? (
        <G transform="translate(-1.714 -2.178) scale(1.143)">
          <Path
            d="M5 6.09A3.09 3.09 0 0 1 8.09 3h7.82A3.09 3.09 0 0 1 19 6.09v13.697c0 1.336-1.597 2.024-2.568 1.107L12 16.71l-4.432 4.185c-.97.918-2.568.229-2.568-1.107V6.091ZM8.09 5A1.09 1.09 0 0 0 7 6.09v12.59l3.954-3.735a1.523 1.523 0 0 1 2.091 0L17 18.68V6.09A1.09 1.09 0 0 0 15.91 5z"
            fill={color}
            stroke="none"
          />
        </G>
      ) : name === 'bsky-share' ? (
        <G transform="translate(1.25 1.25) scale(0.018)">
          <Path
            d="M754.553 35.03v294.208C487.317 329.246 0 332.178 0 1164.97c55.25-556.9 309.061-560.402 754.553-560.408v321.292L1200 480.407z"
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
