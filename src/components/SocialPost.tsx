import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { Svg, Circle } from 'react-native-svg';
import { useTheme, Palette } from '../theme';
import { ChannelAvatar, FeedVideo } from './ui';

/**
 * A post drawn the way it reads in a feed (web parity with SocialPost.tsx):
 * the account's face on the left rail, name · @handle · time, the text with
 * #tags, @mentions and links picked out, media in the familiar 1 / 2 / 3 /
 * 4-up grid, then the reply / repost / like / views / share bar. Callers
 * pass the state line ("Queued · Tue 9:00"), a badge and any footer actions.
 * `threaded` runs the thread line down the avatar rail to the next part.
 */

/** Strictest caption length per network, same numbers as the web app. */
export const CAPTION_LIMITS: Record<string, number> = {
  instagram: 2200, tiktok: 2200, x: 280, facebook: 63206, youtube: 5000, threads: 500,
  linkedin: 3000, bluesky: 300, mastodon: 500, pinterest: 800, telegram: 1024, discord: 2000,
  wordpress: 100000, devto: 100000, hashnode: 100000, ghost: 100000, vk: 16384, gmb: 1500,
};

/** The tightest limit among the picked networks (2,200 when none picked). */
export function captionLimit(platforms: string[]): number {
  const ls = platforms.map((p) => CAPTION_LIMITS[p]).filter((n): n is number => typeof n === 'number');
  return ls.length ? Math.min(...ls) : 2200;
}

export interface SocialMediaItem { uri: string; kind: 'image' | 'video' }
export interface SocialMetrics { comments: number; reposts: number; likes: number; views: number | null }

/** Social-style compact counts: 950, 1.2K, 3.4M. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

const RICH = /((?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*|#[\p{L}\p{N}_]+|@[\p{L}\p{N}_](?:[\p{L}\p{N}_.]*[\p{L}\p{N}_])?)/giu;

/** Body text with links, #tags and @handles in the link colour. */
export function RichText({ text, style, linkColor, numberOfLines }: {
  text: string;
  style: object;
  linkColor: string;
  numberOfLines?: number;
}) {
  const parts = text.split(RICH);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) => (i % 2 === 1 ? <Text key={i} style={{ color: linkColor }}>{p}</Text> : p))}
    </Text>
  );
}

/** Ring counter like a social compose box: fills, goes amber near the cap, red past it. */
export function RingCounter({ used, limit }: { used: number; limit: number }) {
  const { C } = useTheme();
  const left = limit - used;
  const near = left <= Math.max(20, limit * 0.1);
  const tone = left < 0 ? '#E5484D' : near ? '#F2A400' : C.blueText;
  const r = 9;
  const circ = 2 * Math.PI * r;
  const ratio = Math.min(1, Math.max(0, used / limit));
  if (used === 0) return <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.faint }}>0 / {limit}</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={`${used} of ${limit} characters`}>
      {near ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: left < 0 ? '#E5484D' : C.muted }}>{left}</Text>
      ) : null}
      <Svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={12} cy={12} r={r} stroke={C.line} strokeWidth={2.5} fill="none" />
        <Circle
          cx={12}
          cy={12}
          r={r}
          stroke={tone}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - ratio)}
        />
      </Svg>
    </View>
  );
}

/** Feed media grid: one large, two side by side, three as 1 + 2, four as 2 × 2. */
export function MediaGrid({ media }: { media: SocialMediaItem[] }) {
  const { C } = useTheme();
  const [w, setW] = useState(0);
  const shown = media.slice(0, 4);
  const extra = media.length - shown.length;
  if (!shown.length) return null;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const gap = 2;

  const tile = (m: SocialMediaItem, width: number, height: number, last: boolean) => (
    <View key={m.uri} style={{ width, height, backgroundColor: C.lineSoft, overflow: 'hidden' }}>
      {m.kind === 'video' ? (
        width > 0 ? <FeedVideo uri={m.uri} width={width} radius={0} aspect={width / height} /> : null
      ) : (
        <Image source={{ uri: m.uri }} style={{ width, height }} resizeMode="cover" />
      )}
      {m.kind === 'video' ? (
        <View style={gs.play}><Ionicons name="play" size={11} color="#fff" /></View>
      ) : null}
      {last && extra > 0 ? (
        <View style={gs.more}><Text style={gs.moreT}>+{extra}</Text></View>
      ) : null}
    </View>
  );

  const h = w * 0.62;
  let body: React.ReactNode = null;
  if (w > 0) {
    if (shown.length === 1) body = tile(shown[0], w, w * 0.8, true);
    else if (shown.length === 2) {
      const cw = (w - gap) / 2;
      body = <View style={{ flexDirection: 'row', gap }}>{shown.map((m, i) => tile(m, cw, h, i === 1))}</View>;
    } else if (shown.length === 3) {
      const cw = (w - gap) / 2;
      body = (
        <View style={{ flexDirection: 'row', gap }}>
          {tile(shown[0], cw, h, false)}
          <View style={{ gap }}>{shown.slice(1).map((m, i) => tile(m, cw, (h - gap) / 2, i === 1))}</View>
        </View>
      );
    } else {
      const cw = (w - gap) / 2;
      const ch = (h - gap) / 2;
      body = (
        <View style={{ gap }}>
          <View style={{ flexDirection: 'row', gap }}>{shown.slice(0, 2).map((m) => tile(m, cw, ch, false))}</View>
          <View style={{ flexDirection: 'row', gap }}>{shown.slice(2).map((m, i) => tile(m, cw, ch, i === 1))}</View>
        </View>
      );
    }
  }
  return (
    <View onLayout={onLayout} style={{ marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, minHeight: w ? undefined : 120 }}>
      {body}
    </View>
  );
}

