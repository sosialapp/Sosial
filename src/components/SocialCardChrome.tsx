import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import FontAwesome from '@expo/vector-icons/build/FontAwesome';
import { PostPage } from '../types';
import { F, FontId } from '../utils/fonts';
import { SocialGlyph, ActionIcon, VERIFIED_SEAL } from './ui';

interface ChromeProps {
  page: PostPage;
  pad: (v: number) => number;
  /** when true the card hugs its content (auto height) instead of filling the canvas */
  fit?: boolean;
  /** hard ceiling for the auto height — content scales down rather than clipping */
  maxH?: number;
  /** render the "made with Sosial" badge (free-plan watermark) */
  watermark?: boolean;
  children: React.ReactNode;
}

function useChrome(page: PostPage) {
  const firstHandle = page.socials.find((s) => s.visible && s.handle)?.handle || '@yourhandle';
  const uni = page.pfp.username?.trim();
  const name = uni || firstHandle.replace(/^@/, '');
  return { firstHandle, name };
}

function Avatar({ page, pad, size }: { page: PostPage; pad: (v: number) => number; size: number }) {
  const d = pad(size);
  if (page.pfp.uri) {
    return <Image source={{ uri: page.pfp.uri }} style={{ width: d, height: d, borderRadius: d / 2 }} />;
  }
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: d * 0.38 }}>Y</Text>
    </View>
  );
}

/** In-card attribution badge: "made with (logo) Sosial", sized/colored to blend into the chrome. */
function Watermark({ font, pad, size, color }: { font: FontId; pad: (v: number) => number; size: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(2), flexShrink: 0 }}>
      <Text style={{ ...F(font), fontSize: pad(size), color }}>made with</Text>
      <Image source={require('../../assets/watermark.png')} style={{ width: pad(size + 1), height: pad(size + 1), borderRadius: pad(2) }} />
      <Text style={{ ...F(font, true), fontSize: pad(size), color }}>Sosial</Text>
    </View>
  );
}

