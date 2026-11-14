import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Share,
} from 'react-native';
import { useSessionStore } from '../store/useSessionStore';
import { BABY_NAMES } from '../data/names';
import type { Match, BabyName, SwipeType } from '../types';

interface Mismatch {
  name: BabyName;
  myType: SwipeType;
  partnerType: SwipeType;
}

function MatchItem({ match }: { match: Match }) {
  const isSuper = match.matchType === 'super_match';
  const isPartial = match.matchType.startsWith('partial');
  const name = match.combo
    ? `${match.combo.firstName.name} ${match.combo.middleName.name}`
    : match.name?.name ?? '?';
  const sub = match.combo
    ? `${match.combo.firstName.origin} · ${match.combo.middleName.origin}`
    : match.name?.origin ?? '';

  return (
    <View style={[s.item, isSuper && s.itemSuper, isPartial && s.itemPartial]}>
      <View style={s.itemLeft}>
        <View>
          <Text style={s.itemName}>{name}</Text>
          <Text style={s.itemSub}>{sub}</Text>
        </View>
      </View>
      <View style={[s.badge, isSuper ? s.badgeSuper : isPartial ? s.badgePartial : s.badgeMatch]}>
        <Text style={[s.badgeText, isSuper && s.badgeTextSuper, isPartial && s.badgeTextPartial]}>
          {isSuper ? 'SUPER' : isPartial ? 'PARTIAL' : 'MATCH'}
        </Text>
      </View>
    </View>
  );
}

function MismatchItem({ mismatch }: { mismatch: Mismatch }) {
  const iSuperPass = mismatch.myType === 'super' && mismatch.partnerType === 'pass';
  const theySuperPass = mismatch.partnerType === 'super' && mismatch.myType === 'pass';
  const isSuperMismatch = iSuperPass || theySuperPass;

  const myLabel = mismatch.myType === 'super' ? 'You super liked' : mismatch.myType === 'like' ? 'You liked' : 'You passed';
  const theirLabel = mismatch.partnerType === 'super' ? 'They super liked' : mismatch.partnerType === 'like' ? 'They liked' : 'They passed';

  return (
    <View style={[s.item, isSuperMismatch && s.itemSuperMismatch]}>
      <View style={s.itemLeft}>
        <View>
          <Text style={s.itemName}>{mismatch.name.name}</Text>
          <Text style={s.itemSub}>{mismatch.name.origin}</Text>
          <Text style={[s.mismatchDetail, isSuperMismatch && { color: '#FF8C00' }]}>
            {myLabel} · {theirLabel}
          </Text>
        </View>
      </View>
      {isSuperMismatch && (
        <View style={s.badgeSuperMismatch}>
          <Text style={s.badgeTextSuperMismatch}>SUPER</Text>
        </View>
      )}
    </View>
  );
}

interface LikedName {
  name: BabyName;
  swipeType: SwipeType;
}

