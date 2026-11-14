import type { Duel } from '../types';
import { hash } from './random';

/** Elo over all This or That picks from both of you. Names never compared stay at 1000. */
export function duelScores(duels: Duel[]): Record<string, number> {
  const score: Record<string, number> = {};
  const K = 32;
  for (const d of [...duels].sort((a, b) => a.at - b.at)) {
    const w = score[d.winner] ?? 1000;
    const l = score[d.loser] ?? 1000;
    const expected = 1 / (1 + Math.pow(10, (l - w) / 400));
    score[d.winner] = w + K * (1 - expected);
    score[d.loser] = l - K * (1 - expected);
  }
  return score;
}

/** Picks the next pair: the least-compared names first, then names with close scores. */
export function nextPair(ids: string[], myDuels: Duel[], scores: Record<string, number>, seed: string): [string, string] | null {
  if (ids.length < 2) return null;
  const count: Record<string, number> = {};
  const seen = new Set<string>();
  for (const d of myDuels) {
    count[d.winner] = (count[d.winner] ?? 0) + 1;
    count[d.loser] = (count[d.loser] ?? 0) + 1;
    seen.add([d.winner, d.loser].sort().join('|'));
  }
  const order = [...ids].sort((a, b) => (count[a] ?? 0) - (count[b] ?? 0) || (hash(seed + a) - hash(seed + b)));
  const a = order[0];
  const candidates = order
    .slice(1)
    .filter((b) => !seen.has([a, b].sort().join('|')))
    .sort((x, y) => Math.abs((scores[x] ?? 1000) - (scores[a] ?? 1000)) - Math.abs((scores[y] ?? 1000) - (scores[a] ?? 1000)));
  if (candidates.length) return [a, candidates[0]];
  // Every pair with `a` is done; fall back to any unseen pair.
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++) if (!seen.has([order[i], order[j]].sort().join('|'))) return [order[i], order[j]];
  return null;
}
