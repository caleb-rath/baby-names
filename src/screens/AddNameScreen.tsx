import React, { useMemo, useState } from 'react';
import { isYesType } from '../types';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BABY_NAMES, ID_BY_SPELLING, nameSlug } from '../data/names';
import { useStore } from '../store/useStore';
import { lookupName } from '../lib/names';
import { Button, Screen, Segmented, Toast, TopBar } from '../components/ui';
import { font, type, useTheme } from '../theme';
import type { BabyName, Gender } from '../types';

/** Names you two already had in mind. Adding one counts as your yes; your partner sees it first in their next Today's 10. */
export default function AddNameScreen() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [gender, setGender] = useState<Gender>('F');
  const [toast, setToast] = useState({ text: null as string | null, id: 0 });
  const custom = useStore((s) => s.custom);
  const mine = useStore((s) => s.mine);
  const addName = useStore((s) => s.addName);

  const slug = nameSlug(q);
  const results = useMemo<BabyName[]>(() => {
    if (!slug) return [];
    const all = [...custom.map((c) => lookupName(c.id, custom)!), ...BABY_NAMES];
    const spellings = (n: BabyName) => [n.id, ...n.alts.map(nameSlug)];
    const starts = all.filter((n) => spellings(n).some((x) => x.startsWith(slug)));
    const contains = all.filter((n) => !starts.includes(n) && spellings(n).some((x) => x.includes(slug)));
    return [...starts, ...contains].slice(0, 30);
  }, [slug, custom]);
  // "Jaxson" is on the Jackson card, so it counts as found.
  const exact = results.some((n) => n.id === slug);
  // "Anika" is on the Annika card. Offer it as found, and also as its own name for people who want that spelling.
  const otherSpellingOf = !exact && ID_BY_SPELLING[slug] ? lookupName(ID_BY_SPELLING[slug], custom) : undefined;

  const add = (raw: string, g: Gender, opts?: { asTyped?: boolean; love?: boolean }) => {
    const id = addName(raw, g, opts);
    const n = lookupName(id, useStore.getState().custom);
    setToast((x) => ({ text: `${n?.name ?? raw} added${opts?.love ? ' as a Love' : ''}`, id: x.id + 1 }));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <TopBar back="Our names" title="Add a name" />
      <View style={[s.search, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Ionicons name="search" size={20} color={t.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search or add a name"
          placeholderTextColor={t.muted}
          autoFocus
          autoCorrect={false}
          autoCapitalize="words"
          style={[s.input, { color: t.ink }]}
          accessibilityLabel="Name"
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(n) => n.id}
        keyboardShouldPersistTaps="handled"
        style={{ marginTop: 8 }}
        ListFooterComponent={
          slug && !exact ? (
            <View style={[s.newBox, { backgroundColor: t.surfaceAlt }]}>
              <Text style={[type.button, { color: t.ink }]}>
                {otherSpellingOf ? `Want it spelled “${q.trim()}”?` : results.length ? `Not one of these? Add “${q.trim()}”` : `“${q.trim()}” isn’t in our list yet`}
              </Text>
              <Segmented<Gender>
                label="Usually a"
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'F', label: 'Girl' },
                  { value: 'M', label: 'Boy' },
                  { value: 'N', label: 'Either' },
                ]}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label={`Add ${q.trim()}`} variant="dark" onPress={() => add(q, gender, { asTyped: true })} style={{ flex: 1 }} />
                <Button label="♥ Love" variant="secondary" onPress={() => add(q, gender, { asTyped: true, love: true })} />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const a = mine[item.id];
          const yes = isYesType(a?.type);
          return (
            <View style={[s.row, { borderBottomColor: t.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[type.nameRow, { color: t.ink, fontSize: 20 }]}>{item.name}</Text>
                {!!(item.meaning || item.alts.length) && (
                  <Text style={[type.meaningSmall, { color: t.muted }]} numberOfLines={1}>
                    {[item.meaning, item.alts.length ? `also ${item.alts.slice(0, 3).join(', ')}` : ''].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              {a?.type === 'super' ? (
                <Text style={[type.caption, { color: t.goldInk }]}>Your love ★</Text>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {yes ? <Text style={[type.caption, { color: t.sage }]}>Your yes ✓</Text> : <Button small variant="secondary" label={a ? 'Change to yes' : 'Add'} onPress={() => add(item.name, item.gender)} />}
                  <Button small variant="secondary" label="♥" onPress={() => add(item.name, item.gender, { love: true })} />
                </View>
              )}
            </View>
          );
        }}
      />
      <Toast message={toast.text} id={toast.id} />
    </Screen>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, minHeight: 54 },
  input: { flex: 1, fontFamily: font.medium, fontSize: 18, minHeight: 50, outlineStyle: 'none' } as any,
  newBox: { borderRadius: 20, padding: 16, gap: 12, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: 1 },
});
