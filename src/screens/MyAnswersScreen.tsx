import React, { useMemo, useState } from 'react';
import { isYesType } from '../types';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import { lookupName } from '../lib/names';
import { duelScores } from '../lib/duels';
import { Pills, Screen, TopBar } from '../components/ui';
import { type, useTheme } from '../theme';
import type { SwipeType } from '../types';

type Filter = 'yes' | 'super' | 'maybe' | 'pass';

/** Every name you've answered, newest first. Only you see this. */
export default function MyAnswersScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const mine = useStore((s) => s.mine);
  const custom = useStore((s) => s.custom);
  const [filter, setFilter] = useState<Filter>('yes');
  const myDuels = useStore((s) => s.myDuels);
  // Once you've played This or That on your yes list, yeses sort by those picks (best first).
  const scores = useMemo(() => (myDuels.length ? duelScores(myDuels) : null), [myDuels]);
  const ranked = !!scores && (filter === 'yes' || filter === 'super');

  const counts = useMemo(() => {
    const v = Object.values(mine);
    return { yes: v.filter((s) => s.type === 'like').length, super: v.filter((s) => s.type === 'super').length, maybe: v.filter((s) => s.type === 'maybe').length, pass: v.filter((s) => s.type === 'pass').length };
  }, [mine]);

  const list = useMemo(
    () =>
      Object.values(mine)
        .filter((s) => (filter === 'yes' ? s.type === 'like' : s.type === filter))
        .sort((a, b) => (ranked ? (scores![b.itemId] ?? 1000) - (scores![a.itemId] ?? 1000) : 0) || b.updatedAt - a.updatedAt)
        .flatMap((s) => {
          const n = lookupName(s.itemId, custom);
          return n ? [{ n, type: s.type }] : [];
        }),
    [mine, custom, filter, ranked, scores]
  );

  const label: Record<SwipeType, string> = { like: 'Yes', super: '★ Love', maybe: 'Maybe', pass: 'No' };

  return (
    <Screen edges={['top', 'bottom']}>
      <TopBar back="Our names" title="My answers" />
      <Pills<Filter>
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'yes', label: `Yes · ${counts.yes}` },
          { value: 'super', label: `Love · ${counts.super}` },
          { value: 'maybe', label: `Maybe · ${counts.maybe}` },
          { value: 'pass', label: `No · ${counts.pass}` },
        ]}
      />
      {ranked && <Text style={[type.caption, { color: t.muted, marginTop: 8 }]}>Sorted by your This or That picks.</Text>}
      <View style={{ height: 8 }} />
      <FlatList
        data={list}
        keyExtractor={(x) => x.n.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate('Name', { itemId: item.n.id })}
            accessibilityRole="button"
            accessibilityLabel={`${item.n.name}, you said ${label[item.type]}`}
            style={({ pressed }) => [s.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.surfaceAlt : 'transparent' }]}
          >
            <Text style={[type.nameRow, { color: t.ink, fontSize: 20, flex: 1 }]} numberOfLines={1}>
              {item.n.name}
            </Text>
            <Text style={[type.caption, { color: item.type === 'super' ? t.goldInk : item.type === 'like' ? t.sage : item.type === 'maybe' ? t.maybeInk : t.muted }]}>{label[item.type]}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={[type.body, { color: t.muted, marginTop: 20 }]}>Nothing here yet.</Text>}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, borderBottomWidth: 1, paddingHorizontal: 4 },
});
