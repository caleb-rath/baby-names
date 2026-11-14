import type { Swipe } from '../types';
import { dayKey } from './random';

/** Monday of the week t falls in, as a day key. */
export function weekKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

/**
 * Shared streak, by the week: consecutive weeks in which BOTH of you answered at least one name.
 * Weekly so night shifts, busy days and one of you playing less don't break it.
 * This week counts once you've both played; until then last week's streak is still alive.
 */
export function sharedStreak(mine: Record<string, Swipe>, partner: Record<string, Swipe>): { weeks: number; thisWeek: { me: boolean; partner: boolean } } {
  // A week counts if you answered a new name or changed an old answer (Second look).
  const weeks = (s: Record<string, Swipe>) => new Set(Object.values(s).flatMap((x) => [weekKey(x.createdAt), weekKey(x.updatedAt)]));
  const a = weeks(mine);
  const b = weeks(partner);
  const now = weekKey();
  const thisWeek = { me: a.has(now), partner: b.has(now) };
  let n = 0;
  const d = new Date();
  if (!(thisWeek.me && thisWeek.partner)) d.setDate(d.getDate() - 7);
  while (a.has(weekKey(d)) && b.has(weekKey(d))) {
    n++;
    d.setDate(d.getDate() - 7);
  }
  return { weeks: n, thisWeek };
}
