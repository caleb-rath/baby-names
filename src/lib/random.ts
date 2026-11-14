export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  // Final mix, so keys that differ only in the last character ("…:12", "…:13") don't land next to each other.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stable pseudo-random order: each item's position comes from hash(seed + id). */
export function shuffleBy<T>(items: T[], id: (t: T) => string, seed: string, weight: (t: T) => number = () => 1): T[] {
  return items
    .map((item) => ({ item, k: Math.pow((hash(`${seed}:${id(item)}`) + 1) / 4294967297, 1 / weight(item)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.item);
}

export function dayKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
