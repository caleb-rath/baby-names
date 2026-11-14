import { useMemo } from 'react';
import { useStore } from './useStore';
import { computeAlmost, computeMatches, type Almost } from '../lib/matches';
import { sharedStreak } from '../lib/streak';
import { lookupName } from '../lib/names';
import { appUrl, shareText } from '../lib/platform';
import type { BabyName, Gender, Match } from '../types';

export interface OurName extends Match {
  name: BabyName;
  gender: Gender;
  isNew: boolean;
}

/** Every name you both said yes to, with its Girl/Boy/Either tag. Unordered; screens choose the sort. */
export function useOurNames(): OurName[] {
  const mine = useStore((s) => s.mine);
  const partner = useStore((s) => s.partner);
  const custom = useStore((s) => s.custom);
  const tags = useStore((s) => s.tags);
  const seenAt = useStore((s) => s.listSeenAt);
  return useMemo(
    () =>
      computeMatches(mine, partner).flatMap((m) => {
        const name = lookupName(m.itemId, custom);
        if (!name) return [];
        return [{ ...m, name, gender: tags[m.itemId] ?? name.gender, isNew: m.at > seenAt }];
      }),
    [mine, partner, custom, tags, seenAt]
  );
}

export interface AlmostName extends Almost {
  name: BabyName;
}

/** Maybe + Yes and Maybe + Maybe, newest first. */
export function useAlmostNames(): AlmostName[] {
  const mine = useStore((s) => s.mine);
  const partner = useStore((s) => s.partner);
  const custom = useStore((s) => s.custom);
  return useMemo(
    () =>
      computeAlmost(mine, partner)
        .flatMap((a) => {
          const name = lookupName(a.itemId, custom);
          return name ? [{ ...a, name }] : [];
        })
        .sort((a, b) => b.at - a.at),
    [mine, partner, custom]
  );
}

export function useStreak() {
  const mine = useStore((s) => s.mine);
  const partner = useStore((s) => s.partner);
  return useMemo(() => sharedStreak(mine, partner), [mine, partner]);
}

export function usePartnerName(fallback = 'your partner') {
  return useStore((s) => s.session?.partner?.displayName || fallback);
}

/** Starts a Couch mode game and texts your partner the link. Throws when offline. */
export async function startCouchAndInvite() {
  await useStore.getState().startCouch();
  shareText('Couch mode? Tap to join:', appUrl({ couch: '1' })).catch(() => {});
}
