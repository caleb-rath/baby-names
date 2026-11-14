import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BabyName } from '../types';
import { GENDER_LABEL, altsLine, eraLine } from '../lib/names';
import { checkInitials } from '../lib/initials';
import { font, genderColors, type, useTheme, wash } from '../theme';
import FitName from './FitName';

/** One card in the deck: a soft wash in the name's gender color. Shows the name, its meaning, and how it sounds with your last name. Nothing about your partner. */
export default function PaperCard({ name, lastName }: { name: BabyName; lastName: string }) {
  const t = useTheme();
  const g = genderColors(t, name.gender);
  const meta = name.custom ? 'Added by you two' : name.origin;
  // Start smaller for longer names; FitName then shrinks further if it still doesn't fit.
  const len = name.name.length;
  const size = len > 22 ? 30 : len > 14 ? 36 : len > 10 ? 44 : len > 7 ? 54 : 62;
  const facts: [string, string][] = [];
  if (!name.custom) facts.push(['2024 rank', name.rank ? `#${name.rank}` : '1000+']);
  const ini = lastName ? checkInitials(name.name, lastName) : null;
  if (ini?.warning) facts.push(['Initials', `${ini.initials} ⚠`]);
  return (
    <View
      style={[s.card, wash(g.card, g.card2), { shadowColor: t.shadow }]}
      accessible
      accessibilityLabel={`${name.name}, ${GENDER_LABEL[name.gender]}. ${name.meaning ? `Means ${name.meaning}.` : eraLine(name) ?? ''} ${meta}`}
    >
      <View style={s.top}>
        <View style={[s.pill, { backgroundColor: t.chip }]}>
          <Text style={[type.caption, { color: g.ink, fontFamily: font.heavy }]}>{GENDER_LABEL[name.gender]}</Text>
        </View>
        <Text style={[type.callout, { color: g.ink, fontFamily: font.semibold, flex: 1 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={s.middle}>
        <FitName size={size} lines={2} style={[type.nameHero, { color: t.ink, lineHeight: type.nameHero.fontSize * 1.08 }]}>
          {name.name}
        </FitName>
        {name.meaning ? (
          <Text style={[type.meaning, { color: g.ink }]}>“{name.meaning}”</Text>
        ) : (
          !name.custom && !!eraLine(name) && <Text style={[type.meaning, { color: g.ink }]}>{eraLine(name)}</Text>
        )}
        {!!lastName && <Text style={[type.body, { color: g.ink, opacity: 0.8 }]}>{name.name} {lastName}</Text>}
        {!!altsLine(name) && <Text style={[type.caption, { color: g.ink, opacity: 0.8, fontFamily: font.medium }]}>{altsLine(name)}</Text>}
      </View>
      <View style={s.facts}>
        {facts.map(([k, v]) => (
          <View key={k}>
            <Text style={[type.caption, { color: g.ink, fontFamily: font.medium }]}>{k}</Text>
            <Text style={[type.section, { color: t.ink, fontFamily: font.heavy }]}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 34,
    padding: 24,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  middle: { flex: 1, justifyContent: 'center', gap: 8 },
  facts: { flexDirection: 'row', gap: 22 },
});
