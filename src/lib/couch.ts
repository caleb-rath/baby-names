import { BABY_NAMES } from '../data/names';
import type { Couch, CustomName, GenderFilter, Swipe } from '../types';
import { isYesType } from '../types';
import { dealWeight, lookupName, matchesFilter } from './names';
import { shuffleBy } from './random';

export const COUCH_SIZE = 20;
/** An invite counts as live for this long after it starts. */
export const COUCH_INVITE_MS = 3 * 3600_000;

/** At most this many of the 20 are names one of you already said yes to. The rest are new to both of you. */
export const COUCH_LIKED = 5;

/**
 * The names for one Couch mode game. Both phones compute the same list from the shared seed:
 * mostly names neither of you had answered when the game started (popular ones a bit more often),
 * plus up to COUCH_LIKED names one of you said yes to and the other hasn't seen, scattered through the deck.
 */
export function couchQueue(couch: Couch, custom: CustomName[], filter: GenderFilter, mine: Record<string, Swipe>, partner: Record<string, Swipe>): string[] {
  const before = (s?: Swipe) => !!s && s.createdAt < couch.startedAt - 60_000;
  const all = [...custom.map((c) => lookupName(c.id, custom)!), ...BABY_NAMES].filter((n) => matchesFilter(n, filter));
  // Symmetric (mine/partner swap on the other phone), so both phones pick the same names.
  // An answer changed since the game started was one of these liked names being asked again, so it still counts as liked.
  const wasYes = (x: Swipe) => isYesType(x.type) || x.updatedAt >= couch.startedAt - 60_000;
  const liked = all.filter((n) => {
    const a = before(mine[n.id]) ? mine[n.id] : undefined;
    const b = before(partner[n.id]) ? partner[n.id] : undefined;
    return (!!a && wasYes(a) && !b) || (!!b && wasYes(b) && !a);
  });
  const fresh = all.filter((n) => !before(mine[n.id]) && !before(partner[n.id]));
  const likedPick = shuffleBy(liked, (n) => n.id, `couch-liked:${couch.seed}`).slice(0, COUCH_LIKED).map((n) => n.id);
  const freshPick = shuffleBy(fresh, (n) => n.id, `couch:${couch.seed}`, dealWeight)
    .slice(0, COUCH_SIZE - likedPick.length)
    .map((n) => n.id);
  // Seeded slots for the liked names, never in the first two, so it doesn't open with a sure thing.
  const slots = new Set(shuffleBy(Array.from({ length: COUCH_SIZE - 2 }, (_, i) => i + 2), String, `couch-slots:${couch.seed}`).slice(0, likedPick.length));
  const out: string[] = [];
  for (let i = 0; likedPick.length || freshPick.length; i++) out.push(((slots.has(i) && likedPick.length) || !freshPick.length ? likedPick : freshPick).shift()!);
  return out;
}

export function couchLive(couch: Couch | null): couch is Couch {
  return !!couch && couch.active && Date.now() - couch.startedAt < COUCH_INVITE_MS;
}
