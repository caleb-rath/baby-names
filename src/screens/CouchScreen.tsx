import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isMatchPair } from '../types';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { startCouchAndInvite, usePartnerName } from '../store/hooks';
import { couchLive, couchQueue } from '../lib/couch';
import { eraLine, lookupName } from '../lib/names';
import { buzz } from '../lib/platform';
import { Button, Screen, TopBar } from '../components/ui';
import { ProgressBar } from './DiscoverScreen';
import { genderColors, type, useTheme } from '../theme';
import DirectionPad from '../components/DirectionPad';
import type { Couch, Swipe, SwipeType } from '../types';

const LABEL: Record<SwipeType, string> = { pass: 'No', maybe: 'Maybe', like: 'Yes', super: 'Love' };

/** Same names on both phones, at the same time. Answers stay hidden until you've both answered. */
export default function CouchScreen() {
  const couch = useStore((s) => s.couch);
  const live = couchLive(couch);
  // Remember the game you were in, so if your partner ends it you see the tally instead of a blank start screen.
  const last = useRef<Couch | null>(null);
  if (live) last.current = couch;
  if (live) return <Game couch={couch} />;
  if (last.current) return <Game couch={last.current} ended />;
  return <Intro />;
}

function Intro() {
  const t = useTheme();
  const hasPartner = useStore((s) => !!s.session?.partner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startCouchAndInvite();
    } catch (e: any) {
      setError(e?.message ?? 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <TopBar back="Discover" />
      <View style={s.center}>
        <Text style={[type.nameLarge, { color: t.ink }]}>Couch mode</Text>
        <Text style={[type.body, { color: t.muted }]}>20 names on both phones. Your answers flip over together.</Text>
        <Button label="Start" variant="dark" icon="people" loading={busy} disabled={!hasPartner} onPress={start} style={{ marginTop: 12 }} />
        {!hasPartner && <Text style={[type.caption, { color: t.muted }]}>Your partner needs to join first.</Text>}
        {error && <Text style={[type.callout, { color: t.coral }]}>{error}</Text>}
      </View>
    </Screen>
  );
}

function Game({ couch, ended }: { couch: Couch; ended?: boolean }) {
  const t = useTheme();
  const nav = useNavigation<any>();
  const mine = useStore((s) => s.mine);
  const partner = useStore((s) => s.partner);
  const custom = useStore((s) => s.custom);
  const filter = useStore((s) => s.session?.genderFilter ?? 'all');
  const setAnswer = useStore((s) => s.setAnswer);
  const partnerName = usePartnerName();

  // Leaving Couch mode ends it for both of you, so nobody is left waiting on the other phone.
  // Except when you've finished and your partner is still going: then they get to finish.
  const keepAlive = useRef(false);
  useEffect(() => () => void (keepAlive.current || useStore.getState().endCouch()), []);

  // Fixed once the game starts, so answering doesn't reshuffle what's left.
  const queue = useMemo(() => couchQueue(couch, custom, filter, useStore.getState().mine, useStore.getState().partner), [couch.seed, custom.length, filter]);
  // Only answers given during this game count; a name one of you liked earlier is asked again.
  const inGame = (x?: Swipe) => (x && x.updatedAt >= couch.startedAt - 60_000 ? x : undefined);
  const both = (id: string) => !!inGame(mine[id]) && !!inGame(partner[id]);
  const [idx, setIdx] = useState(() => {
    const i = queue.findIndex((id) => !both(id));
    return i === -1 ? queue.length : i;
  });

  const current = queue[idx];
  const my = current ? inGame(mine[current]) : undefined;
  const their = current ? inGame(partner[current]) : undefined;
  const revealed = !!my && !!their;
  const isMatch = revealed && isMatchPair(my?.type, their?.type);

  useEffect(() => {
    if (isMatch) buzz('thump');
  }, [isMatch, current]);

  // Don't rely only on live updates while someone is waiting: check every couple of seconds.
  const waiting = !ended && !!current && !!my !== !!their;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => useStore.getState().refresh(), 2500);
    return () => clearInterval(timer);
  }, [waiting, current]);

  const partnerProgress = queue.filter((id) => inGame(partner[id])).length;
  keepAlive.current = !current && !ended && partnerProgress < queue.length;

  // Leaving is what ends it (see the cleanup above).
  const end = () => nav.goBack();

  if (!current || ended) {
    const all = queue.filter(both);
    const matched = all.filter((id) => isMatchPair(mine[id]?.type, partner[id]?.type));
    const names = matched.map((id) => lookupName(id, custom)?.name).filter(Boolean);
    return (
      <Screen edges={['top', 'bottom']} footer={<Button label="Done" variant="dark" onPress={end} />}>
        <TopBar back={null} />
        <View style={s.center}>
          {ended && <Text style={[type.callout, { color: t.muted }]}>{partnerName} ended Couch mode.</Text>}
          <Text style={[type.nameLarge, { color: t.ink }]}>{matched.length ? `${matched.length} match${matched.length === 1 ? '' : 'es'}` : 'No matches'}</Text>
          {names.length > 0 && <Text style={[type.meaning, { color: t.ink }]}>{names.join(', ')}</Text>}
          {!ended && partnerProgress < queue.length && <Text style={[type.callout, { color: t.muted }]}>{partnerName} is still going: {partnerProgress} of {queue.length}.</Text>}
        </View>
      </Screen>
    );
  }

  const name = lookupName(current, custom)!;
  const answer = (type: SwipeType) => {
    buzz(type === 'super' ? 'thump' : 'tap');
    setAnswer(current, type);
  };

  const g = genderColors(t, name.gender);

  return (
    <Screen edges={['top', 'bottom']} bg={g.room}>
      <TopBar back="End" onBack={end} title={`${idx + 1} of ${queue.length}`} />
      <ProgressBar value={idx / queue.length} color={g.ink} />
      <View style={s.stage}>
        <Text style={[type.nameHero, { color: t.ink, textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit>
          {name.name}
        </Text>
        {name.meaning ? (
          <Text style={[type.meaning, { color: t.ink, textAlign: 'center' }]}>“{name.meaning}”</Text>
        ) : (
          !!eraLine(name) && <Text style={[type.meaning, { color: t.muted, textAlign: 'center' }]}>{eraLine(name)}</Text>
        )}

        {revealed ? (
          <View style={{ alignItems: 'center', gap: 16, marginTop: 28 }}>
            <View style={s.boxes}>
              <Box who="You" type={my!.type} />
              <Box who={partnerName} type={their!.type} />
            </View>
            {isMatch && (
              <View style={[s.matched, { backgroundColor: t.hero }]}>
                <Text style={[type.button, { color: t.ink }]}>It’s a match ✓</Text>
              </View>
            )}
          </View>
        ) : my ? (
          <View style={s.waiting}>
            <ActivityIndicator color={t.muted} />
            <Text style={[type.body, { color: t.muted }]}>Waiting for {partnerName}…</Text>
          </View>
        ) : (
          <Text style={[type.callout, { color: t.muted, textAlign: 'center', marginTop: 28 }]}>
            {their ? `${partnerName} has answered` : `${partnerName}: ${partnerProgress} of ${queue.length}`}
          </Text>
        )}
      </View>

      {revealed ? (
        <Button label="Next name" variant="dark" onPress={() => setIdx((i) => i + 1)} style={{ marginBottom: 12 }} />
      ) : (
        <DirectionPad onAnswer={answer} yesColor={g.yes} disabled={!!my} />
      )}
    </Screen>
  );
}

function Box({ who, type: a }: { who: string; type: SwipeType }) {
  const t = useTheme();
  return (
    <View style={[s.box, { backgroundColor: t.surface }]}>
      <Text style={[type.overline, { color: t.muted }]}>{who.toUpperCase()}</Text>
      <Text style={[type.title, { fontSize: 26, color: a === 'super' ? t.goldInk : a === 'like' ? t.sage : a === 'maybe' ? t.maybeInk : t.ink }]}>{LABEL[a]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  stage: { flex: 1, justifyContent: 'center', gap: 8 },
  boxes: { flexDirection: 'row', gap: 12 },
  box: { minWidth: 130, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', gap: 2 },
  matched: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  waiting: { alignItems: 'center', gap: 10, marginTop: 28 },
});