function LikesSection() {
  const session = useSessionStore((s) => s.appSession);
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<'first' | 'middle'>('first');

  const { likedFirst, likedMiddle } = useMemo(() => {
    const swipes = session?.mySwipes ?? [];
    const toNames = (mode: string): LikedName[] =>
      swipes
        .filter((s) => s.deckMode === mode && s.type !== 'pass' && s.nameId != null)
        .map((s) => {
          const name = BABY_NAMES.find((n) => n.id === s.nameId);
          return name ? { name, swipeType: s.type } : null;
        })
        .filter(Boolean) as LikedName[];
    // Super likes first, then regular likes
    const sort = (arr: LikedName[]) =>
      [...arr].sort((a, b) => (b.swipeType === 'super' ? 1 : 0) - (a.swipeType === 'super' ? 1 : 0));
    return { likedFirst: sort(toNames('first')), likedMiddle: sort(toNames('middle')) };
  }, [session?.mySwipes]);

  if (likedFirst.length === 0 && likedMiddle.length === 0) return null;

  const active = tab === 'first' ? likedFirst : likedMiddle;
  const color = tab === 'first' ? '#4A90E2' : '#50C878';

  return (
    <View style={s.likesSection}>
      <TouchableOpacity style={s.likesHeader} onPress={() => setExpanded((e) => !e)}>
        <View>
          <Text style={s.likesSectionTitle}>Your Liked Names</Text>
          <Text style={s.mismatchSubtitle}>
            {likedFirst.length} first · {likedMiddle.length} middle
          </Text>
        </View>
        <Text style={s.likesChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <>
          {/* Tab row */}
          <View style={s.likesTabs}>
            {(['first', 'middle'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.likesTab, tab === t && { borderBottomColor: color, borderBottomWidth: 2 }]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.likesTabText, tab === t && { color }]}>
                  {t === 'first' ? `First (${likedFirst.length})` : `Middle (${likedMiddle.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.likesGroup}>
            {active.length === 0 ? (
              <Text style={s.likesEmpty}>No {tab} names liked yet</Text>
            ) : (
              <View style={s.chips}>
                {active.map(({ name, swipeType }) => (
                  <View key={name.id} style={[s.chip, { borderColor: swipeType === 'super' ? '#ffd700' : color }]}>
                    {swipeType === 'super' && <Text style={s.chipStar}>★ </Text>}
                    <Text style={[s.chipName, { color: swipeType === 'super' ? '#ffd700' : color }]}>
                      {name.name}
                    </Text>
                    <Text style={s.chipSub}>{name.origin} · {name.meaning}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

export default function MatchesScreen() {
  const session = useSessionStore((s) => s.appSession);
  const loadPartnerSwipes = useSessionStore((s) => s.loadPartnerSwipes);
  const [showMismatches, setShowMismatches] = useState(true);

  useEffect(() => {
    loadPartnerSwipes();
  }, []);

  const { superMatches, fullMatches, partialMatches } = useMemo(() => {
    const matches = session?.matches ?? [];
    return {
      superMatches: matches.filter((m) => m.matchType === 'super_match'),
      fullMatches: matches.filter((m) => m.matchType === 'match'),
      partialMatches: matches.filter((m) => m.matchType.startsWith('partial')),
    };
  }, [session?.matches]);

  const mismatches = useMemo((): Mismatch[] => {
    if (!session?.partnerId) return [];
    const myMap = new Map<number, SwipeType>();
    for (const s of session.mySwipes) {
      if (s.nameId != null) myMap.set(s.nameId, s.type);
    }
    const partnerMap = new Map<number, SwipeType>();
    for (const s of session.partnerSwipes) {
      if (s.nameId != null) partnerMap.set(s.nameId, s.type);
    }

    const result: Mismatch[] = [];
    const seen = new Set<number>();

    for (const [nameId, myType] of myMap) {
      const partnerType = partnerMap.get(nameId);
      if (!partnerType) continue;
      const isMismatch = (myType === 'pass') !== (partnerType === 'pass');
      if (!isMismatch) continue;
      seen.add(nameId);
      const name = BABY_NAMES.find((n) => n.id === nameId);
      if (name) result.push({ name, myType, partnerType });
    }

    for (const [nameId, partnerType] of partnerMap) {
      if (seen.has(nameId)) continue;
      const myType = myMap.get(nameId);
      if (!myType) continue;
      const isMismatch = (myType === 'pass') !== (partnerType === 'pass');
      if (!isMismatch) continue;
      const name = BABY_NAMES.find((n) => n.id === nameId);
      if (name) result.push({ name, myType, partnerType });
    }

    // Super mismatches first
    return result.sort((a, b) => {
      const aSuper = a.myType === 'super' || a.partnerType === 'super' ? 1 : 0;
      const bSuper = b.myType === 'super' || b.partnerType === 'super' ? 1 : 0;
      return bSuper - aSuper;
    });
  }, [session?.mySwipes, session?.partnerSwipes, session?.partnerId]);

  const allMatches = [...superMatches, ...fullMatches, ...partialMatches];

  async function handleShare() {
    const names = allMatches
      .map((m) => {
        const name = m.combo
          ? `${m.combo.firstName.name} ${m.combo.middleName.name}`
          : m.name?.name ?? '';
        const tag = m.matchType === 'super_match' ? ' (super)' : '';
        return `• ${name}${tag}`;
      })
      .join('\n');
    const lastName = session?.lastName ? ` ${session.lastName}` : '';
    await Share.share({
      message: `Our baby name matches${lastName ? ' for baby' + lastName : ''}:\n\n${names}\n\nFound with BabyNames app`,
    });
  }

  const ListFooter = (
    <>
      {mismatches.length > 0 && (
        <View style={s.likesSection}>
          <TouchableOpacity style={s.likesHeader} onPress={() => setShowMismatches((v) => !v)}>
            <View>
              <Text style={s.likesSectionTitle}>Mismatches</Text>
              <Text style={s.mismatchSubtitle}>{mismatches.length} name{mismatches.length !== 1 ? 's' : ''} you disagree on</Text>
            </View>
            <Text style={s.likesChevron}>{showMismatches ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showMismatches && mismatches.map((m) => (
            <MismatchItem key={m.name.id} mismatch={m} />
          ))}
        </View>
      )}
      <LikesSection />
    </>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNum}>{superMatches.length}</Text>
            <Text style={s.statLabel}>Super</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{fullMatches.length}</Text>
            <Text style={s.statLabel}>Matches</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{partialMatches.length}</Text>
            <Text style={s.statLabel}>Partial</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: '#FF8C00' }]}>{mismatches.length}</Text>
            <Text style={s.statLabel}>Mismatches</Text>
          </View>
        </View>
        {allMatches.length > 0 && (
          <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
            <Text style={s.shareBtnText}>Share List</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={allMatches}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => <MatchItem match={item} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No matches yet</Text>
            <Text style={s.emptyText}>
              Matches appear when you and your partner both like the same name.
            </Text>
          </View>
        }
        ListFooterComponent={ListFooter}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800', color: '#E91E8C' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  shareBtn: {
    backgroundColor: '#16213e', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#E91E8C',
  },
  shareBtnText: { color: '#E91E8C', fontWeight: '700' },
  list: { padding: 16, gap: 10 },
  item: {
    backgroundColor: '#16213e', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#333',
  },
  itemSuper: { borderColor: '#ffd700', backgroundColor: '#1e1a00' },
  itemPartial: { borderColor: '#9B59B6', backgroundColor: '#1a0f2e' },
  itemSuperMismatch: { borderColor: '#FF8C00', backgroundColor: '#1e1200' },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  itemSub: { fontSize: 13, color: '#888', marginTop: 2 },
  mismatchDetail: { fontSize: 12, color: '#666', marginTop: 4 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeMatch: { backgroundColor: '#1f0e1a' },
  badgeSuper: { backgroundColor: '#2a2000' },
  badgePartial: { backgroundColor: '#1a0f2e' },
  badgeSuperMismatch: { backgroundColor: '#2a1800', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#E91E8C' },
  badgeTextSuper: { color: '#ffd700' },
  badgeTextPartial: { color: '#9B59B6' },
  badgeTextSuperMismatch: { fontSize: 11, fontWeight: '700', color: '#FF8C00' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText: { color: '#888', textAlign: 'center', lineHeight: 22 },
  likesSection: {
    marginTop: 8, backgroundColor: '#16213e', borderRadius: 16,
    borderWidth: 1, borderColor: '#333', overflow: 'hidden',
  },
  likesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  likesSectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  mismatchSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  likesChevron: { color: '#666', fontSize: 12 },
  likesGroup: { paddingHorizontal: 16, paddingBottom: 16 },
  likesGroupLabel: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#0d1b2a', minWidth: 80,
  },
  chipStar: { fontSize: 11, color: '#ffd700' },
  chipName: { fontSize: 15, fontWeight: '700' },
  chipSub: { fontSize: 11, color: '#666', marginTop: 2 },
  likesTabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222',
    marginHorizontal: 16, marginBottom: 4,
  },
  likesTab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  likesTabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  likesEmpty: { color: '#555', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
