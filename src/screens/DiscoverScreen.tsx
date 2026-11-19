import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { startCouchAndInvite, useOurNames, usePartnerName, useStreak } from '../store/hooks';
import { CATCH_UP, ORIGIN_PACKS, SECOND_LOOK, STACK_SIZE, THEME_PACKS, TODAY, type Pack } from '../lib/packs';
import { couchLive } from '../lib/couch';
import { dayKey } from '../lib/random';
import { appUrl, shareText } from '../lib/platform';
import { Button, IconButton, MAX_WIDTH, Screen, Toast } from '../components/ui';
import { font, type, useTheme, wash } from '../theme';

export default function DiscoverScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const cols = Math.min(width, MAX_WIDTH) >= 520 ? 3 : 2;

  const session = useStore((s) => s.session);
  const mine = useStore((s) => s.mine);
  const partner = useStore((s) => s.partner);
  const custom = useStore((s) => s.custom);
  const stacks = useStore((s) => s.stacks);
  const couch = useStore((s) => s.couch);
  const userId = useStore((s) => s.userId);
  const sync = useStore((s) => s.sync);
  const partnerName = usePartnerName();
  const streak = useStreak();
  const email = useStore((s) => s.email);
  const nudgeDismissed = useStore((s) => s.emailNudgeDismissed);
  const hasRecoveryCode = useStore((s) => !!s.recoveryCodeAt);
  const matchCount = useOurNames().length;
  const [toast, setToast] = useState({ text: null as string | null, id: 0 });
  const [starting, setStarting] = useState(false);

  // How many unanswered names each pack still has. Recomputed when anyone answers.
  const left = useMemo(() => {
    const ctx = useStore.getState().packContext();
    const out: Record<string, number> = {};
    for (const p of [TODAY, CATCH_UP, SECOND_LOOK, ...THEME_PACKS, ...ORIGIN_PACKS]) out[p.id] = p.pool(ctx).length;
    return out;
  }, [mine, partner, custom, session?.genderFilter]);

  const progress = (id: string) => {
    const st = stacks[id];
    if (!st || !st.items.length || (id === 'today' && st.day !== dayKey())) return null;
    return { done: st.items.filter((i) => mine[i]).length, total: st.items.length };
  };

  const open = (packId: string) => {
    useStore.getState().openStack(packId);
    nav.navigate('Deck', { packId });
  };
  const today = progress('today');
  const todayDone = today && today.done === today.total;
  const invited = couchLive(couch) && couch.startedBy !== userId;

  const couchTap = async () => {
    if (invited) return nav.navigate('Couch');
    setStarting(true);
    try {
      await startCouchAndInvite();
      nav.navigate('Couch');
    } catch (e: any) {
      setToast((x) => ({ text: e?.message ?? 'That didn’t work.', id: x.id + 1 }));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen scroll>
      <View style={s.header}>
        <Text style={[type.title, { color: t.ink, fontSize: 36, lineHeight: 42, flex: 1 }]} accessibilityRole="header">
          Discover
        </Text>
        {!!session?.partner && (
          <Pressable
            onPress={couchTap}
            disabled={starting}
            accessibilityRole="button"
            accessibilityLabel="Couch mode: 20 names on both phones, answers flip together"
            style={({ pressed }) => [s.couchBtn, { backgroundColor: t.surfaceAlt, opacity: pressed || starting ? 0.7 : 1 }]}
          >
            <Ionicons name="people" size={18} color={t.ink} />
            <Text style={[type.callout, { color: t.ink, fontFamily: font.semibold }]}>Couch</Text>
          </Pressable>
        )}
        <IconButton icon="settings-outline" label="Settings" onPress={() => nav.navigate('Settings')} />
      </View>

      {(streak.weeks > 0 || sync === 'offline') && (
        <View style={s.streak} accessibilityRole="text">
          {streak.weeks > 0 && (
            <>
              <Ionicons name="flame" size={18} color={t.coral} />
              <Text style={[type.callout, { color: t.ink, fontFamily: font.bold }]} accessibilityLabel={`You've both played ${streak.weeks} weeks in a row`}>
                {streak.weeks} week{streak.weeks === 1 ? '' : 's'}
              </Text>
            </>
          )}
          <View style={{ flex: 1 }} />
          {sync === 'offline' && <Ionicons name="cloud-offline-outline" size={18} color={t.muted} accessibilityLabel="Offline. Answers will send when you reconnect." />}
        </View>
      )}

      {!session?.partner && (
        <View style={[s.notice, { backgroundColor: t.surfaceAlt }]}>
          <Text style={[type.body, { color: t.ink, fontFamily: font.semibold, flex: 1 }]}>Your partner hasn’t joined</Text>
          <Button small variant="dark" icon="share-outline" label="Share code" onPress={() => shareText('Pick baby names with me:', appUrl({ code: session?.code ?? '' }))} />
        </View>
      )}

      {invited && (
        <Pressable onPress={() => nav.navigate('Couch')} accessibilityRole="button" style={[s.invite, { backgroundColor: t.strong }]}>
          <Ionicons name="people" size={22} color={t.onStrong} />
          <Text style={[type.button, { color: t.onStrong, flex: 1 }]}>{partnerName} is waiting in Couch mode</Text>
          <Text style={[type.button, { color: t.onStrong }]}>Join</Text>
        </Pressable>
      )}

      {matchCount > 0 && !email && !hasRecoveryCode && !nudgeDismissed && (
        <View style={[s.nudge, { backgroundColor: t.surfaceAlt }]}>
          <Pressable onPress={() => nav.navigate('Settings')} accessibilityRole="button" style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.callout, { color: t.ink, fontFamily: font.semibold }]}>Save an email or recovery code so a new phone can get back in ›</Text>
          </Pressable>
          <Pressable onPress={() => useStore.getState().dismissEmailNudge()} accessibilityRole="button" accessibilityLabel="Not now" hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="close" size={18} color={t.muted} />
          </Pressable>
        </View>
      )}

      {/* Drops off once you've finished it; a new one comes back tomorrow. */}
      {!todayDone && (
      <Pressable onPress={() => open('today')} accessibilityRole="button" accessibilityLabel={`Today’s 10. ${today?.done ? `${today.done} of ${today.total} done` : 'Start'}`} style={({ pressed }) => [s.hero, wash(t.hero, t.hero2), { opacity: pressed ? 0.9 : 1 }]}>
        <Text style={[type.nameLarge, { color: t.ink }]}>Today’s 10</Text>
        {!!today?.done && (
          <>
            <Text style={[type.callout, { color: t.muted }]}>{`${today.done} of ${today.total}`}</Text>
            <ProgressBar value={today.done / today.total} color={t.coral} track={t.chip} />
          </>
        )}
      </Pressable>
      )}

      <View style={[s.grid, { marginTop: todayDone ? 0 : 12 }]}>
        {!!left.catchup && (
          <Tile pack={CATCH_UP} title={`Catch up with ${partnerName}`} line={left.catchup > STACK_SIZE ? `${STACK_SIZE}+ new` : `${left.catchup} new`} cols={left.second ? 2 : 1} tint={t.packs[1]} onPress={open} progress={progress('catchup')} />
        )}
        {!!left.second && <Tile pack={SECOND_LOOK} line={`${left.second} to look at`} cols={left.catchup ? 2 : 1} tint={t.packs[2]} onPress={open} progress={progress('second')} />}
      </View>

      <View style={[s.grid, { marginTop: 16 }]}>
        {THEME_PACKS.map((p, i) => (
          <Tile key={p.id} pack={p} line={countLine(left[p.id])} cols={cols} tint={checker(t, i, cols)} onPress={open} progress={progress(p.id)} disabled={!left[p.id] && !progress(p.id)} />
        ))}
      </View>

      <Section title="By origin" />
      <View style={s.chipsWrap}>
        {ORIGIN_PACKS.map((p) => {
          const done = !left[p.id] && !progress(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => open(p.id)}
              disabled={done}
              accessibilityRole="button"
              accessibilityLabel={`${p.title({} as any)}${done ? ', all answered' : ''}`}
              style={({ pressed }) => [s.chip, { backgroundColor: t.packs[0], opacity: done ? 0.45 : pressed ? 0.8 : 1 }]}
            >
              <Text style={[type.callout, { color: t.ink, fontFamily: font.semibold }]}>{p.title({} as any)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Toast message={toast.text} id={toast.id} />
    </Screen>
  );
}

/** Counts only mean something when they're small. */
function countLine(n: number) {
  if (!n) return 'All answered';
  return n < 50 ? `${n} left` : '';
}

/** Tiles alternate two warm neutrals in a checkerboard, whatever the column count. */
function checker(t: ReturnType<typeof useTheme>, i: number, cols: number) {
  const row = Math.floor(i / cols);
  return t.packs[(i + row * (cols % 2 === 0 ? 1 : 0)) % 2];
}

function Section({ title }: { title: string }) {
  const t = useTheme();
  return (
    <Text style={[type.section, { color: t.ink, marginTop: 28, marginBottom: 12 }]} accessibilityRole="header">
      {title}
    </Text>
  );
}

export function ProgressBar({ value, color, track }: { value: number; color?: string; track?: string }) {
  const t = useTheme();
  return (
    <View style={[s.bar, { backgroundColor: track ?? t.surfaceAlt }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[s.barFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color ?? t.ink }]} />
    </View>
  );
}

function Tile({
  pack,
  title,
  line,
  cols,
  tint,
  onPress,
  progress,
  disabled,
  small,
}: {
  pack: Pack;
  title?: string;
  line: string;
  cols: number;
  tint: string;
  onPress: (id: string) => void;
  progress: { done: number; total: number } | null;
  disabled?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const name = title ?? pack.title({} as any);
  const inProgress = progress && progress.done < progress.total && progress.done > 0;
  return (
    <Pressable
      onPress={() => onPress(pack.id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[name, pack.subtitle, inProgress ? `${progress!.done} of ${progress!.total} done` : line].filter(Boolean).join('. ')}
      style={({ pressed }) => [s.tile, { width: `${100 / cols}%` as any, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <View style={[s.tileInner, small && { minHeight: 92 }, { backgroundColor: tint }]}>
        <Text style={[type.section, { color: t.ink, fontSize: small ? 16 : 18 }]} numberOfLines={2}>
          {name}
        </Text>
        {!small && !!pack.subtitle && (
          <Text style={[type.caption, { color: t.muted, fontFamily: font.regular }]} numberOfLines={2}>
            {pack.subtitle}
          </Text>
        )}
        <Text style={[type.caption, { color: t.ink, marginTop: 'auto' }]}>{inProgress ? `${progress!.done} of ${progress!.total} · keep going` : line}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 14 },
  couchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, paddingLeft: 18, marginBottom: 12 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingLeft: 16, paddingRight: 8, marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 18, marginBottom: 12 },
  hero: { borderRadius: 30, padding: 24, gap: 6, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  barFill: { height: '100%', borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  // Tiles use an outer cell for the gutter, so widths stay exact percentages.
  tile: { padding: 6, backgroundColor: 'transparent' },
  tileInner: { borderRadius: 24, padding: 18, minHeight: 96, gap: 4 },
});
