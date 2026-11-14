import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../store/useSessionStore';
import CardStack, { type CardStackHandle } from '../components/CardStack';
import NameCard from '../components/NameCard';
import NameSearch from '../components/NameSearch';
import MatchSheet from '../components/MatchSheet';
import Tutorial from '../components/Tutorial';
import { Button, Segmented } from '../components/ui';
import { buildDeck } from '../lib/deck';
import { computeMatches, swipeKey } from '../lib/matches';
import { lookupName } from '../lib/names';
import { shareCode } from '../lib/share';
import { font, MODE_LABEL, type, useTheme } from '../theme';
import type { DeckMode, SwipeType } from '../types';

const MODES: DeckMode[] = ['first', 'middle', 'combo'];

export default function SwipeScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const nav = useNavigation<any>();
  const stack = useRef<CardStackHandle>(null);
  const [mode, setMode] = useState<DeckMode>('first');
  const [searchOpen, setSearchOpen] = useState(false);

  const session = useSessionStore((s) => s.session)!;
  const userId = useSessionStore((s) => s.userId);
  const mySwipes = useSessionStore((s) => s.mySwipes);
  const partnerSwipes = useSessionStore((s) => s.partnerSwipes);
  const custom = useSessionStore((s) => s.customNames);
  const history = useSessionStore((s) => s.history);
  const pendingMatches = useSessionStore((s) => s.pendingMatches);
  const sync = useSessionStore((s) => s.sync);
  const outboxCount = useSessionStore((s) => Object.keys(s.outbox).length);
  const tutorialSeen = useSessionStore((s) => s.tutorialSeen);
  const { swipe, undo, dismissMatches, setTutorialSeen, updateSettings } = useSessionStore.getState();

  const matches = useMemo(() => computeMatches(mySwipes, partnerSwipes), [mySwipes, partnerSwipes]);
  const lockedMiddle = session.lockedMiddle ? lookupName(session.lockedMiddle, custom) : undefined;

  const partnerLiked = useMemo(
    () => new Set(Object.values(partnerSwipes).filter((s) => s.mode === mode && s.type !== 'pass').map((s) => s.itemId)),
    [partnerSwipes, mode]
  );
  const partnerAdded = useMemo(() => new Set(custom.map((c) => c.id)), [custom]);

  const deck = useMemo(
    () =>
      buildDeck({
        mode,
        filter: session.genderFilter,
        seed: `${session.id}:${userId}`,
        custom,
        partnerLiked,
        matches: mode === 'combo' ? matches : [],
        lockedMiddle: session.lockedMiddle,
      }),
    [mode, session.genderFilter, session.id, userId, custom, partnerLiked, mode === 'combo' ? matches : null, session.lockedMiddle]
  );
  // When partner swipes arrive the deck reorders; keep the card you're looking at on top.
  const pinned = useRef<string | null>(null);
  const remaining = useMemo(() => {
    const left = deck.filter((d) => !mySwipes[swipeKey(d.mode, d.itemId)]);
    const i = left.findIndex((d) => swipeKey(d.mode, d.itemId) === pinned.current);
    if (i > 0) left.unshift(...left.splice(i, 1));
    return left;
  }, [deck, mySwipes]);
  const [top, next] = remaining;
  pinned.current = top ? swipeKey(top.mode, top.itemId) : null;

  const onSwiped = useCallback((type: SwipeType) => top && swipe(top.mode, top.itemId, type), [top, swipe]);

  const onUndo = () => {
    const undone = undo();
    if (undone && undone.mode !== mode) setMode(undone.mode);
  };

  const mutualFirst = matches.filter((m) => m.mode === 'first').length;
  const mutualMiddle = matches.filter((m) => m.mode === 'middle').length;
  const hint =
    mode === 'middle'
      ? lockedMiddle
        ? null
        : 'Middle names to go with any first name.'
      : mode === 'combo'
        ? lockedMiddle
          ? `Your shared first names + ${lockedMiddle.name}.`
          : `From the ${mutualFirst} first and ${mutualMiddle} middle names you both said yes to.`
        : !session.partnerId
          ? 'Your partner hasn’t joined yet. Your answers are saved.'
          : null;

  let body: React.ReactNode;
  if (mode === 'middle' && lockedMiddle) {
    body = (
      <Empty
        icon="lock-closed-outline"
        title={`Middle name: ${lockedMiddle.name}`}
        text="You chose this middle name, so “Together” pairs it with every first name you both like."
        action={<Button label="Choose a different middle name" variant="secondary" onPress={() => updateSettings({ lockedMiddle: null })} />}
      />
    );
  } else if (mode === 'combo' && deck.length === 0) {
    body = (
      <Empty
        icon="people-outline"
        title="Nothing to pair yet"
        text={
          !session.partnerId
            ? 'Full names are built from names you both said yes to. Invite your partner first.'
            : `Full names come from first ${lockedMiddle ? 'names' : 'and middle names'} you both said yes to. Keep swiping First${lockedMiddle ? '' : ' and Middle'}.`
        }
        action={!session.partnerId ? <Button label="Share code" onPress={() => shareCode(session.code)} /> : undefined}
      />
    );
  } else if (!top) {
    body = (
      <Empty
        icon="checkmark-done-outline"
        title="You’ve seen them all"
        text={mode === 'combo' ? 'Swipe more first and middle names to get new pairings.' : 'Try a different filter in Settings, or search for a specific name.'}
        action={<Button label="See our list" variant="secondary" onPress={() => nav.navigate('OurList')} />}
      />
    );
  } else {
    body = (
      <CardStack
        ref={stack}
        topKey={swipeKey(top.mode, top.itemId)}
        onSwiped={onSwiped}
        top={<NameCard item={top} lastName={session.lastName} lockedMiddle={lockedMiddle?.name} partnerAdded={partnerAdded.has(top.itemId)} />}
        next={next && <NameCard item={next} lastName={session.lastName} lockedMiddle={lockedMiddle?.name} />}
      />
    );
  }

  const canSwipe = !!top && !(mode === 'middle' && lockedMiddle);

  return (
    <SafeAreaView edges={['top']} style={[s.flex, { backgroundColor: t.bg }]}>
      <View style={s.header}>
        <Pressable
          onPress={onUndo}
          disabled={!history.length}
          accessibilityRole="button"
          accessibilityLabel="Undo last answer"
          style={[s.iconBtn, { opacity: history.length ? 1 : 0.3 }]}
        >
          <Ionicons name="arrow-undo" size={22} color={t.ink} />
        </Pressable>
        <View style={s.flex}>
          <Segmented
            compact={width < 380}
            label="Which names"
            options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            value={mode}
            onChange={setMode}
            tint={(m) => t.tint[m]}
            tintInk={(m) => t.tintInk[m]}
          />
        </View>
        <Pressable
          onPress={() => setSearchOpen(true)}
          disabled={mode === 'combo'}
          accessibilityRole="button"
          accessibilityLabel="Search for a name"
          style={[s.iconBtn, { opacity: mode === 'combo' ? 0.3 : 1 }]}
        >
          <Ionicons name="search" size={22} color={t.ink} />
        </Pressable>
      </View>

      <View style={s.metaRow}>
        {hint ? <Text style={[type.callout, { color: t.muted, flex: 1 }]}>{hint}</Text> : <View style={s.flex} />}
        {sync === 'offline' && (
          <View style={[s.offline, { backgroundColor: t.amber }]} accessibilityLiveRegion="polite">
            <Ionicons name="cloud-offline-outline" size={14} color={t.amberInk} />
            <Text style={[type.caption, { color: t.amberInk }]}>{outboxCount ? `${outboxCount} waiting to sync` : 'Offline'}</Text>
          </View>
        )}
      </View>

      <View style={s.deck}>{body}</View>

      <View style={[s.actions, { opacity: canSwipe ? 1 : 0.35 }]} pointerEvents={canSwipe ? 'auto' : 'none'}>
        <Action label="No" icon="close" size={64} border={t.ink} color={t.ink} onPress={() => stack.current?.swipe('pass')} name={top?.first.name} />
        <Action label="Love" icon="star" size={56} bg={t.butter} color={t.goldInk} onPress={() => stack.current?.swipe('super')} name={top?.first.name} />
        <Action label="Yes" icon="heart" size={72} bg={t.sage} color={t.onSage} labelColor={t.sage} onPress={() => stack.current?.swipe('like')} name={top?.first.name} />
      </View>

      <NameSearch visible={searchOpen} mode={mode === 'middle' ? 'middle' : 'first'} onClose={() => setSearchOpen(false)} />
      <MatchSheet
        matches={pendingMatches}
        lastName={session.lastName}
        custom={custom}
        onKeepSwiping={dismissMatches}
        onSeeList={() => {
          dismissMatches();
          nav.navigate('OurList');
        }}
      />
      {!tutorialSeen && <Tutorial onDone={setTutorialSeen} />}
    </SafeAreaView>
  );
}

function Action({
  label,
  icon,
  size,
  bg,
  border,
  color,
  labelColor,
  onPress,
  name,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  bg?: string;
  border?: string;
  color: string;
  labelColor?: string;
  onPress: () => void;
  name?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name ? `${label}: ${name}` : label}
      style={({ pressed }) => [s.action, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? t.surface, borderWidth: border ? 2 : 0, borderColor: border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={size * 0.42} color={color} />
      </View>
      <Text style={{ fontFamily: font.uiBold, fontSize: 13, color: labelColor ?? color, marginTop: 6 }} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

function Empty({ icon, title, text, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Ionicons name={icon} size={40} color={t.muted} />
      <Text style={[type.section, { color: t.ink, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: t.muted, textAlign: 'center' }]}>{text}</Text>
      {action && <View style={{ alignSelf: 'stretch', marginTop: 8 }}>{action}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, minHeight: 36 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  deck: { flex: 1, marginHorizontal: 16, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 28, paddingVertical: 14 },
  action: { alignItems: 'center', minWidth: 64 },
  empty: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
