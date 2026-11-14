import type { Match, Swipe } from '../types';
import { isYesType } from '../types';

/** A match is any name both partners said yes to. Computed fresh from both swipe sets, so both phones agree. */
export function computeMatches(mine: Record<string, Swipe>, partner: Record<string, Swipe>): Match[] {
  const out: Match[] = [];
  for (const [id, m] of Object.entries(mine)) {
    const p = partner[id];
    if (!p || !isYesType(m.type) || !isYesType(p.type)) continue;
    out.push({
      itemId: id,
      iLove: m.type === 'super',
      partnerLoves: p.type === 'super',
      bothLove: m.type === 'super' && p.type === 'super',
      at: Math.max(m.updatedAt, p.updatedAt),
    });
  }
  return out;
}
