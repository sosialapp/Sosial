import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme, Palette, R } from '../theme';

/** shadcn-flavoured primitives for React Native, on the app's theme tokens.
 *  Mirrors the web kit (Card / Table / Badge / Tabs) so both surfaces read
 *  the same. All colours come from useTheme() — never module scope. */

type Align = 'left' | 'right' | 'center';

export function Card({
  children,
  style,
  padded = true,
  ...rest
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
} & Omit<React.ComponentProps<typeof View>, 'style'>) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={[s.card, padded && s.cardPad, style]} {...rest}>
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const s = makeS(C);
  return <View style={[s.cardHeader, style]}>{children}</View>;
}

export function CardTitle({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const s = makeS(C);
  return <Text style={[s.cardTitle, style]}>{children}</Text>;
}

export function CardDescription({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const s = makeS(C);
  return <Text style={[s.cardDesc, style]}>{children}</Text>;
}

export function CardContent({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const s = makeS(C);
  return <View style={[s.cardContent, style]}>{children}</View>;
}

/** Badge — tonal pill. Mirrors the web badge variants. */
export function Badge({
  children,
  variant = 'default',
  style,
}: {
  children?: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'danger' | 'outline';
  style?: StyleProp<ViewStyle>;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const tone = {
    default: { bg: C.surface, fg: C.soft },
    accent: { bg: C.accentSoft, fg: C.accentInk },
    success: { bg: C.paleGreen, fg: C.greenText },
    danger: { bg: C.paleRed, fg: C.redText },
    outline: { bg: 'transparent', fg: C.muted },
  }[variant];
  return (
    <View style={[s.badge, { backgroundColor: tone.bg }, variant === 'outline' && s.badgeOutline, style]}>
      <Text style={[s.badgeT, { color: tone.fg }]}>{children}</Text>
    </View>
  );
}

/** Tabs — pill segmented control (ink-filled active tab), web parity. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={[s.tabs, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.tab, on && s.tabOn]}
            activeOpacity={0.8}
          >
            <Text style={[s.tabT, on && s.tabTOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ---- Table (plain, flexbox-based) ---------------------------------------- */

export function Table({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const s = makeS(C);
  return <View style={[s.table, style]}>{children}</View>;
}

export function TableHeader({ children }: { children?: React.ReactNode }) {
  const { C } = useTheme();
  const s = makeS(C);
  return <View style={s.thead}>{children}</View>;
}

export function TableBody({ children }: { children?: React.ReactNode }) {
  return <View>{children}</View>;
}

export function TableRow({
  children,
  last,
  onPress,
  style,
}: {
  children?: React.ReactNode;
  last?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const content = <View style={[s.tr, last && s.trLast, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

function cellText(children: React.ReactNode, align: Align, C: Palette) {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.soft, textAlign: align }}>
        {children}
      </Text>
    );
  }
  return children;
}

export function TableHead({
  children,
  flex = 1,
  align = 'left',
  style,
}: {
  children?: React.ReactNode;
  flex?: number;
  align?: Align;
  style?: StyleProp<ViewStyle>;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={[{ flex, alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }, style]}>
      <Text style={[s.th, { textAlign: align }]}>{children}</Text>
    </View>
  );
}

export function TableCell({
  children,
  flex = 1,
  align = 'left',
  style,
}: {
  children?: React.ReactNode;
  flex?: number;
  align?: Align;
  style?: StyleProp<ViewStyle>;
}) {
  const { C } = useTheme();
  return (
    <View style={[{ flex, alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }, style]}>
      {cellText(children, align, C)}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft },
  cardPad: { padding: 16 },
  cardHeader: { gap: 4 },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  cardDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: C.muted },
  cardContent: { marginTop: 12 },

  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeOutline: { borderWidth: 1, borderColor: C.line },
  badgeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.1 },

  tabs: { flexDirection: 'row', gap: 4, backgroundColor: C.surface, borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  tabOn: { backgroundColor: C.ink },
  tabT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted },
  tabTOn: { color: C.onInk },

  table: { borderWidth: 1, borderColor: C.lineSoft, borderRadius: R.md, overflow: 'hidden' },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.lineSoft,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.lineSoft,
  },
  trLast: { borderBottomWidth: 0 },
  th: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.faint },
});
