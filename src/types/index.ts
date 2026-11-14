export type Gender = 'M' | 'F' | 'N';
export type SwipeType = 'like' | 'pass' | 'super' | 'maybe';
/** Yes or Love. Maybe is neither a yes nor a veto: it never matches, and it comes back in Second look. */
export const isYesType = (t?: SwipeType | null) => t === 'like' || t === 'super';
export type GenderFilter = 'all' | 'F' | 'M' | 'N';

export interface BabyName {
  /** Slug of the name, e.g. 'josephine'. Stable across data rebuilds. */
  id: string;
  name: string;
  gender: Gender;
  origin: string;
  /** One of ORIGIN_GROUPS, used for origin packs. */
  group: string;
  meaning: string;
  syllables: number;
  /** 2024 US rank for its sex, 0 when outside the top 1000. */
  rank: number;
  /** c = family classic, r = rising, n = nature, v = virtue. */
  tags: string;
  /** Decade the name was most popular in the US, e.g. 1950. 0 when unknown. */
  peak: number;
  /** Other spellings shown on the same card, e.g. Jaxon and Jaxson on Jackson. */
  alts: string[];
  custom?: boolean;
}

export interface Swipe {
  itemId: string;
  type: SwipeType;
  /** First time this name was answered. Used for the streak. */
  createdAt: number;
  updatedAt: number;
  /** Typed in with "Add a name" rather than found in a pack. Your partner sees these first in Today's 10. */
  added?: boolean;
}

export interface Member {
  userId: string;
  displayName: string;
}

export interface Session {
  id: string;
  code: string;
  lastName: string;
  genderFilter: GenderFilter;
  partner: Member | null;
  myName: string;
}

export interface CustomName {
  id: string;
  name: string;
  gender: Gender;
}

export interface Duel {
  /** Client-made id, so a pick saved offline and retried is only stored once. */
  id?: string;
  userId: string;
  winner: string;
  loser: string;
  at: number;
}

export interface Couch {
  startedBy: string;
  seed: string;
  active: boolean;
  startedAt: number;
}

/** A pending server write. Keyed by item so a newer op replaces an older one. */
export type OutboxOp =
  | { kind: 'upsert'; itemId: string; type: SwipeType; added?: boolean }
  | { kind: 'delete'; itemId: string }
  | { kind: 'custom'; itemId: string; name: CustomName }
  | { kind: 'tag'; itemId: string; gender: Gender }
  | { kind: 'duel'; itemId: string; duel: Duel };

/** Outbox key: one slot per answer, per custom name, per tag, per pick. */
export const outboxKey = (op: OutboxOp) => (op.kind === 'upsert' || op.kind === 'delete' ? op.itemId : `${op.kind}:${op.itemId}`);

export interface Match {
  itemId: string;
  bothLove: boolean;
  iLove: boolean;
  partnerLoves: boolean;
  /** When the second person said yes. */
  at: number;
}

/** A pack in progress: a fixed list of names so leaving and coming back resumes where you were. */
export interface Stack {
  packId: string;
  items: string[];
  startedAt: number;
  /** dayKey when dealt; Today's 10 deals a new stack each day. */
  day: string;
}

/** One step back for Undo: the answer this name had before (null = unanswered). */
export interface HistoryEntry {
  itemId: string;
  prev: Swipe | null;
}
