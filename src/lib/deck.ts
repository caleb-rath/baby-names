import { BABY_NAMES } from '../data/names';
import type { BabyName, CustomName, DeckMode, GenderFilter, Match } from '../types';
import { comboId, lookupName } from './names';

export interface DeckItem {
  mode: DeckMode;
  itemId: string;
  first: BabyName;
  middle?: BabyName;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Weighted shuffle: names people actually use come up more often, but rare ones still appear.
 * Each item's position comes from a hash of seed + id, so adding or removing items never reorders the rest.
 */
function weightedShuffle<T>(items: T[], id: (t: T) => string, weight: (t: T) => number, seed: string): T[] {
  return items
    .map((item) => ({ item, k: Math.pow((hash(`${seed}:${id(item)}`) + 1) / 4294967297, 1 / weight(item)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.item);
}

function matchesFilter(n: BabyName, filter: GenderFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'N') return n.gender === 'N';
  return n.gender === filter || n.gender === 'N';
}

const weight = (n: BabyName) => (n.rank && n.rank <= 300 ? 4 : n.rank ? 2.5 : 1);

/**
 * The full, stable order for a deck. Already-swiped items are filtered out by the caller,
 * so the order doesn't jump around as you swipe.
 */
export function buildDeck(opts: {
  mode: DeckMode;
  filter: GenderFilter;
  seed: string;
  custom: CustomName[];
  partnerLiked: Set<string>;
  matches: Match[];
  lockedMiddle: string | null;
}): DeckItem[] {
  const { mode, filter, seed, custom, partnerLiked, matches, lockedMiddle } = opts;

  if (mode === 'combo') {
    const firsts = matches.filter((m) => m.mode === 'first').map((m) => lookupName(m.itemId, custom));
    const middleIds = lockedMiddle ? [lockedMiddle] : matches.filter((m) => m.mode === 'middle').map((m) => m.itemId);
    const middles = middleIds.map((id) => lookupName(id, custom));
    const out: DeckItem[] = [];
    for (const f of firsts) for (const m of middles) {
      if (f && m && f.id !== m.id) out.push({ mode, itemId: comboId(f.id, m.id), first: f, middle: m });
    }
    return weightedShuffle(out, (d) => d.itemId, () => 1, `${seed}:combo`);
  }

  const customNames = custom.map((c) => lookupName(c.id, custom)!).filter((n) => matchesFilter(n, filter));
  const pool = BABY_NAMES.filter((n) => matchesFilter(n, filter));
  const shuffled = weightedShuffle(pool, (n) => n.id, weight, `${seed}:${mode}`);

  // Names your partner already liked are mixed in every third card, so first matches come quickly.
  const boosted = shuffled.filter((n) => partnerLiked.has(n.id));
  const rest = shuffled.filter((n) => !partnerLiked.has(n.id));
  const order: BabyName[] = [...customNames];
  while (boosted.length || rest.length) {
    if (rest.length) order.push(...rest.splice(0, 2));
    if (boosted.length) order.push(boosted.shift()!);
  }
  const seen = new Set<string>();
  return order
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .map((n) => ({ mode, itemId: n.id, first: n }));
}
