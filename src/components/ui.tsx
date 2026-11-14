import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { font, type, useTheme } from '../theme';

/** Content never gets wider than this, so the unfolded Fold and desktop browsers don't stretch it. */
export const MAX_WIDTH = 560;

export function Screen({
  children,
  scroll,
  bg,
  edges = ['top'],
  style,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  bg?: string;
  edges?: ('top' | 'bottom')[];
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 };
  const inner = [s.inner, style];
  return (
    <View style={[s.screen, { backgroundColor: bg ?? t.bg }, pad]}>
      {scroll ? (
        <ScrollView style={s.noSideScroll} contentContainerStyle={[s.scrollContent]} keyboardShouldPersistTaps="handled">
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }]}>{children}</View>
      )}
      {footer && <View style={[s.inner, s.footer]}>{footer}</View>}
    </View>
  );
}

/** Back button, centered title, optional right-side control. */
export function TopBar({ title, back = 'Back', onBack, right }: { title?: string; back?: string | null; onBack?: () => void; right?: React.ReactNode }) {
  const t = useTheme();
  const nav = useNavigation();
  return (
    <View style={s.topBar}>
      <View style={s.topSide}>
        {back !== null && (
          <Pressable
            onPress={onBack ?? (() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main' as never)))}
            accessibilityRole="button"
            accessibilityLabel={back}
            hitSlop={10}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color={t.muted} />
            <Text style={[type.callout, { color: t.muted }]} numberOfLines={1}>
              {back}
            </Text>
          </Pressable>
        )}
      </View>
      {title ? (
        <Text style={[type.button, s.topTitle, { color: t.ink }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={{ flex: 2 }} />
      )}
      <View style={[s.topSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const t = useTheme();
  const bg = { primary: t.coral, dark: t.strong, secondary: t.surface, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = { primary: t.onCoral, dark: t.onStrong, secondary: t.ink, ghost: t.ink, danger: t.coral }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, borderColor: 'transparent', opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />}
          <Text style={[type.button, small && { fontSize: 14 }, { color: fg }]} maxFontSizeMultiplier={1.4}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [s.iconBtn, { backgroundColor: t.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={t.ink} />
      {badge && <View style={[s.dot, { backgroundColor: t.coral, borderColor: t.bg }]} />}
    </Pressable>
  );
}

/** Rounded pills that pick one option, like Recent / A–Z / Girls. */
export function Pills<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const t = useTheme();
  return (
    <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={s.pills}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.pill, { backgroundColor: on ? t.ink : t.surfaceAlt }]}
          >
            <Text style={[type.callout, { fontFamily: font.semibold, color: on ? t.bg : t.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Equal-width segments, for small fixed choices like Girl / Boy / Either. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[s.seg, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: t.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }]}
          >
            <Text style={{ fontFamily: on ? font.bold : font.medium, fontSize: 15, color: on ? t.ink : t.muted }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.caption, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        accessibilityLabel={label}
        {...props}
        style={[s.input, { backgroundColor: t.surface, borderColor: t.line, color: t.ink }, props.style]}
      />
      {hint && <Text style={[type.caption, { color: t.muted, fontFamily: font.regular }]}>{hint}</Text>}
    </View>
  );
}

/** Two overlapping initials, you and your partner. */
export function Avatars({ me, partner, size = 30 }: { me: string; partner: string; size?: number }) {
  const t = useTheme();
  const one = (n: string, bg: string, fg: string, i: number) => (
    <View key={i} style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: t.bg, marginLeft: i ? -size / 4 : 0 }]}>
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.42, color: fg }}>{(n || '?').slice(0, 1).toUpperCase()}</Text>
    </View>
  );
  return <View style={s.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{[one(me, t.coral, t.onCoral, 0), one(partner, t.plum, t.onPlum, 1)]}</View>;
}

/** Bottom sheet with a scrim. Tap outside to close. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.sheetWrap} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 20 }]}>{children}</View>
      </View>
    </Modal>
  );
}

/** A short message that slides up and fades out. Pass a new key to show it again. */
export function Toast({ message, id, top }: { message: string | null; id: number; top?: number }) {
  const t = useTheme();
  const op = useRef(new Animated.Value(0)).current;
  const [text, setText] = useState(message);
  useEffect(() => {
    if (!message) return;
    setText(message);
    op.setValue(0);
    Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(op, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [id]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[s.toast, top !== undefined && { top, bottom: 'auto' as any }, { backgroundColor: t.strong, opacity: op, transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}
    >
      <Text style={[type.callout, { color: t.onStrong, fontFamily: font.semibold }]}>{text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_WIDTH, paddingHorizontal: 20 },
  scrollContent: { alignItems: 'center', paddingBottom: 40 },
  noSideScroll: { width: '100%', ...(Platform.OS === 'web' ? ({ overflowX: 'hidden' } as any) : null) },
  footer: { paddingTop: 8, paddingBottom: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 8 },
  topSide: { flex: 1, minWidth: 0 },
  topTitle: { flex: 2, textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, alignSelf: 'flex-start' },
  btn: { minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnSmall: { minHeight: 40, borderRadius: 999, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  pills: { gap: 8, paddingVertical: 4 },
  pill: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontFamily: font.medium, fontSize: 17 },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: MAX_WIDTH, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
});
