import React, { useEffect } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { CustomName, Match } from '../types';
import { itemLabel, lookupName } from '../lib/names';
import { type, useTheme } from '../theme';
import { Button } from './ui';

/** Stays up until dismissed, so a match is never a one-second blink. */
export default function MatchSheet({
  matches,
  lastName,
  custom,
  onKeepSwiping,
  onSeeList,
}: {
  matches: Match[];
  lastName: string;
  custom: CustomName[];
  onKeepSwiping: () => void;
  onSeeList: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const visible = matches.length > 0;
  const m = matches[matches.length - 1];
  const left = useSharedValue(-60);
  const right = useSharedValue(60);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      left.value = reduce ? -14 : -60;
      right.value = reduce ? 14 : 60;
      fade.value = 0;
      left.value = withSpring(-14, { damping: 12 });
      right.value = withSpring(14, { damping: 12 });
      fade.value = withDelay(150, withTiming(1, { duration: 300 }));
    });
  }, [visible, m?.key]);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: left.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: right.value }] }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!m) return null;
  const label = itemLabel(m.mode, m.itemId, custom);
  const meaning = m.mode === 'combo' ? null : lookupName(m.itemId, custom)?.meaning;
  const more = matches.length - 1;
  const full = m.mode === 'middle' ? null : [label, lastName].filter(Boolean).join(' ');

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onKeepSwiping} statusBarTranslucent>
      <View style={[s.wrap, { backgroundColor: m.bothLove ? t.butter : t.bg, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.avatars} importantForAccessibility="no-hide-descendants">
          <Animated.View style={[s.avatar, { backgroundColor: t.coral }, leftStyle]}>
            <Text style={[type.button, { color: t.onCoral }]}>You</Text>
          </Animated.View>
          <Animated.View style={[s.avatar, { backgroundColor: t.plum }, rightStyle]}>
            <Text style={[type.button, { color: t.onPlum }]}>Them</Text>
          </Animated.View>
        </View>

        <Animated.View style={[s.body, fadeStyle]} accessible accessibilityLiveRegion="assertive">
          <Text style={[type.caption, { color: m.bothLove ? t.goldInk : t.sage, letterSpacing: 1 }]}>
            {m.bothLove ? 'YOU BOTH LOVE IT' : m.mode === 'middle' ? 'MIDDLE NAME MATCH' : m.mode === 'combo' ? 'FULL NAME MATCH' : 'IT’S A MATCH'}
          </Text>
          <Text style={[type.nameModal, { color: m.bothLove ? t.goldInk : t.ink, textAlign: 'center', marginTop: 8 }]} adjustsFontSizeToFit numberOfLines={2}>
            {label}
          </Text>
          {full && full !== label && <Text style={[type.callout, { color: m.bothLove ? t.goldInk : t.muted, marginTop: 6 }]}>{full}</Text>}
          {meaning ? <Text style={[type.meaning, { color: m.bothLove ? t.goldInk : t.ink, marginTop: 12, textAlign: 'center' }]}>“{meaning}”</Text> : null}
          {more > 0 && (
            <Text style={[type.callout, { color: m.bothLove ? t.goldInk : t.muted, marginTop: 20 }]}>
              + {more} more {more === 1 ? 'name' : 'names'} you both said yes to
            </Text>
          )}
        </Animated.View>

        <View style={s.actions}>
          <Button label="Keep swiping" onPress={onKeepSwiping} />
          <Button label="See our list" variant="secondary" onPress={onSeeList} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24 },
  avatars: { flexDirection: 'row', justifyContent: 'center', height: 96 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -6 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 12 },
});