/** Luminance check — dark cards get light chrome ink, light cards get dark. */
function isDarkHex(hex: string): boolean {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

/** Auto-fit: measures available body height vs natural content height and
 * scales content down (min 45%) so nothing ever clips out of the fixed card. */
function AutoFit({ style, children, fit, maxH }: { style: any; children: React.ReactNode; fit?: boolean; maxH?: number }) {
  const [avail, setAvail] = useState(0);
  const [natural, setNatural] = useState(0);
  const ratio = avail > 0 && natural > avail + 1 ? Math.max(0.45, avail / natural) : 1;
  const onOuter = (e: any) => {
    const h = e.nativeEvent.layout.height;
    setAvail((p) => (Math.abs(p - h) > 1 ? h : p));
  };
  const onInner = (e: any) => {
    const h = e.nativeEvent.layout.height;
    setNatural((p) => (Math.abs(p - h) > 1 ? h : p));
  };
  const base = fit
    ? { ...style, flex: undefined, minHeight: undefined, flexShrink: 1, maxHeight: maxH, overflow: 'hidden' as const }
    : style;
  return (
    <View onLayout={onOuter} style={[base, ratio < 1 ? { height: Math.max(1, Math.round(natural * ratio)), overflow: 'hidden' } : null]}>
      <View
        onLayout={onInner}
        style={
          ratio < 1
            ? { width: '100%', transform: [{ scale: ratio }], transformOrigin: ['50%', '0%', 0] as any }
            : { width: '100%' }
        }
      >
        {children}
      </View>
    </View>
  );
}

/** Platform-authentic card templates wrapping the content blocks. */
export default function SocialCardChrome({ page, pad, fit, maxH, watermark, children }: ChromeProps) {
  const style = page.cardStyle ?? 'minimal';
  const cardBg = page.cardColor ?? '#FFFFFFF2';
  const { firstHandle, name } = useChrome(page);
  const font = page.font ?? 'inter';
  const dark = isDarkHex(cardBg);
  const ink = dark ? '#FFFFFF' : '#111111';
  const gray = dark ? '#CFC9BD' : '#65676B';
  const faint = dark ? '#A8A29E' : '#B0B3B8';
  const hairline = dark ? '#FFFFFF24' : '#11111114';
  const showCheck = page.verified ?? true;
  const sealed = page.cardStyle === 'facebook' || page.cardStyle === 'instagram' || page.cardStyle === 'threads';
  const check = (size: number) => {
    if (!showCheck) return null;
    if (!sealed) return <Ionicons name="checkmark-circle" size={pad(size)} color="#1D9BF0" />;
    return (
      <Svg width={pad(size)} height={pad(size)} viewBox="0 0 24 24">
        <Path d={VERIFIED_SEAL} fill="#1D9BF0" />
        <Path d="m8 12.5 2.5 2.5L16 9.5" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };
  const rootFlex = fit
    ? { flexShrink: 1 as const, maxHeight: maxH, overflow: 'hidden' as const }
    : { flex: 1 as const, minHeight: 0 as const };

  const bodyPad = pad(13);
  const body = (topExtra: boolean, bottomExtra: boolean) => ({
    padding: bodyPad,
    paddingTop: topExtra ? pad(8) : bodyPad,
    paddingBottom: bottomExtra ? pad(8) : bodyPad,
    gap: pad(10),
    ...rootFlex,
  });

  if (style === 'facebook') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(8), borderWidth: pad(1), borderColor: '#11111112', overflow: 'hidden' }}>
        {/* author header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(12), paddingTop: pad(10) }}>
          <Avatar page={page} pad={pad} size={24} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(4) }}>
              <Text style={{ ...F(font, true), fontSize: pad(9.5), color: ink, flexShrink: 1 }} numberOfLines={1}>{name}</Text>
              {check(9)}
              {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ ...F(font), fontSize: pad(7.5), color: gray }}>2h · Public</Text>
              <Ionicons name="globe-outline" size={pad(8)} color={gray} />
            </View>
          </View>
          <Ionicons name="ellipsis-horizontal" size={pad(12)} color={gray} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        {/* stats */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad(12), paddingBottom: pad(7) }}>
          <View style={{ width: pad(15), height: pad(15), borderRadius: pad(7.5), backgroundColor: '#1877F2', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="thumbs-up" size={pad(9)} color="#fff" />
          </View>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray, marginLeft: 5 }}>1.2K</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray }}>48 comments · 12 shares</Text>
        </View>
        {/* actions */}
        <View style={{ borderTopWidth: pad(1), borderTopColor: hairline, flexDirection: 'row', paddingVertical: pad(7) }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ActionIcon name="fb-like" size={pad(12)} color={gray} />
            <Text style={{ ...F(font), fontSize: pad(9), color: gray }}>Like</Text>
          </View>
          {[
            { icon: 'fb-comment', label: 'Comment' },
            { icon: 'fb-share', label: 'Share' },
          ].map((a) => (
            <View key={a.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <ActionIcon name={a.icon as 'fb-comment' | 'fb-share'} size={pad(12)} color={gray} />
              <Text style={{ ...F(font), fontSize: pad(9), color: gray }}>{a.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (style === 'x') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(14), borderWidth: pad(1), borderColor: hairline, overflow: 'hidden' }}>
        {/* author header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(13), paddingTop: pad(11) }}>
          <Avatar page={page} pad={pad} size={22} />
          <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>
            {name} {check(9)}
          </Text>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray, flexShrink: 1 }} numberOfLines={1}>
            {firstHandle} · 2h
          </Text>
          {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
          <View style={{ flex: 1 }} />
          <Ionicons name="ellipsis-horizontal" size={pad(11)} color={gray} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad(14), paddingBottom: pad(10), gap: pad(4) }}>
          {[
            { custom: 'x-comment' as const, count: '12', color: gray },
            { custom: 'x-retweet' as const, count: '48', color: '#22C55E' },
            { custom: 'ig-heart' as const, count: '312', color: '#EC4899' },
            { custom: 'x-views' as const, count: '2.1K', color: gray },
          ].map((a, i) => (
            <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <ActionIcon name={a.custom} size={pad(13)} color={a.color} />
              <Text style={{ ...F(font), fontSize: pad(8), color: gray }}>{a.count}</Text>
            </View>
          ))}
          <ActionIcon name="x-bookmark" size={pad(13)} color={gray} />
          <View style={{ width: pad(6) }} />
          <ActionIcon name="x-share" size={pad(13)} color={gray} />
        </View>
      </View>
    );
  }

  if (style === 'instagram') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(6), borderWidth: pad(1), borderColor: '#11111112', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(12), paddingTop: pad(10) }}>
          <Avatar page={page} pad={pad} size={20} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(4), flex: 1 }}>
            <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>{name}</Text>
            {check(9)}
            {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
          </View>
          <View style={{ flex: 1 }} />
          <SocialGlyph platform="instagram" size={pad(11)} color="#E1306C" />
          <Ionicons name="ellipsis-horizontal" size={pad(12)} color={ink} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        <View style={{ paddingHorizontal: pad(12), paddingBottom: pad(11), gap: pad(6) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(10) }}>
            <ActionIcon name="ig-heart" size={pad(14)} color={ink} />
            <ActionIcon name="ig-comment" size={pad(14)} color={ink} />
            <ActionIcon name="ig-repost" size={pad(14)} color={ink} />
            <ActionIcon name="ig-plane" size={pad(14)} color={ink} />
            <View style={{ flex: 1 }} />
            <ActionIcon name="ig-bookmark" size={pad(14)} color={ink} />
          </View>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: ink }}>
            <Text style={{ ...F(font, true) }}>Liked by you</Text> and 1,234 others
          </Text>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray }}>View all 48 comments</Text>
        </View>
      </View>
    );
  }

  if (style === 'threads') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(14), borderWidth: pad(1), borderColor: hairline, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(13), paddingTop: pad(11) }}>
          <Avatar page={page} pad={pad} size={20} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(3), flexShrink: 1, minWidth: 0 }}>
            <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>
              {firstHandle}
            </Text>
            {check(8)}
          </View>
          <Text style={{ ...F(font), fontSize: pad(8), color: faint }}>· 2h</Text>
          {watermark ? <Watermark font={font} pad={pad} size={8} color={faint} /> : null}
          <View style={{ flex: 1 }} />
          <SocialGlyph platform="threads" size={pad(12)} color={ink} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        <View style={{ paddingHorizontal: pad(13), paddingBottom: pad(11), gap: pad(6) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(11) }}>
            <ActionIcon name="ig-heart" size={pad(14)} color={ink} />
            <ActionIcon name="ig-comment" size={pad(14)} color={ink} />
            <ActionIcon name="th-repost" size={pad(14)} color={ink} />
            <ActionIcon name="th-send" size={pad(14)} color={ink} />
          </View>
          <Text style={{ ...F(font), fontSize: pad(8), color: faint }}>12 replies</Text>
        </View>
      </View>
    );
  }

  if (style === 'bluesky') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(14), borderWidth: pad(1), borderColor: hairline, overflow: 'hidden' }}>
        {/* author header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: pad(7), paddingHorizontal: pad(13), paddingTop: pad(11) }}>
          <Avatar page={page} pad={pad} size={22} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(4) }}>
              <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>{name} {check(9)}</Text>
              {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
            </View>
            <Text style={{ ...F(font), fontSize: pad(8), color: gray }} numberOfLines={1}>{firstHandle} · 2h</Text>
          </View>
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        {/* reply · repost · like · save · share · more — like the app */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad(14), paddingBottom: pad(10), gap: pad(4) }}>
          {[
            { custom: 'bsky-comment' as const, count: '12', color: gray },
            { custom: 'bsky-repost' as const, count: '48', color: '#2E9E53' },
            { custom: 'bsky-heart' as const, count: '312', color: '#EC245E' },
            { custom: 'bsky-bookmark' as const, count: '', color: gray },
            { custom: 'bsky-share' as const, count: '', color: gray },
            { icon: 'ellipsis-horizontal', count: '', color: gray },
          ].map((a, i) => (
            <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {'custom' in a && a.custom ? (
                <ActionIcon name={a.custom} size={pad(14)} color={a.color} />
              ) : (
                <Ionicons name={(a as { icon: string }).icon as any} size={pad(14)} color={a.color} />
              )}
              {a.count ? <Text style={{ ...F(font), fontSize: pad(8), color: gray }}>{a.count}</Text> : null}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // minimal
  return (
    <View style={{ flex: fit ? undefined : 1, flexShrink: fit ? 1 : 0 }}>
      <AutoFit fit={fit} maxH={maxH} style={{ flex: 1, gap: pad(10), backgroundColor: cardBg, borderRadius: pad(14), padding: pad(13), borderWidth: pad(1), borderColor: '#11111112' }}>
        {children}
      </AutoFit>
      {watermark ? (
        <View style={{ position: 'absolute', right: pad(13), bottom: pad(13) }}>
          <Watermark font={font} pad={pad} size={8} color={gray} />
        </View>
      ) : null}
    </View>
  );
}
