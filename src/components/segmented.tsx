import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Track container (background, radius, padding). */
  trackStyle?: StyleProp<ViewStyle>;
  /** Sliding thumb behind the active tab. */
  thumbStyle?: StyleProp<ViewStyle>;
  /** Each tab pressable (layout, padding — no background; the thumb paints it). */
  tabStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  activeLabelStyle?: StyleProp<TextStyle>;
  /** Full control over a tab's content (glyphs, counts). Receives active state. */
  renderOption?: (o: SegmentedOption<T>, active: boolean) => React.ReactNode;
  /** Horizontal scroll when options overflow narrow screens. */
  scrollable?: boolean;
  /** Stretch the track full-width (default shrinks to content). */
  grow?: boolean;
  accessibilityLabel?: string;
  duration?: number;
};

type Layout = { x: number; y: number; width: number; height: number };

/**
 * Animated segmented control — one sliding thumb glides to the active pill
 * on every switch (Post/Queue/Sent tabs, billing rhythm, analytics ranges,
 * AI draft channels, …). Measurement-driven: each tab reports its layout,
 * an Animated.Value pair tweens translateX/width to the active tab.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  trackStyle,
  thumbStyle,
  tabStyle,
  labelStyle,
  activeLabelStyle,
  renderOption,
  scrollable = false,
  grow = false,
  accessibilityLabel,
  duration = 220,
}: Props<T>) {
  const layouts = useRef<Record<string, Layout>>({});
  const [tick, setTick] = useState(0);
  const [thumbH, setThumbH] = useState(0);
  const [thumbY, setThumbY] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const shown = useRef(false);
  const scroller = useRef<ScrollView>(null);
  // Identity-stable option key — inline option literals get a fresh identity
  // every render, so never depend on the array itself.
  const optionKey = options.map((o) => o.value).join('|');

  useEffect(() => {
    const t = layouts.current[value];
    if (!t) {
      shown.current = false;
      return;
    }
    setThumbH(t.height);
    setThumbY(t.y);
    const d = shown.current ? duration : 0;
    shown.current = true;
    Animated.parallel([
      Animated.timing(x, { toValue: t.x, duration: d, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(w, { toValue: t.width, duration: d, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    if (scrollable) scroller.current?.scrollTo({ x: Math.max(0, t.x - 24), animated: d > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tick, optionKey]);

  const onTabLayout = (key: string) => (e: { nativeEvent: { layout: Layout } }) => {
    const l = e.nativeEvent.layout;
    const prev = layouts.current[key];
    if (prev && prev.x === l.x && prev.y === l.y && prev.width === l.width && prev.height === l.height) return;
    layouts.current[key] = { ...l };
    setTick((t) => t + 1);
  };

  const body = (
    <View style={[{ flexDirection: 'row', position: 'relative' }, trackStyle]}>
      {shown.current ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: thumbY, height: thumbH, transform: [{ translateX: x }], width: w }, thumbStyle]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            onLayout={onTabLayout(o.value)}
            style={tabStyle}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
          >
            {renderOption ? (
              renderOption(o, active)
            ) : (
              <Text style={[labelStyle, active && activeLabelStyle]} numberOfLines={1}>
                {o.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (!scrollable) {
    return (
      <View
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        style={grow ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }}
      >
        {body}
      </View>
    );
  }
  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </ScrollView>
  );
}