const gs = StyleSheet.create({
  play: { position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  more: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  moreT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: '#fff' },
});

export default function SocialPost({
  author,
  time,
  context,
  badge,
  title,
  body,
  media = [],
  metrics,
  notes,
  footer,
  threaded = false,
  numberOfLines = 6,
  onPress,
  emptyLabel = 'No text',
}: {
  author: { name: string; handle?: string | null; platform: string; avatar?: string };
  time?: string;
  /** Small state line above the name, like a feed's "Pinned" row. */
  context?: { icon: keyof typeof Ionicons.glyphMap; text: string; tone?: 'muted' | 'danger' | 'accent' };
  badge?: React.ReactNode;
  title?: string | null;
  body: string;
  media?: SocialMediaItem[];
  /** Live numbers once sent; omitted, the bar shows bare icons. */
  metrics?: SocialMetrics | null;
  notes?: React.ReactNode;
  footer?: React.ReactNode;
  threaded?: boolean;
  numberOfLines?: number;
  onPress?: () => void;
  emptyLabel?: string;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const toneColor = context?.tone === 'danger' ? C.redText : context?.tone === 'accent' ? C.ink : C.muted;

  const main = (
    <View style={{ flex: 1, minWidth: 0, paddingBottom: threaded ? 14 : 0 }}>
      {context ? (
        <View style={s.context}>
          <Ionicons name={context.icon} size={13} color={toneColor} />
          <Text style={[s.contextT, { color: toneColor }]} numberOfLines={1}>{context.text}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={s.head} numberOfLines={1}>
          <Text style={s.name}>{author.name}</Text>
          {author.handle ? <Text style={s.meta}>  {author.handle}</Text> : null}
          {time ? <Text style={s.meta}> · {time}</Text> : null}
        </Text>
        {badge ?? null}
      </View>
      {title ? <Text style={s.title} numberOfLines={2}>{title}</Text> : null}
      {body ? (
        <RichText text={body} style={s.body} linkColor={C.blueText} numberOfLines={numberOfLines || undefined} />
      ) : !title ? (
        <Text style={s.empty}>{emptyLabel}</Text>
      ) : null}
      {notes ? <View style={{ gap: 6, marginTop: 8 }}>{notes}</View> : null}
      <MediaGrid media={media} />
      {/* Real numbers only: without stats the icons said nothing, so the bar hides. */}
      {metrics ? (
        <View style={s.bar} accessibilityLabel="Engagement">
          <Stat icon="chatbubble-outline" value={metrics.comments} C={C} />
          <Stat icon="repeat" value={metrics.reposts} C={C} />
          <Stat icon="heart-outline" value={metrics.likes} C={C} />
          <Stat icon="stats-chart-outline" value={metrics.views} C={C} />
          <Ionicons name="share-outline" size={17} color={C.muted} />
        </View>
      ) : null}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', gap: 11 }}>
      <View style={{ alignItems: 'center' }}>
        {context ? <View style={{ height: 20 }} /> : null}
        <ChannelAvatar platform={author.platform} avatar={author.avatar} size={42} />
        {threaded ? <View style={s.thread} /> : null}
      </View>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1, minWidth: 0 }}>
          {main}
        </TouchableOpacity>
      ) : main}
    </View>
  );
}

function Stat({ icon, value, C }: { icon: keyof typeof Ionicons.glyphMap; value?: number | null; C: Palette }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={17} color={C.muted} />
      {value != null && value > 0 ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted }}>{compact(value)}</Text>
      ) : null}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  context: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 20 },
  contextT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, flexShrink: 1 },
  head: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  meta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, color: C.muted },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15.5, color: C.ink, marginTop: 3 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 3 },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontStyle: 'italic', fontSize: 13.5, color: C.faint, marginTop: 3 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingRight: 6, maxWidth: 360 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  thread: { width: 2, flex: 1, marginTop: 6, borderRadius: 1, backgroundColor: C.line },
});
