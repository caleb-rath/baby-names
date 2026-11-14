import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import type { DeckItem } from '../lib/deck';
import { checkInitials } from '../lib/initials';
import { GENDER_LABEL, popularityLabel } from '../lib/names';
import { type, useTheme } from '../theme';
import { Chip } from './ui';

export function speakName(text: string) {
  Speech.stop();
  Speech.speak(text, { rate: 0.85 });
}

/** The face of a swipe card. Everything that matters is visible without a "Details" tap. */
export default function NameCard({
  item,
  lastName,
  lockedMiddle,
  partnerAdded,
}: {
  item: DeckItem;
  lastName: string;
  lockedMiddle?: string;
  partnerAdded?: boolean;
}) {
  const t = useTheme();
  const { first, middle, mode } = item;
  const display = mode === 'combo' ? `${first.name} ${middle!.name}` : first.name;

  // What the whole name would look like: middle-name cards show a placeholder first name.
  const full =
    mode === 'first'
      ? [first.name, lockedMiddle, lastName].filter(Boolean).join(' ')
      : mode === 'middle'
        ? ['…', first.name, lastName].filter(Boolean).join(' ')
        : [first.name, middle!.name, lastName].filter(Boolean).join(' ');
  const { initials, warning } =
    mode === 'combo' ? checkInitials(first.name, middle!.name, lastName) : mode === 'first' ? checkInitials(first.name, lockedMiddle, lastName) : { initials: '', warning: null };
  const pop = mode !== 'combo' ? popularityLabel(first.rank) : null;
  const showFull = full !== display;

  return (
    <View
      style={[s.card, { backgroundColor: t.surface, borderColor: t.line, shadowColor: t.shadow }]}
      accessible
      accessibilityLabel={[
        display,
        mode !== 'combo' && GENDER_LABEL[first.gender],
        mode !== 'combo' && first.meaning && `Means ${first.meaning}`,
        showFull && `Full name ${full}`,
        warning,
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint="Swipe right for yes, left for no, up for love, or use the buttons below"
    >
      <View style={[s.edge, { backgroundColor: t.tintInk[mode] }]} />
      <View style={s.top}>
        {mode !== 'combo' && <Chip label={GENDER_LABEL[first.gender]} bg={t.tint[mode]} fg={t.tintInk[mode]} />}
        {pop && <Chip label={pop} />}
        {partnerAdded && <Chip label="Added by your partner" bg={t.butter} fg={t.goldInk} />}
      </View>

      <View style={s.center}>
        <Text style={[type.nameCard, { color: t.ink }, display.length > 9 && { fontSize: 44, lineHeight: 52 }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.2}>
          {display}
        </Text>
        {showFull && (
          <Text style={[type.callout, { color: t.muted, marginTop: 6 }]} maxFontSizeMultiplier={1.5}>
            {full}
          </Text>
        )}
        {mode === 'combo' ? (
          <Text style={[type.meaning, { color: t.ink, marginTop: 16 }]} maxFontSizeMultiplier={1.4}>
            {[first.meaning, middle!.meaning].filter(Boolean).map((m) => `“${m}”`).join(' + ')}
          </Text>
        ) : first.meaning ? (
          <Text style={[type.meaning, { color: t.ink, marginTop: 16 }]} maxFontSizeMultiplier={1.4}>
            “{first.meaning}”
          </Text>
        ) : null}
      </View>

      <View style={s.bottom}>
        <View style={s.chips}>
          {mode !== 'combo' && first.origin ? <Chip label={first.origin} /> : null}
          {mode !== 'combo' && first.syllables ? <Chip label={`${first.syllables} syllable${first.syllables === 1 ? '' : 's'}`} /> : null}
          {initials.length >= 2 && <Chip label={warning ?? `Initials ${initials}`} bg={warning ? t.amber : undefined} fg={warning ? t.amberInk : undefined} />}
        </View>
        <Pressable
          onPress={() => speakName(mode === 'first' ? full : display)}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${display} said aloud`}
          hitSlop={8}
          style={[s.hear, { borderColor: t.line }]}
        >
          <Ionicons name="volume-medium-outline" size={22} color={t.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 24,
    paddingTop: 28,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  top: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  center: { flex: 1, justifyContent: 'center', paddingBottom: '8%' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hear: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
