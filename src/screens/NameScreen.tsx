import React, { useState } from 'react';
import { isAlmostPair, isMatchPair } from '../types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { useStore } from '../store/useStore';
import { usePartnerName } from '../store/hooks';
import { altsLine, eraLine, lookupName } from '../lib/names';
import { checkInitials } from '../lib/initials';
import { Button, Screen, Segmented, Sheet, TopBar } from '../components/ui';
import { font, type, useTheme } from '../theme';
import type { Gender, SwipeType } from '../types';
import FitName from '../components/FitName';


export default function NameScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const { itemId } = useRoute<any>().params as { itemId: string };
  const custom = useStore((s) => s.custom);
  const name = lookupName(itemId, custom);
  const my = useStore((s) => s.mine[itemId]);
  const their = useStore((s) => s.partner[itemId]);
  const tag = useStore((s) => s.tags[itemId]);
  const lastName = useStore((s) => s.session?.lastName ?? '');
  const setTag = useStore((s) => s.setTag);
  const setAnswer = useStore((s) => s.setAnswer);
  const partnerName = usePartnerName();
  const [confirm, setConfirm] = useState(false);

  if (!name) {
    return (
      <Screen>
        <TopBar back="Back" />
        <Text style={[type.body, { color: t.muted }]}>This name isn’t in the list anymore.</Text>
      </Screen>
    );
  }

  const matched = isMatchPair(my?.type, their?.type);
  const almost = isAlmostPair(my?.type, their?.type);
  const almostLine =
    my?.type === 'maybe' && their?.type === 'maybe'
      ? 'You both said maybe. A love from either of you adds it to Our names.'
      : my?.type === 'maybe'
        ? `${partnerName} said yes, you said maybe. Say yes or love to add it to Our names.`
        : `You said yes, ${partnerName} said maybe. Change yours to Love to add it now.`;
  const gender: Gender = tag ?? name.gender;
  const { initials, warning } = checkInitials(name.name, lastName);
  const meta = [name.custom ? 'Added by you two' : name.origin, name.rank ? `#${name.rank} in 2024` : null, name.custom ? null : eraLine(name)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <TopBar back={matched ? 'Our names' : 'Back'} />
      <View style={{ marginTop: 16, alignSelf: 'stretch' }}>
        <FitName size={type.nameHero.fontSize} min={28} style={[type.nameHero, { color: t.ink }]} accessibilityRole="header">
          {name.name}
        </FitName>
      </View>
      {name.meaning ? (
        <Text style={[type.meaning, { color: t.ink, fontSize: 22, lineHeight: 30 }]}>“{name.meaning}”</Text>
      ) : null}
      {!!altsLine(name) && <Text style={[type.callout, { color: t.muted, marginTop: 4 }]}>{altsLine(name)}</Text>}
      <View style={s.metaRow}>
        <Text style={[type.callout, { color: t.muted, flexShrink: 1 }]}>{meta}</Text>
        <Pressable
          onPress={() => Speech.speak(name.name, { language: 'en-US', rate: 0.9 })}
          accessibilityRole="button"
          accessibilityLabel={`Say ${name.name} out loud`}
          hitSlop={8}
          style={[s.say, { backgroundColor: t.surfaceAlt }]}
        >
          <Ionicons name="volume-medium-outline" size={16} color={t.ink} />
          <Text style={[type.caption, { color: t.ink }]}>Say it</Text>
        </Pressable>
      </View>

      {!!lastName && (
        <Text style={[type.body, { color: t.ink, marginTop: 16 }]}>
          {name.name} {lastName} · <Text style={{ color: warning ? t.coral : t.muted }}>{warning ?? initials.split('').join('.') + '.'}</Text>
        </Text>
      )}

      {matched && (my!.type === 'super' || their!.type === 'super') && (
        <Text style={[type.callout, { color: t.goldInk, fontFamily: font.semibold, marginTop: 12 }]}>
          ★ {my!.type === 'super' && their!.type === 'super' ? 'You both love it' : my!.type === 'super' ? 'You love it' : `${partnerName} loves it`}
        </Text>
      )}

      {matched && my!.type === 'maybe' && (
        <View style={[s.maybe, { backgroundColor: t.surfaceAlt }]}>
          <Text style={[type.callout, { color: t.ink, flex: 1 }]}>You said maybe. {partnerName}’s love put it on the list.</Text>
          <Button label="Make it a yes" variant="secondary" onPress={() => setAnswer(itemId, 'like')} />
        </View>
      )}

      {matched && (
        <View style={{ marginTop: 24, gap: 10 }}>
          <Text style={[type.section, { color: t.ink }]}>Girl, boy or either</Text>
          <Segmented<Gender>
            label="Girl, boy or either"
            value={gender}
            onChange={(g) => setTag(itemId, g)}
            options={[
              { value: 'F', label: 'Girl' },
              { value: 'M', label: 'Boy' },
              { value: 'N', label: 'Either' },
            ]}
          />
        </View>
      )}

      {almost && (
        <View style={[s.almost, { backgroundColor: t.surfaceAlt }]}>
          <Text style={[type.overline, { color: t.coral }]}>ALMOST</Text>
          <Text style={[type.callout, { color: t.ink }]}>{almostLine}</Text>
        </View>
      )}

      {!matched && (
        <View style={{ marginTop: 24, gap: 10 }}>
          <Text style={[type.section, { color: t.ink }]}>Your answer</Text>
          <Segmented<SwipeType | 'none'>
            label="Your answer"
            value={my?.type ?? 'none'}
            onChange={(v) => setAnswer(itemId, v === 'none' ? null : v)}
            options={[
              { value: 'pass', label: 'No' },
              { value: 'maybe', label: 'Maybe' },
              { value: 'like', label: 'Yes' },
              { value: 'super', label: 'Love' },
            ]}
          />
        </View>
      )}

      {matched && (
        <Pressable onPress={() => setConfirm(true)} accessibilityRole="button" style={s.remove}>
          <Text style={[type.button, { color: t.muted }]}>Take {name.name} off our list</Text>
        </Pressable>
      )}

      <Sheet visible={confirm} onClose={() => setConfirm(false)}>
        <Text style={[type.title, { color: t.ink }]}>Take {name.name} off?</Text>
        <Text style={[type.body, { color: t.muted }]}>
          {their?.type === 'super' ? `${partnerName} loves this one. ` : ''}It leaves Our names for both of you.
        </Text>
        <Button
          label="Take it off"
          variant="primary"
          onPress={() => {
            setAnswer(itemId, 'pass');
            setConfirm(false);
            nav.goBack();
          }}
        />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  say: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 18 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 4, marginTop: 24 },
  answers: { flexDirection: 'row', gap: 12, marginTop: 24 },
  answer: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 16, alignItems: 'center', gap: 4 },
  maybe: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderRadius: 18, padding: 14, marginTop: 16 },
  almost: { gap: 4, borderRadius: 18, padding: 14, marginTop: 16 },
  remove: { alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: 28 },
});
