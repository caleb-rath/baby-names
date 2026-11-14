import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isYesType } from '../types';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { usePartnerName } from '../store/hooks';
import { packById } from '../lib/packs';
import { lookupName } from '../lib/names';
import CardStack, { type CardStackHandle } from '../components/CardStack';
import PaperCard from '../components/PaperCard';
import DirectionPad from '../components/DirectionPad';
import { Button, Screen, Toast, TopBar } from '../components/ui';
import { ProgressBar } from './DiscoverScreen';
import { font, genderColors, type, useTheme, wash } from '../theme';
import type { Stack, SwipeType } from '../types';

export default function DeckScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const { packId } = useRoute<any>().params as { packId: string };
  const pack = packById(packId);
  const partnerName = usePartnerName();
  const title = pack ? pack.title({ ...useStore.getState().packContext(), partnerName }) : 'Pack';

  // Discover deals the stack before navigating here; this is only a fallback.
  const stored = useStore((s) => s.stacks[packId]);
  useEffect(() => {
    if (!stored) useStore.getState().openStack(packId);
  }, [stored, packId]);
  const stack: Stack = stored ?? { packId, items: [], startedAt: Date.now(), day: '' };
  const mine = useStore((s) => s.mine);
  const custom = useStore((s) => s.custom);
  const lastName = useStore((s) => s.session?.lastName ?? '');
  const swipe = useStore((s) => s.swipe);
  const undo = useStore((s) => s.undo);
  const [toast, setToast] = useState<{ text: string | null; id: number }>({ text: null, id: 0 });
  const deck = useRef<CardStackHandle>(null);

  // A card is done once you've answered it since this stack was dealt (Second look re-asks old answers).
  const isDone = useCallback((id: string) => !!mine[id] && mine[id].updatedAt >= stack.startedAt, [mine, stack.startedAt]);
  const remaining = stack.items.filter((id) => !isDone(id));
  const doneCount = stack.items.length - remaining.length;
  const top = remaining[0] ? lookupName(remaining[0], custom) : undefined;
  const next = remaining[1] ? lookupName(remaining[1], custom) : undefined;

  const onSwiped = useCallback(
    (type: SwipeType) => {
      if (top) swipe(top.id, type);
    },
    [top?.id, swipe]
  );

  // "It's a match!" for your answer just now, or when your partner's yes on it lands a moment later.
  const alert = useStore((s) => s.matchAlert);
  const seenAlert = useRef(alert?.n ?? 0);
  useEffect(() => {
    if (!alert || alert.n <= seenAlert.current) return;
    seenAlert.current = alert.n;
    const n = lookupName(alert.itemId, custom);
    if (n) setToast((x) => ({ text: `It’s a match! ${n.name}`, id: x.id + 1 }));
  }, [alert?.n]);

  const onUndo = () => {
    const id = useStore.getState().history.at(-1)?.itemId;
    if (!id || !stack.items.includes(id)) return;
    undo();
  };

  // Arrow keys on a computer or a Fold with a keyboard.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') deck.current?.swipe('like');
      else if (e.key === 'ArrowLeft') deck.current?.swipe('pass');
      else if (e.key === 'ArrowUp') deck.current?.swipe('super');
      else if (e.key === 'ArrowDown') deck.current?.swipe('maybe');
      else if (e.key === 'Backspace' || e.key === 'z') onUndo();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!stored) return <Screen><TopBar back="Discover" /></Screen>;

  if (!stack.items.length || !top) {
    return (
      <Summary
        title={title}
        stack={stack}
        onMore={() => useStore.getState().openStack(packId, true)}
        onBack={() => nav.goBack()}
        onUndo={stack.items.length ? onUndo : undefined}
      />
    );
  }

  const canUndo = (() => {
    const id = useStore.getState().history.at(-1)?.itemId;
    return !!id && stack.items.includes(id);
  })();

  const g = genderColors(t, top.gender);
  const newHere = Object.keys(mine).length < 15;

  return (
    <Screen edges={['top', 'bottom']} bg={g.room}>
      <TopBar
        back="Discover"
        title={title}
        right={
          <Pressable onPress={onUndo} disabled={!canUndo} accessibilityRole="button" accessibilityLabel="Undo last answer" hitSlop={10} style={{ opacity: canUndo ? 1 : 0.3, padding: 8 }}>
            <Ionicons name="arrow-undo" size={22} color={t.ink} />
          </Pressable>
        }
      />
      <ProgressBar value={doneCount / stack.items.length} color={g.ink} />
      <View style={s.deckArea}>
        <CardStack
          ref={deck}
          topKey={top.id}
          top={<PaperCard name={top} lastName={lastName} />}
          next={next && <PaperCard name={next} lastName={lastName} />}
          more={remaining.length > 2}
          onSwiped={onSwiped}
          onDoubleTap={onUndo}
          yesColor={g.yes}
        />
      </View>
      {newHere && (
        <View style={s.hint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[type.caption, { color: g.ink, fontFamily: font.semibold }]}>Swipe the card, or tap a button</Text>
        </View>
      )}
      <DirectionPad onAnswer={(type) => deck.current?.swipe(type)} yesColor={g.yes} />
      <Toast message={toast.text} id={toast.id} top={70} />
    </Screen>
  );
}

