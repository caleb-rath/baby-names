import type { Match, Swipe } from '../types';
import { isAlmostPair, isMatchPair } from '../types';

/** Both said Yes or Love, or one loves it and the other said maybe. Computed fresh from both swipe sets, so both phones agree. */
export function computeMatches(mine: Record<string, Swipe>, partner: Record<string, Swipe>): Match[] {
  const out: Match[] = [];
  for (const [id, m] of Object.entries(mine)) {
    const p = partner[id];
    if (!p || !isMatchPair(m.type, p.type)) continue;
    out.push({
      itemId: id,
      iLove: m.type === 'super',
      partnerLoves: p.type === 'super',
      bothLove: m.type === 'super' && p.type === 'super',
      maybeBy: m.type === 'maybe' ? 'me' : p.type === 'maybe' ? 'partner' : undefined,
      at: Math.max(m.updatedAt, p.updatedAt),
    });
  }
  return out;
}

export interface Almost {
  itemId: string;
  /** Who said maybe. */
  maybeBy: 'me' | 'partner' | 'both';
  at: number;
}

/** Maybe + Yes or Maybe + Maybe: not on the list yet, waiting for one of you to decide. */
export function computeAlmost(mine: Record<string, Swipe>, partner: Record<string, Swipe>): Almost[] {
  const out: Almost[] = [];
  for (const [id, m] of Object.entries(mine)) {
    const p = partner[id];
    if (!p || !isAlmostPair(m.type, p.type)) continue;
    out.push({
      itemId: id,
      maybeBy: m.type === 'maybe' && p.type === 'maybe' ? 'both' : m.type === 'maybe' ? 'me' : 'partner',
      at: Math.max(m.updatedAt, p.updatedAt),
    });
  }
  return out;
}
