import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../store/useSessionStore';
import { Button, Segmented } from '../components/ui';
import { speakName } from '../components/NameCard';
import { computeMatches, rankMatches, swipeKey } from '../lib/matches';
import { itemLabel, lookupName } from '../lib/names';
import { shareCode } from '../lib/share';
import { font, MODE_LABEL, type, useTheme } from '../theme';
import type { DeckMode, Match, Swipe, SwipeType } from '../types';

type Tab = 'ours' | 'mine';

export default function OurListScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('ours');
  const [refreshing, setRefreshing] = useState(false);
  const session = useSessionStore((s) => s.session)!;
  const mySwipes = useSessionStore((s) => s.mySwipes);
  const partnerSwipes = useSessionStore((s) => s.partnerSwipes);
  const custom = useSessionStore((s) => s.customNames);
  const { refresh, moveToTop, changeSwipe } = useSessionStore.getState();

  const ranked = useMemo(() => rankMatches(computeMatches(mySwipes, partnerSwipes), session.shortlist), [mySwipes, partnerSwipes, session.shortlist]);
  const bothLove = ranked.filter((m) => m.bothLove).length;

  // Your partner loves it and you haven't said yes. Never shows your partner's no's.
  const talkAbout = useMemo(() => {
    const out: { key: string; mode: DeckMode; itemId: string }[] = [];
    for (const [key, p] of Object.entries(partnerSwipes)) {
      const m = mySwipes[key];
      if (p.type === 'super' && (!m || m.type === 'pass')) out.push({ key, mode: p.mode, itemId: p.itemId });
    }
    return out;
  }, [mySwipes, partnerSwipes]);

  const fullName = (m: { mode: DeckMode; itemId: string }) => {
    const label = itemLabel(m.mode, m.itemId, custom);
    if (m.mode === 'middle') return `… ${label} ${session.lastName}`.trim();
    const locked = m.mode === 'first' && session.lockedMiddle ? lookupName(session.lockedMiddle, custom)?.name : undefined;
    return [label, locked, session.lastName].filter(Boolean).join(' ');
  };

  function openMenu(m: Match) {
    const label = itemLabel(m.mode, m.itemId, custom);
    const actions = [
      { text: 'Move to top', onPress: () => moveToTop(m.key) },
      { text: 'Hear it', onPress: () => speakName(fullName(m)) },
      { text: 'Take off our list', style: 'destructive' as const, onPress: () => changeSwipe(m.mode, m.itemId, 'pass') },
    ];
    if (Platform.OS === 'web') {
      // Alert with buttons isn't supported on web; keep the most useful action.
      moveToTop(m.key);
      return;
    }
    Alert.alert(label, undefined, [...actions, { text: 'Cancel', style: 'cancel' as const, onPress: () => {} }]);
  }

  function shareList() {
    const lines = ranked.map((m, i) => `${i + 1}. ${fullName(m)}${m.bothLove ? ' ★' : ''}`);
    Share.share({ message: `Our baby name list:\n${lines.join('\n')}` }).catch(() => {});
  }

  return (
    <SafeAreaView edges={['top']} style={[s.flex, { backgroundColor: t.bg }]}>
      <View style={s.header}>
        <Text style={[type.title, { color: t.ink, flex: 1 }]} accessibilityRole="header">
          {tab === 'ours' ? 'Our list' : 'My answers'}
        </Text>
        {tab === 'ours' && ranked.length > 0 && (
          <Pressable onPress={shareList} accessibilityRole="button" accessibilityLabel="Share our list" style={s.iconBtn}>
            <Ionicons name="share-outline" size={22} color={t.ink} />
          </Pressable>
        )}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <Segmented
          label="List"
          options={[
            { value: 'ours', label: 'Our list' },
            { value: 'mine', label: 'My answers' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh().finally(() => setRefreshing(false)); }} />}
      >
        {tab === 'ours' ? (
          <>
            {!session.partnerId ? (
              <View style={[s.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={[type.section, { color: t.ink }]}>Your partner hasn’t joined yet</Text>
                <Text style={[type.body, { color: t.muted }]}>Names you both say yes to show up here. Send them the code {session.code}.</Text>
                <Button label="Share code" onPress={() => shareCode(session.code)} />
              </View>
            ) : ranked.length === 0 ? (
              <View style={[s.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={[type.section, { color: t.ink }]}>Your first match will show up here</Text>
                <Text style={[type.body, { color: t.muted }]}>
                  You’ve answered {Object.keys(mySwipes).length} names and your partner {Object.keys(partnerSwipes).length}. Keep going. Names your partner liked come up more often.
                </Text>
              </View>
            ) : (
              <Text style={[type.callout, { color: t.muted }]}>
                You both said yes to <Text style={{ fontFamily: font.uiBold, color: t.ink }}>{ranked.length} {ranked.length === 1 ? 'name' : 'names'}</Text>
                {bothLove ? ` · ${bothLove} you both love` : ''}. Coral is you, plum is your partner; ★ means love.
              </Text>
            )}

            {ranked.map((m, i) => (
              <View
                key={m.key}
                style={[s.match, { backgroundColor: m.bothLove ? t.butter : t.surface, borderColor: m.bothLove ? t.butter : t.line }]}
                accessible
                accessibilityLabel={`${i + 1}. ${fullName(m)}. ${MODE_LABEL[m.mode]} name. ${m.bothLove ? 'You both love it.' : m.iLove ? 'You love it.' : m.partnerLoves ? 'Your partner loves it.' : ''}`}
                accessibilityActions={[{ name: 'activate', label: 'More options' }]}
                onAccessibilityAction={() => openMenu(m)}
              >
                <Text style={[s.rank, { color: m.bothLove ? t.goldInk : t.muted }]}>{i + 1}</Text>
                <View style={s.flex}>
                  <Text style={[type.section, { color: m.bothLove ? t.goldInk : t.ink }]}>{itemLabel(m.mode, m.itemId, custom)}</Text>
                  <Text style={[type.callout, { color: m.bothLove ? t.goldInk : t.muted }]} numberOfLines={1}>
                    {m.mode === 'combo' ? fullName(m) : [MODE_LABEL[m.mode], lookupName(m.itemId, custom)?.meaning && `“${lookupName(m.itemId, custom)?.meaning}”`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Avatars you={m.iLove} partner={m.partnerLoves} />
                <Pressable onPress={() => openMenu(m)} accessibilityRole="button" accessibilityLabel={`Options for ${itemLabel(m.mode, m.itemId, custom)}`} style={s.iconBtn}>
                  <Ionicons name={Platform.OS === 'web' ? 'arrow-up' : 'ellipsis-horizontal'} size={20} color={m.bothLove ? t.goldInk : t.ink} />
                </Pressable>
              </View>
            ))}

            {talkAbout.length > 0 && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={[type.section, { color: t.ink }]}>Worth a chat</Text>
                {talkAbout.map((x) => (
                  <View key={x.key} style={[s.chat, { backgroundColor: t.surface, borderColor: t.line }]}>
                    <Ionicons name="star" size={18} color={t.goldInk} />
                    <Text style={[type.body, { color: t.ink, flex: 1 }]}>
                      Your partner loves{' '}
                      <Text style={{ fontFamily: font.uiBold }}>{itemLabel(x.mode, x.itemId, custom)}</Text>
                      {mySwipes[x.key] ? '. You said no; want to look again?' : '. It’s coming up in your deck.'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <MyAnswers swipes={mySwipes} label={(sw) => itemLabel(sw.mode, sw.itemId, custom)} onChange={changeSwipe} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Avatars({ you, partner }: { you: boolean; partner: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
      {[
        { on: you, bg: t.coral, fg: t.onCoral },
        { on: partner, bg: t.plum, fg: t.onPlum },
      ].map((a, i) => (
        <View key={i} style={[s.avatar, { backgroundColor: a.bg, borderColor: t.surface, marginLeft: i ? -8 : 0 }]}>
          <Ionicons name={a.on ? 'star' : 'checkmark'} size={14} color={a.fg} />
        </View>
      ))}
    </View>
  );
}

const ANSWER_ORDER: SwipeType[] = ['super', 'like', 'pass'];
const ANSWER_LABEL: Record<SwipeType, string> = { super: 'Love', like: 'Yes', pass: 'No' };

function MyAnswers({ swipes, label, onChange }: { swipes: Record<string, Swipe>; label: (s: Swipe) => string; onChange: (mode: DeckMode, id: string, type: SwipeType | null) => void }) {
  const t = useTheme();
  const [mode, setMode] = useState<DeckMode>('first');
  const [showNo, setShowNo] = useState(false);
  const list = Object.values(swipes)
    .filter((s) => s.mode === mode && (showNo || s.type !== 'pass'))
    .sort((a, b) => ANSWER_ORDER.indexOf(a.type) - ANSWER_ORDER.indexOf(b.type) || label(a).localeCompare(label(b)));

  return (
    <View style={{ gap: 10 }}>
      <Segmented label="Name type" options={(['first', 'middle', 'combo'] as DeckMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} value={mode} onChange={setMode} />
      <Pressable onPress={() => setShowNo(!showNo)} accessibilityRole="switch" accessibilityState={{ checked: showNo }} style={s.toggle}>
        <Ionicons name={showNo ? 'checkbox' : 'square-outline'} size={22} color={t.ink} />
        <Text style={[type.callout, { color: t.ink }]}>Show names I said no to</Text>
      </Pressable>
      {list.length === 0 && <Text style={[type.body, { color: t.muted }]}>Nothing here yet.</Text>}
      {list.map((sw) => (
        <View key={swipeKey(sw.mode, sw.itemId)} style={[s.answer, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={[type.section, { color: t.ink, flex: 1, fontSize: 20 }]} numberOfLines={1}>{label(sw)}</Text>
          {ANSWER_ORDER.map((a) => {
            const on = sw.type === a;
            const color = a === 'like' ? t.sage : a === 'super' ? t.goldInk : t.ink;
            return (
              <Pressable
                key={a}
                onPress={() => onChange(sw.mode, sw.itemId, a)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${ANSWER_LABEL[a]} for ${label(sw)}`}
                style={[s.ansBtn, { borderColor: on ? color : t.line, backgroundColor: on ? (a === 'super' ? t.butter : t.surfaceAlt) : 'transparent' }]}
              >
                <Text style={{ fontFamily: font.uiBold, fontSize: 13, color: on ? color : t.muted }}>{ANSWER_LABEL[a]}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 10, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 10 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, paddingVertical: 12, paddingLeft: 16, paddingRight: 4 },
  rank: { fontFamily: font.uiHeavy, fontSize: 15, width: 22 },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chat: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 8, paddingVertical: 8 },
  ansBtn: { borderWidth: 1, borderRadius: 10, minWidth: 48, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