function Summary({ title, stack, onMore, onBack, onUndo }: { title: string; stack: Stack; onMore: () => void; onBack: () => void; onUndo?: () => void }) {
  const t = useTheme();
  const nav = useNavigation<any>();
  const mine = useStore((s) => s.mine);
  const partner = useStore((s) => s.partner);
  const custom = useStore((s) => s.custom);
  const hasPartner = useStore((s) => !!s.session?.partner);
  const partnerName = usePartnerName();
  const pack = packById(stack.packId);
  const moreLeft = useMemo(() => (pack ? pack.pool(useStore.getState().packContext()).length : 0), [mine]);

  const yes = stack.items.filter((id) => isYesType(mine[id]?.type));
  const matches = yes.filter((id) => isYesType(partner[id]?.type));
  const alsoYes = yes.filter((id) => !matches.includes(id));
  const unseen = yes.filter((id) => !partner[id]).length;
  const names = (ids: string[]) => ids.map((id) => lookupName(id, custom)?.name).filter(Boolean) as string[];

  if (!stack.items.length) {
    return (
      <Screen edges={['top', 'bottom']}>
        <TopBar back="Discover" title={title} />
        <View style={s.center}>
          <Text style={[type.title, { color: t.ink, textAlign: 'center' }]}>All answered</Text>
          <Button label="Back to Discover" variant="dark" onPress={onBack} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      footer={
        <View style={{ gap: 10 }}>
          {moreLeft > 0 && <Button label={stack.packId === 'today' ? 'Deal 10 more' : `10 more from ${title}`} variant="dark" onPress={onMore} />}
          <Button label="Done" variant="secondary" onPress={onBack} />
        </View>
      }
    >
      <TopBar back="Discover" title={title} right={onUndo && (
        <Pressable onPress={onUndo} accessibilityRole="button" accessibilityLabel="Undo last answer" hitSlop={10} style={{ padding: 8 }}>
          <Ionicons name="arrow-undo" size={22} color={t.ink} />
        </Pressable>
      )} />
      {matches.length > 0 && (
        <Pressable onPress={() => nav.navigate('Main', { screen: 'OurNames' })} accessibilityRole="button" accessibilityLabel="New matches, open Our names" style={[s.card, wash(t.hero, t.hero2)]}>
          <Text style={[type.title, { color: t.ink }]}>{matches.length === 1 ? 'New match' : `${matches.length} new matches`}</Text>
          <View style={s.chips}>
            {matches.map((id) => {
              const n = lookupName(id, custom);
              if (!n) return null;
              const c = genderColors(t, n.gender);
              return (
                <View key={id} style={[s.chip, { backgroundColor: c.card }]}>
                  <Text style={[type.nameRow, { color: c.ink }]}>{n.name}</Text>
                </View>
              );
            })}
          </View>
        </Pressable>
      )}

      {matches.length === 0 && <Text style={[type.title, { color: t.ink, marginTop: 24 }]}>{yes.length ? 'You said yes to' : 'No yeses this round'}</Text>}
      {alsoYes.length > 0 && (
        <Text style={[type.meaning, { color: t.ink, fontSize: 22, lineHeight: 32, marginTop: matches.length ? 20 : 8 }]}>
          {matches.length ? 'Also yes: ' : ''}
          {names(alsoYes).join(', ')}
        </Text>
      )}
      {hasPartner && unseen > 0 && (
        <Text style={[type.callout, { color: t.muted, marginTop: 12 }]}>
          {unseen === yes.length && unseen > 1 ? `${partnerName} hasn’t seen these yet.` : `${partnerName} hasn’t seen ${unseen} of your yeses yet.`}
        </Text>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  deckArea: { flex: 1, marginTop: 20, marginBottom: 8, maxHeight: 620, width: '100%', alignSelf: 'center' },
  hint: { alignItems: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  center: { flex: 1, justifyContent: 'center', gap: 10 },
  card: { borderRadius: 28, padding: 20, gap: 8, marginTop: 18 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
