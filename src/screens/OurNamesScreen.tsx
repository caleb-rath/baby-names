import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { useOurNames, type OurName } from '../store/hooks';
import { duelScores } from '../lib/duels';
import { IconButton, Pills, Screen } from '../components/ui';
import { font, type, useTheme } from '../theme';

type Sort = 'recent' | 'F' | 'M' | 'order';

export default function OurNamesScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const names = useOurNames();
  const duels = useStore((s) => s.duels);
  const [sort, setSort] = useState<Sort>('recent');

  // NEW tags stay while you're looking and clear once you leave.
  useFocusEffect(useCallback(() => () => useStore.getState().markListSeen(), []));

  const scores = useMemo(() => duelScores(duels), [duels]);
  const compared = useMemo(() => new Set(duels.flatMap((d) => [d.winner, d.loser])), [duels]);

  const list = useMemo(() => {
    const byName = (a: OurName, b: OurName) => a.name.name.localeCompare(b.name.name);
    switch (sort) {
      case 'recent':
        return [...names].sort((a, b) => b.at - a.at);
      case 'F':
      case 'M':
        return names.filter((n) => n.gender === sort || n.gender === 'N').sort(byName);
      case 'order':
        // Compared names by score; names neither of you has compared yet go last.
        return [...names].sort((a, b) => Number(compared.has(b.itemId)) - Number(compared.has(a.itemId)) || (scores[b.itemId] ?? 1000) - (scores[a.itemId] ?? 1000) || byName(a, b));
    }
  }, [names, sort, scores, compared]);

  const sorts: { value: Sort; label: string }[] = [
    { value: 'recent', label: 'Recent' },
    { value: 'F', label: 'Girls' },
    { value: 'M', label: 'Boys' },
  ];
  if (duels.length) sorts.push({ value: 'order', label: 'Our order' });

  const hero = sort === 'recent' && list[0]?.isNew ? list[0] : null;
  const rows = hero ? list.slice(1) : list;
  const open = (id: string) => nav.navigate('Name', { itemId: id });

  return (
    <Screen scroll>
      <View style={s.header}>
        <Text style={[type.title, { color: t.ink, fontSize: 36, lineHeight: 42, flex: 1 }]} accessibilityRole="header">
          Our names
        </Text>
        <IconButton icon="settings-outline" label="Settings" onPress={() => nav.navigate('Settings')} />
      </View>
      <Text style={[type.body, { color: t.muted, marginTop: 4, marginBottom: 14 }]}>
        {names.length === 0 ? 'Names you both say yes to show up here.' : `${names.length} name${names.length === 1 ? '' : 's'}`}
      </Text>

      {names.length > 0 && <Pills options={sorts} value={sort} onChange={setSort} label="Sort our names" />}

      {hero && (
        <Pressable onPress={() => open(hero.itemId)} accessibilityRole="button" accessibilityLabel={`New match: ${hero.name.name}`} style={[s.hero, { backgroundColor: t.hero }]}>
          <Text style={[type.overline, { color: t.coral }]}>NEW MATCH{hero.bothLove ? ' · YOU BOTH LOVE IT' : ''}</Text>
          <Text style={[type.nameLarge, { color: t.ink }]}>{hero.name.name}</Text>
          {!!hero.name.meaning && <Text style={[type.meaning, { color: t.ink }]}>“{hero.name.meaning}”</Text>}
        </Pressable>
      )}


      <View style={{ marginTop: hero ? 8 : 12 }}>
        {rows.map((n, i) => (
          <Pressable
            key={n.itemId}
            onPress={() => open(n.itemId)}
            accessibilityRole="button"
            accessibilityLabel={`${n.name.name}${n.isNew ? ', new' : ''}${n.bothLove ? ', you both love it' : ''}. ${n.name.meaning}`}
            style={({ pressed }) => [s.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.surfaceAlt : 'transparent' }]}
          >
            {sort === 'order' && (
              <Text style={[type.callout, s.num, { color: t.muted }]}>{compared.has(n.itemId) ? i + 1 : '–'}</Text>
            )}
            <Text style={[type.nameRow, { color: t.ink }]} numberOfLines={1}>
              {n.name.name}
            </Text>
            {n.isNew && <Text style={[type.overline, { color: t.coral }]}>NEW</Text>}
            {n.bothLove && <Ionicons name="star" size={14} color={t.goldInk} accessibilityElementsHidden />}
            {(sort === 'F' || sort === 'M') && n.gender === 'N' && <Text style={[type.caption, { color: t.muted }]}>Either</Text>}
            <Text style={[type.meaningSmall, s.meaning, { color: t.muted }]} numberOfLines={1}>
              {n.name.meaning}
            </Text>
          </Pressable>
        ))}
      </View>


      <Pressable onPress={() => nav.navigate('AddName')} accessibilityRole="button" style={({ pressed }) => [s.add, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
        <Text style={[type.button, { color: t.ink }]}>+ Add a name</Text>
      </Pressable>

      <View style={s.links}>
        {names.length >= 3 && (
          <Link icon="git-compare-outline" label="This or That" onPress={() => nav.navigate('ThisOrThat')} />
        )}
        <Link icon="list-outline" label="My answers" onPress={() => nav.navigate('MyAnswers')} />
      </View>
    </Screen>
  );
}

function Link({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.link, { backgroundColor: pressed ? t.surfaceAlt : t.surface, borderColor: t.line }]}>
      <Ionicons name={icon} size={22} color={t.ink} />
      <Text style={[type.button, { color: t.ink, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  hero: { borderRadius: 28, padding: 24, gap: 6, marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, borderBottomWidth: 1, paddingHorizontal: 4 },
  num: { width: 22, fontFamily: font.semibold },
  meaning: { flex: 1, textAlign: 'right', marginLeft: 8 },
  empty: { borderRadius: 20, padding: 20, marginTop: 8 },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 18, minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  links: { gap: 10, marginTop: 16 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 16 },
});
