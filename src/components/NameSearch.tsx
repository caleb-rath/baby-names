import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BABY_NAMES, nameSlug } from '../data/names';
import { useSessionStore } from '../store/useSessionStore';
import { swipeKey } from '../lib/matches';
import { lookupName, GENDER_LABEL } from '../lib/names';
import { font, MODE_LABEL, type, useTheme } from '../theme';
import type { BabyName, Gender, SwipeType } from '../types';
import { Chip } from './ui';

type Mode = 'first' | 'middle';

/** Look up a specific name (Grandma's, a favourite) and answer it directly, or add one that isn't listed. */
export default function NameSearch({ visible, mode, onClose }: { visible: boolean; mode: Mode; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [newGender, setNewGender] = useState<Gender>('N');
  const custom = useSessionStore((s) => s.customNames);
  const mySwipes = useSessionStore((s) => s.mySwipes);
  const lockedMiddle = useSessionStore((s) => s.session?.lockedMiddle ?? null);
  const changeSwipe = useSessionStore((s) => s.changeSwipe);
  const addCustomName = useSessionStore((s) => s.addCustomName);
  const updateSettings = useSessionStore((s) => s.updateSettings);

  const slug = nameSlug(q);
  const results = useMemo<BabyName[]>(() => {
    if (!slug) return [];
    const all = [...custom.map((c) => lookupName(c.id, custom)!), ...BABY_NAMES];
    const starts = all.filter((n) => n.id.startsWith(slug));
    const contains = all.filter((n) => !n.id.startsWith(slug) && n.id.includes(slug));
    return [...starts, ...contains].slice(0, 40);
  }, [slug, custom]);
  const exact = results.some((n) => n.id === slug);

  async function add() {
    const id = await addCustomName(q, newGender);
    changeSwipe(mode, id, 'like');
    setQ('');
  }

  const answers: { type: SwipeType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { type: 'pass', label: 'No', icon: 'close' },
    { type: 'super', label: 'Love', icon: 'star' },
    { type: 'like', label: 'Yes', icon: 'heart' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: t.bg, paddingTop: insets.top + 12 }]}>
        <View style={s.header}>
          <Text style={[type.title, { color: t.ink, flex: 1 }]} accessibilityRole="header">
            Find a {mode === 'middle' ? 'middle' : 'first'} name
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close search" hitSlop={10} style={s.close}>
            <Ionicons name="close" size={26} color={t.ink} />
          </Pressable>
        </View>
        <View style={[s.search, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Ionicons name="search" size={20} color={t.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Type a name, e.g. Josephine"
            placeholderTextColor={t.muted}
            autoFocus
            autoCorrect={false}
            style={[s.input, { color: t.ink }]}
            accessibilityLabel="Search names"
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={(n) => n.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            slug && !exact ? (
              <View style={[s.add, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={[type.body, { color: t.ink }]}>
                  Not in our list? Add “{q.trim()}” for both of you.
                </Text>
                <View style={s.genderRow}>
                  {(['F', 'M', 'N'] as Gender[]).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setNewGender(g)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: newGender === g }}
                      style={[s.gBtn, { borderColor: newGender === g ? t.ink : t.line, backgroundColor: newGender === g ? t.surfaceAlt : 'transparent' }]}
                    >
                      <Text style={[type.callout, { color: t.ink }]}>{GENDER_LABEL[g]}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={add} accessibilityRole="button" style={[s.addBtn, { backgroundColor: t.coral }]}>
                  <Text style={[type.button, { color: t.onCoral }]}>Add and say yes</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = mySwipes[swipeKey(mode, item.id)]?.type;
            return (
              <View style={[s.row, { borderBottomColor: t.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.section, { color: t.ink }]}>{item.name}</Text>
                  <Text style={[type.callout, { color: t.muted }]} numberOfLines={2}>
                    {[GENDER_LABEL[item.gender], item.origin, item.meaning && `“${item.meaning}”`].filter(Boolean).join(' · ')}
                  </Text>
                  {mode === 'middle' && (
                    <Pressable
                      onPress={() => updateSettings({ lockedMiddle: lockedMiddle === item.id ? null : item.id })}
                      accessibilityRole="button"
                      style={s.lock}
                      hitSlop={6}
                    >
                      <Ionicons name={lockedMiddle === item.id ? 'lock-closed' : 'lock-open-outline'} size={16} color={t.plum} />
                      <Text style={[type.caption, { color: t.plum }]}>
                        {lockedMiddle === item.id ? 'Chosen middle name (tap to undo)' : 'Choose as our middle name'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={s.answers}>
                  {answers.map((a) => {
                    const on = mine === a.type;
                    const color = a.type === 'like' ? t.sage : a.type === 'super' ? t.goldInk : t.ink;
                    return (
                      <Pressable
                        key={a.type}
                        onPress={() => changeSwipe(mode, item.id, on ? null : a.type)}
                        accessibilityRole="button"
                        accessibilityLabel={`${a.label}: ${item.name} as a ${MODE_LABEL[mode].toLowerCase()} name`}
                        accessibilityState={{ selected: on }}
                        style={[s.ans, { borderColor: on ? color : t.line, backgroundColor: on ? (a.type === 'super' ? t.butter : t.surfaceAlt) : 'transparent' }]}
                      >
                        <Ionicons name={on ? a.icon : (`${a.icon}-outline` as any)} size={18} color={color} />
                        <Text style={{ fontFamily: font.uiBold, fontSize: 12, color }}>{a.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            !slug ? (
              <View style={{ padding: 24, gap: 8 }}>
                <Text style={[type.body, { color: t.muted }]}>Have a family name in mind? Search for it and answer it directly.</Text>
                {mode === 'middle' && <Chip label="Tip: tap “Choose as our middle name” to pair it with every first name you both like" />}
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontFamily: font.ui, fontSize: 17, minHeight: 48 },
  add: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16, gap: 12 },
  genderRow: { flexDirection: 'row', gap: 8 },
  gBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  addBtn: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  answers: { flexDirection: 'row', gap: 6 },
  ans: { width: 52, minHeight: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, minHeight: 28 },
});
