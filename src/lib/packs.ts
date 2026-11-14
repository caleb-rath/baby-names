import { BABY_NAMES, ORIGIN_GROUPS } from '../data/names';
import type { BabyName, CustomName, GenderFilter, Swipe } from '../types';
import { isYesType } from '../types';
import { lookupName, matchesFilter } from './names';
import { dayKey, hash, shuffleBy } from './random';

export const STACK_SIZE = 10;
const SECOND_LOOK_DAYS = 30;

export interface PackContext {
  custom: CustomName[];
  filter: GenderFilter;
  mine: Record<string, Swipe>;
  partner: Record<string, Swipe>;
  seed: string;
  /** This phone's own seed (your user id). Never shared, so your partner can't predict where their yeses land. */
  me: string;
  partnerName: string;
}

export interface Pack {
  id: string;
  title: (ctx: PackContext) => string;
  subtitle: string;
  tint: number;
  /** Every name this pack could still show you, in the order it would show them. */
  pool: (ctx: PackContext) => string[];
}

const all = (ctx: PackContext): BabyName[] => [
  ...ctx.custom.map((c) => lookupName(c.id, ctx.custom)!),
  ...BABY_NAMES.filter((n) => !ctx.custom.some((c) => c.id === n.id)),
];
const unanswered = (ctx: PackContext, pred: (n: BabyName) => boolean) =>
  all(ctx).filter((n) => !ctx.mine[n.id] && matchesFilter(n, ctx.filter) && pred(n));

/**
 * Stable shuffle, with names your partner already said yes to mixed in, about one card in three.
 * Where they land is random per phone, so the position never tells you how your partner answered.
 * The card never says your partner liked it, so it doesn't sway you; it just makes matches come sooner.
 */
function order(ctx: PackContext, names: BabyName[], packSeed: string, weighted = false): string[] {
  const shuffled = shuffleBy(names, (n) => n.id, `${ctx.seed}:${packSeed}`, weighted ? (n) => (n.rank && n.rank <= 300 ? 3 : n.rank ? 2 : 1) : undefined);
  const yes = (n: BabyName) => isYesType(ctx.partner[n.id]?.type);
  const boosted = shuffled.filter(yes);
  const rest = shuffled.filter((n) => !yes(n));
  const out: string[] = [];
  for (let i = 0; boosted.length || rest.length; i++) {
    const pickBoosted = boosted.length && (!rest.length || hash(`${ctx.me}:${packSeed}:${i}`) % 3 === 0);
    out.push((pickBoosted ? boosted : rest).shift()!.id);
  }
  return out;
}

const tagPack = (id: string, title: string, subtitle: string, tint: number, pred: (n: BabyName) => boolean, weighted = false): Pack => ({
  id,
  title: () => title,
  subtitle,
  tint,
  pool: (ctx) => order(ctx, unanswered(ctx, pred), id, weighted),
});

export const TODAY: Pack = {
  id: 'today',
  title: () => 'Today’s 10',
  subtitle: '',
  tint: 0,
  // Names your partner added (typed in, or found with "Add a name") come first; everything else is a daily shuffle.
  pool: (ctx) => {
    const added = Object.values(ctx.partner)
      .filter((p) => p.added && isYesType(p.type) && !ctx.mine[p.itemId])
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((p) => p.itemId);
    const custom = ctx.custom.filter((c) => !ctx.mine[c.id] && !added.includes(c.id)).map((c) => c.id);
    const first = [...added, ...custom].filter((id) => {
      const n = lookupName(id, ctx.custom);
      return !!n && matchesFilter(n, ctx.filter);
    });
    return [...first, ...order(ctx, unanswered(ctx, (n) => !n.custom && !first.includes(n.id)), `today:${dayKey()}`, true)];
  },
};

export const CATCH_UP: Pack = {
  id: 'catchup',
  title: (ctx) => `Catch up with ${ctx.partnerName || 'your partner'}`,
  subtitle: '',
  tint: 1,
  // Includes their yeses and their no's, shuffled, so the pack itself doesn't hint at how they voted.
  pool: (ctx) => {
    const ids = Object.keys(ctx.partner).filter((id) => !ctx.mine[id]);
    const names = ids.map((id) => lookupName(id, ctx.custom)).filter((n): n is BabyName => !!n && matchesFilter(n, ctx.filter));
    return shuffleBy(names, (n) => n.id, `${ctx.seed}:catchup`).map((n) => n.id);
  },
};

export const SECOND_LOOK: Pack = {
  id: 'second',
  title: () => 'Second look',
  subtitle: 'Maybes and old no’s',
  tint: 2,
  pool: (ctx) => {
    const cutoff = Date.now() - SECOND_LOOK_DAYS * 86400000;
    return Object.values(ctx.mine)
      .filter((s) => s.type === 'maybe' || (s.type === 'pass' && s.updatedAt < cutoff))
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((s) => s.itemId);
  },
};

export const THEME_PACKS: Pack[] = [
  tagPack('top100', 'Top 100', '', 3, (n) => n.rank > 0 && n.rank <= 100),
  tagPack('rising', 'Rising', '', 4, (n) => n.tags.includes('r')),
  tagPack('classics', 'Family classics', 'Grandparent-era', 5, (n) => n.tags.includes('c')),
  tagPack('short', 'Short & strong', '', 6, (n) => n.syllables === 1 || (n.syllables === 2 && n.name.length <= 5)),
  tagPack('long', 'Long & lyrical', '', 1, (n) => n.syllables >= 4 || (n.syllables === 3 && n.name.length >= 8)),
  tagPack('neutral', 'Gender-neutral', '', 7, (n) => n.gender === 'N'),
  tagPack('nature', 'Nature & virtue', 'Grace, Hope, Willow', 8, (n) => n.tags.includes('n') || n.tags.includes('v')),
  tagPack('rare', 'Rare finds', '', 9, (n) => n.rank === 0 && !n.custom),
];

export const ORIGIN_PACKS: Pack[] = (ORIGIN_GROUPS as readonly string[]).filter((g) => g !== 'Other').map((g, i) => tagPack(`origin:${g}`, g, 'Origin', 10 + (i % 6), (n) => n.group === g));

export const ALL_PACKS = [TODAY, CATCH_UP, SECOND_LOOK, ...THEME_PACKS, ...ORIGIN_PACKS];

export function packById(id: string): Pack | undefined {
  return ALL_PACKS.find((p) => p.id === id);
}

export function buildStack(pack: Pack, ctx: PackContext): string[] {
  return pack.pool(ctx).slice(0, STACK_SIZE);
}
