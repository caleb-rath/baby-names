import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SwipeType } from '../types';
import { font, useTheme } from '../theme';

type Dir = 'left' | 'up' | 'right' | 'down';

/**
 * The four answers laid out as a flattened diamond that matches the swipe directions:
 * Love on top, No on the left, Yes on the right, Maybe underneath.
 */
export default function DirectionPad({ onAnswer, yesColor, disabled }: { onAnswer: (type: SwipeType) => void; yesColor?: string; disabled?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.pad, disabled && { opacity: 0.35 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <Btn dir="left" label="No" bg={t.noBtn} fg={t.ink} icon={<Ionicons name="close" size={22} color={t.ink} />} onPress={() => onAnswer('pass')} />
      <View style={s.middle}>
        <Btn dir="up" label="Love" bg={t.butter} fg={t.goldInk} small icon={<Ionicons name="heart" size={18} color={t.goldInk} />} onPress={() => onAnswer('super')} />
        <Btn dir="down" label="Maybe" bg={t.maybe} fg={t.maybeInk} small icon={<Text style={[s.tilde, { color: t.maybeInk }]}>~</Text>} onPress={() => onAnswer('maybe')} />
      </View>
      <Btn dir="right" label="Yes" bg={yesColor ?? t.sage} fg={t.onYes} wide icon={<Ionicons name="checkmark" size={24} color={t.onYes} />} onPress={() => onAnswer('like')} />
    </View>
  );
}

function Btn({ dir, label, bg, fg, icon, small, wide, onPress }: { dir: Dir; label: string; bg: string; fg: string; icon: React.ReactNode; small?: boolean; wide?: boolean; onPress: () => void }) {
  const h = small ? 46 : 58;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, or swipe ${dir}`}
      style={({ pressed }) => [s.btn, { height: h, flex: small ? undefined : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
    >
      <View style={[s.face, { backgroundColor: bg, borderRadius: h / 2 }]}>
        {icon}
        <Text style={[s.label, { color: fg, fontSize: small ? 14.5 : 16 }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingVertical: 12 },
  middle: { width: 124, gap: 10 },
  btn: { justifyContent: 'center' },
  face: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12 },
  label: { fontFamily: font.bold },
  tilde: { fontFamily: font.heavy, fontSize: 30, lineHeight: 30, marginTop: -6 },
});
