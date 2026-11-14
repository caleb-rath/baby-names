import { NAMES_BY_ID } from '../data/names';
import type { BabyName, CustomName, GenderFilter } from '../types';

export function lookupName(id: string, custom: CustomName[]): BabyName | undefined {
  const built = NAMES_BY_ID[id];
  if (built) return built;
  const c = custom.find((n) => n.id === id);
  return c && { ...c, origin: 'Added by you two', group: 'Other', meaning: '', syllables: 0, rank: 0, tags: '', peak: 0, alts: [], custom: true };
}

export function popularityLabel(rank: number): string | null {
  if (!rank) return 'Rare';
  if (rank <= 100) return 'Top 100';
  if (rank <= 500) return 'Popular';
  return 'Uncommon';
}

export function matchesFilter(n: BabyName, filter: GenderFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'N') return n.gender === 'N';
  return n.gender === filter || n.gender === 'N';
}

export const GENDER_LABEL = { F: 'Girl', M: 'Boy', N: 'Either' } as const;

/** Something true about every name, for cards with no known meaning: when it was popular. */
export function eraLine(n: BabyName): string | null {
  if (n.custom) return 'Added by you two';
  if (!n.peak) return null;
  if (n.peak >= 2010) return n.tags.includes('r') ? 'Rising fast right now' : 'Most popular right now';
  return `Most popular in the ${n.peak}s`;
}

export function altsLine(n: BabyName): string | null {
  return n.alts.length ? `Also spelled ${n.alts.slice(0, 3).join(', ')}` : null;
}
