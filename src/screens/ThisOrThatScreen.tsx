import React, { useMemo, useState } from 'react';
import { isYesType } from '../types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import { useOurNames, usePartnerName } from '../store/hooks';
import { duelScores, nextPair } from '../lib/duels';
import { buzz } from '../lib/platform';
import { Button, Screen, Segmented, TopBar } from '../components/ui';
import { lookupName } from '../lib/names';
import { font, type, useTheme } from '../theme';
import type { BabyName } from '../types';
import FitName from '../components/FitName';

const ROUND = 15;

type Source = 'ours' | 'mine';

/**
 * Head-to-head picks. "Our names" uses matches, and both of your picks combine into Our order.
 * "My yeses" uses every name you said yes to; those picks stay on this phone and sort My answers.
 */
export default function ThisOrThatScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const names = useOurNames();
  const duels = useStore((s) => s.duels);
  const userId = useStore((s) => s.userId);
  const addDuel = useStore((s) => s.addDuel);
  const myDuels = useStore((s) => s.myDuels);
  const addMyDuel = useStore((s) => s.addMyDuel);
  const mine = useStore((s) => s.mine);
  const custom = useStore((s) => s.custom);
  const [source, setSource] = useState<Source>(() => (names.length >= 2 ? 'ours' : 'mine'));
  const partnerName = usePartnerName();
  const [count, setCount] = useState(0);
  const [skips, setSkips] = useState(0);

  const pool = useMemo(
    () =>
      source === 'ours'
        ? names.map((n) => n.name)
        : Object.values(mine)
            .filter((x) => isYesType(x.type))
            .flatMap((x) => {
              const n = lookupName(x.itemId, custom);
              return n ? [n] : [];
            }),
    [source, names, mine, custom]
  );
  const ids = useMemo(() => pool.map((n) => n.id), [pool]);
  const byId = useMemo(() => Object.fromEntries(pool.map((n) => [n.id, n])), [pool]);
  const pair = useMemo(() => {
    if (source === 'mine') return nextPair(ids, myDuels, duelScores(myDuels), `m${myDuels.length}:${skips}`);
    const mineOnly = duels.filter((d) => d.userId === userId);
    return nextPair(ids, mineOnly, duelScores(duels), `${mineOnly.length}:${skips}`);
  }, [source, ids, duels, myDuels, userId, skips]);
  const switcher = (
    <Segmented<Source>
      label="Names to compare"
      value={source}
      onChange={(v) => {
        setSource(v);
        setCount(0);
      }}
      options={[
        { value: 'ours', label: `Our names · ${names.length}` },
        { value: 'mine', label: 'My yes list' },
      ]}
    />
  );
  const total = Math.min(ROUND, (ids.length * (ids.length - 1)) / 2);

  if (!pair || count >= total) {
    return (
      <Screen edges={['top', 'bottom']}>
        <TopBar back="Done" />
        {switcher}
        <View style={s.center}>
          <Text style={[type.title, { color: t.ink, textAlign: 'center' }]}>
            {ids.length < 2 ? 'Not enough names yet' : pair ? 'Round done' : 'You’ve compared every pair'}
          </Text>
          <Text style={[type.body, { color: t.muted, textAlign: 'center' }]}>
            {ids.length < 2
              ? source === 'ours'
                ? 'You need two matches for this. Try your own yes list instead.'
                : 'Say yes to a few more names first.'
              : source === 'ours'
                ? ''
                : 'These sort My answers.'}
          </Text>
          {ids.length >= 2 && (
            <Button
              label={source === 'ours' ? 'See Our order' : 'See My answers'}
              variant="dark"
              onPress={() => (source === 'ours' ? nav.goBack() : nav.navigate('MyAnswers'))}
              style={{ alignSelf: 'stretch', marginTop: 12 }}
            />
          )}
          {pair && <Button label="Keep going" variant="secondary" onPress={() => setCount(0)} style={{ alignSelf: 'stretch' }} />}
        </View>
      </Screen>
    );
  }

  const pick = (w: string, l: string) => {
    buzz('tap');
    if (source === 'mine') addMyDuel(w, l);
    else addDuel(w, l);
    setCount((c) => c + 1);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <TopBar back="Done" title={`This or That · ${count + 1} of ${total}`} />
      {switcher}
      <Text style={[type.body, { color: t.muted, textAlign: 'center', marginBottom: 14 }]}>
        Which do you like more <Text style={{ fontFamily: font.italic }}>right now</Text>?
      </Text>
      <Choice name={byId[pair[0]]} onPress={() => pick(pair[0], pair[1])} />
      <Text style={[type.section, { color: t.muted, textAlign: 'center', marginVertical: 10 }]}>or</Text>
      <Choice name={byId[pair[1]]} onPress={() => pick(pair[1], pair[0])} />
      <Pressable onPress={() => setSkips((x) => x + 1)} accessibilityRole="button" style={s.skip}>
        <Text style={[type.button, { color: t.muted }]}>Can’t choose? Skip</Text>
      </Pressable>
    </Screen>
  );
}

function Choice({ name, onPress }: { name: BabyName; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pick ${name.name}`}
      style={({ pressed }) => [s.choice, { backgroundColor: pressed ? t.hero : t.surface, borderColor: t.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <FitName size={type.nameLarge.fontSize} style={[type.nameLarge, { color: t.ink, textAlign: 'center' }]}>
        {name.name}
      </FitName>
      {!!name.meaning && <Text style={[type.meaningSmall, { color: t.muted, textAlign: 'center', fontSize: 17 }]}>“{name.meaning}”</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 10 },
  choice: { flex: 1, maxHeight: 260, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 },
  skip: { alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: 8 },
});
