import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Couch, CustomName, Duel, Gender, GenderFilter, HistoryEntry, OutboxOp, Session, Stack, Swipe, SwipeType } from '../types';
import { isMatchPair, outboxKey } from '../types';
import * as api from '../lib/supabase';
import { ID_BY_SPELLING, NAMES_BY_ID, nameSlug } from '../data/names';
import { buildStack, packById, type PackContext } from '../lib/packs';
import { dayKey } from '../lib/random';
import { computeMatches } from '../lib/matches';

type SyncStatus = 'idle' | 'syncing' | 'offline';

interface State {
  userId: string | null;
  email: string | null;
  session: Session | null;
  mine: Record<string, Swipe>;
  partner: Record<string, Swipe>;
  custom: CustomName[];
  /** Girl / Boy / Either, as you two think of each name. Falls back to the data's gender. */
  tags: Record<string, Gender>;
  duels: Duel[];
  /** This or That on your own yeses. Stays on this phone, so it never hints at names your partner hasn't matched. */
  myDuels: Duel[];
  couch: Couch | null;
  outbox: Record<string, OutboxOp>;
  history: HistoryEntry[];
  stacks: Record<string, Stack>;
  /** Matches newer than this get a NEW tag on Our names. */
  listSeenAt: number;
  justCreated: boolean;
  /** Set when a name you just answered becomes a match, even if your partner's yes landed a moment later. The deck shows it. */
  matchAlert: { itemId: string; n: number } | null;
  /** You closed the "add a backup email" nudge. */
  emailNudgeDismissed: boolean;
  sync: SyncStatus;
  error: string | null;

  init: () => Promise<void>;
  createSession: (lastName: string, filter: GenderFilter, myName: string) => Promise<void>;
  joinSession: (code: string, myName: string) => Promise<void>;
  /** Both of you started a list: move to your partner's, bringing your answers along. */
  joinPartnerList: (code: string) => Promise<void>;
  signedInWithEmail: (userId: string, email: string) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  refresh: () => Promise<void>;
  flush: () => Promise<void>;

  /** Answer a name from a deck. Returns true when it makes a new match. */
  swipe: (itemId: string, type: SwipeType) => boolean;
  /** Change or clear an answer from a list. */
  setAnswer: (itemId: string, type: SwipeType | null) => void;
  undo: () => string | null;
  resetMyAnswers: () => Promise<void>;

  packContext: () => PackContext;
  openStack: (packId: string, fresh?: boolean) => Stack;

  /** asTyped keeps your spelling as its own name even when it's another spelling of a listed one. */
  addName: (raw: string, gender: Gender, opts?: { asTyped?: boolean; love?: boolean }) => string;
  setTag: (itemId: string, gender: Gender) => void;
  addDuel: (winner: string, loser: string) => void;
  addMyDuel: (winner: string, loser: string) => void;
  startCouch: () => Promise<void>;
  allowRejoin: () => Promise<void>;
  dismissEmailNudge: () => void;
  endCouch: () => Promise<void>;
  updateSettings: (patch: { lastName?: string; genderFilter?: GenderFilter; myName?: string }) => void;
  setEmail: (email: string) => void;
  markListSeen: () => void;
  clearJustCreated: () => void;
}

let channel: RealtimeChannel | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshRun = 0;
let flushing = false;

const emptySession = () => ({
  session: null,
  mine: {},
  partner: {},
  custom: [],
  tags: {},
  duels: [],
  myDuels: [],
  couch: null,
  outbox: {},
  history: [],
  stacks: {},
  listSeenAt: Date.now(),
  justCreated: false,
  matchAlert: null,
});

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

export const useStore = create<State>()(
  persist(
    (set, get) => {
      function subscribe(sessionId: string) {
        channel?.unsubscribe();
        channel = api.subscribeToSession(
          sessionId,
          () => {
            // Changes arrive in bursts; one refetch per burst.
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => get().refresh(), 350);
          },
          // Live updates dropped (phone slept, network blip): catch up, then reconnect.
          () => {
            get().refresh();
            setTimeout(() => {
              if (get().session?.id === sessionId) subscribe(sessionId);
            }, 3000);
          }
        );
      }

      function queue(op: OutboxOp) {
        set((s) => ({ outbox: { ...s.outbox, [outboxKey(op)]: op } }));
        get().flush();
      }

      function write(itemId: string, type: SwipeType | null, added?: boolean) {
        const prev = get().mine[itemId] ?? null;
        const now = Date.now();
        const isAdded = added || prev?.added;
        set((s) => {
          const mine = { ...s.mine };
          if (type) mine[itemId] = { itemId, type, createdAt: prev?.createdAt ?? now, updatedAt: now, ...(isAdded && { added: true }) };
          else delete mine[itemId];
          return { mine };
        });
        queue(type ? { kind: 'upsert', itemId, type, ...(isAdded && { added: true }) } : { kind: 'delete', itemId });
        return prev;
      }

      function alertMatch(itemId: string) {
        set((s) => ({ matchAlert: { itemId, n: (s.matchAlert?.n ?? 0) + 1 } }));
      }

      async function enter(sessionId: string, justCreated = false) {
        set({ ...emptySession(), justCreated, session: { id: sessionId, code: '', lastName: '', genderFilter: 'all', partner: null, myName: '' } });
        subscribe(sessionId);
        await get().refresh();
      }

      const offline = () => set({ sync: 'offline' });

      return {
        userId: null,
        email: null,
        ...emptySession(),
        sync: 'idle',
        error: null,
        emailNudgeDismissed: false,

        init: async () => {
          try {
            const user = await api.ensureUser();
            set({ userId: user.id, email: user.email, error: null });
          } catch (e: any) {
            set({ error: e.message, sync: 'offline' });
            return;
          }
          const { session } = get();
          if (session) {
            subscribe(session.id);
            get().refresh();
            return;
          }
          // Same account, local data cleared (reinstalled the home-screen app): find the list again.
          const found = await api.findMySession().catch(() => null);
          if (found) await enter(found);
        },

        createSession: async (lastName, filter, myName) => {
          const id = await api.createSession(lastName.trim(), filter, myName.trim());
          await enter(id, true);
        },

        joinSession: async (code, myName) => {
          const id = await api.joinSession(code.trim().toUpperCase(), myName.trim());
          await enter(id);
        },

        joinPartnerList: async (raw) => {
          const { session, mine, custom } = get();
          if (!session) return;
          const code = raw.trim().toUpperCase();
          if (code === session.code) throw new Error('That’s your own code. Type the one on your partner’s phone.');
          // Join first, so a wrong code leaves everything as it was.
          const id = await api.joinSession(code, session.myName);
          const carried = Object.values(mine);
          await api.leaveSession(session.id).catch(() => {});
          await enter(id);
          for (const c of custom) await api.addCustomName(id, c).catch(() => {});
          set((s) => ({
            mine: { ...Object.fromEntries(carried.map((x) => [x.itemId, x])), ...s.mine },
            outbox: { ...Object.fromEntries(carried.map((x) => [x.itemId, { kind: 'upsert' as const, itemId: x.itemId, type: x.type }])), ...s.outbox },
          }));
          await get().flush();
          await get().refresh();
        },

        signedInWithEmail: async (userId, email) => {
          channel?.unsubscribe();
          set({ ...emptySession(), userId, email });
          const found = await api.findMySession();
          if (!found) return false;
          await enter(found);
          return true;
        },

        leaveSession: async () => {
          const { session } = get();
          channel?.unsubscribe();
          channel = null;
          if (session) await api.leaveSession(session.id).catch(() => {});
          set(emptySession());
        },

        refresh: async () => {
          const { session, userId } = get();
          if (!session || !userId) return;
          set({ sync: 'syncing' });
          const run = ++refreshRun;
          try {
            const [fresh, swipes, extras] = await Promise.all([
              api.fetchSession(session.id, userId),
              api.fetchAllSwipes(session.id),
              api.fetchExtras(session.id),
            ]);
            // A newer refresh started while this one was loading: let that one win, so old data never overwrites new.
            if (run !== refreshRun) return;
            const mine: Record<string, Swipe> = Object.fromEntries((swipes[userId] ?? []).map((s) => [s.itemId, s]));
            const partnerId = fresh.partner?.userId;
            const partner: Record<string, Swipe> = Object.fromEntries((partnerId ? swipes[partnerId] ?? [] : []).map((s) => [s.itemId, s]));
            // The server is the truth for my answers, except writes still waiting to send.
            const before = get();
            const local = before.mine;
            const custom = [...extras.custom];
            const tags = { ...extras.tags };
            const duels = [...extras.duels];
            for (const op of Object.values(before.outbox)) {
              if (op.kind === 'delete') delete mine[op.itemId];
              else if (op.kind === 'upsert') mine[op.itemId] = local[op.itemId] ?? { itemId: op.itemId, type: op.type, createdAt: Date.now(), updatedAt: Date.now() };
              else if (op.kind === 'custom') !custom.some((c) => c.id === op.name.id) && custom.push(op.name);
              else if (op.kind === 'tag') tags[op.itemId] = op.gender;
              else if (op.kind === 'duel') !duels.some((d) => d.id === op.duel.id) && duels.push(op.duel);
            }
            // Your partner's yes landed just after yours: still tell you it's a match.
            const had = new Set(computeMatches(before.mine, before.partner).map((m) => m.itemId));
            const fresh2 = computeMatches(mine, partner).filter((m) => !had.has(m.itemId) && mine[m.itemId].updatedAt > Date.now() - 120_000);
            // A filter change from either phone: stacks dealt under the old one would show the wrong names.
            const filterChanged = before.session?.genderFilter !== fresh.genderFilter && !!before.session?.code;
            set({ session: fresh, mine, partner, custom, tags, duels, couch: extras.couch, sync: 'idle', ...(filterChanged && { stacks: {} }) });
            if (fresh2.length) alertMatch(fresh2[fresh2.length - 1].itemId);
            get().flush();
          } catch {
            set({ sync: 'offline' });
          }
        },

        flush: async () => {
          const { session, userId } = get();
          if (!session || !userId || flushing) return;
          flushing = true;
          try {
            for (const [id, op] of Object.entries(get().outbox)) {
              if (op.kind === 'upsert') await api.upsertSwipe(session.id, op.itemId, op.type, op.added);
              else if (op.kind === 'delete') await api.deleteSwipe(session.id, userId, op.itemId);
              else if (op.kind === 'custom') await api.addCustomName(session.id, op.name);
              else if (op.kind === 'tag') await api.setNameTag(session.id, op.itemId, op.gender);
              else if (op.kind === 'duel') await api.addDuel(session.id, op.duel);
              // Only clear it if no newer change replaced it while sending.
              set((s) => {
                if (s.outbox[id] !== op) return {};
                const { [id]: _, ...rest } = s.outbox;
                return { outbox: rest };
              });
            }
            if (get().sync === 'offline') set({ sync: 'idle' });
          } catch {
            set({ sync: 'offline' });
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => get().flush(), 10_000);
          } finally {
            flushing = false;
          }
          if (Object.keys(get().outbox).length && get().sync !== 'offline') get().flush();
        },

        swipe: (itemId, type) => {
          const before = get().mine[itemId];
          const wasMatch = isMatchPair(before?.type, get().partner[itemId]?.type);
          const prev = write(itemId, type);
          // Answering the same card twice in a row (key repeat) keeps one undo step, which goes back to the first answer.
          set((s) => (s.history.at(-1)?.itemId === itemId ? {} : { history: [...s.history.slice(-49), { itemId, prev }] }));
          const matched = !wasMatch && isMatchPair(type, get().partner[itemId]?.type);
          if (matched) alertMatch(itemId);
          return matched;
        },

        setAnswer: (itemId, type) => {
          write(itemId, type);
        },

        undo: () => {
          const last = get().history[get().history.length - 1];
          if (!last) return null;
          set((s) => ({ history: s.history.slice(0, -1) }));
          if (last.prev) {
            set((s) => ({ mine: { ...s.mine, [last.itemId]: last.prev! } }));
            queue({ kind: 'upsert', itemId: last.itemId, type: last.prev.type, ...(last.prev.added && { added: true }) });
          } else write(last.itemId, null);
          return last.itemId;
        },

        resetMyAnswers: async () => {
          const { session, userId } = get();
          if (!session || !userId) return;
          try {
            await api.deleteAllMySwipes(session.id, userId);
          } catch {
            throw new Error('You’re offline. Try again when you have signal.');
          }
          set((s) => ({ mine: {}, outbox: Object.fromEntries(Object.entries(s.outbox).filter(([, op]) => op.kind !== 'upsert' && op.kind !== 'delete')), history: [], stacks: {} }));
        },

        packContext: () => {
          const s = get();
          return {
            custom: s.custom,
            filter: s.session?.genderFilter ?? 'all',
            mine: s.mine,
            partner: s.partner,
            // Same seed on both phones, so Today's 10 is mostly the same ten names for both of you.
            seed: s.session?.id ?? 'local',
            // Only this phone's: where your partner's yeses land in a stack, so the order never gives them away.
            me: s.userId ?? 'me',
            partnerName: s.session?.partner?.displayName ?? '',
          };
        },

        openStack: (packId, fresh = false) => {
          const existing = get().stacks[packId];
          const today = dayKey();
          const { mine } = get();
          // A stack you finished earlier deals new names instead of reopening its old summary.
          const finished = !!existing && existing.items.length > 0 && existing.items.every((id) => mine[id] && mine[id].updatedAt >= existing.startedAt);
          if (existing && !fresh && !finished && (packId !== 'today' || existing.day === today)) return existing;
          const pack = packById(packId);
          const items = pack ? buildStack(pack, get().packContext()) : [];
          const stack: Stack = { packId, items, startedAt: Date.now(), day: today };
          set((s) => ({ stacks: { ...s.stacks, [packId]: stack } }));
          return stack;
        },

        addName: (raw, gender, opts = {}) => {
          const { custom } = get();
          const name = raw.trim().replace(/\s+/g, ' ');
          const typed = nameSlug(name);
          if (!typed) throw new Error('Type a name first');
          // Another spelling of a listed name answers that name's card, unless you want your spelling.
          const id = opts.asTyped && !NAMES_BY_ID[typed] ? typed : ID_BY_SPELLING[typed] ?? typed;
          if (!NAMES_BY_ID[id] && !custom.some((c) => c.id === id)) {
            // Keep it as typed, just capitalising each part: "mary kate" → "Mary Kate", "anne-marie" → "Anne-Marie".
            const c: CustomName = { id, name: name.replace(/(^|[\s'-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase()), gender };
            set((s) => ({ custom: [...s.custom, c] }));
            queue({ kind: 'custom', itemId: id, name: c });
          }
          // Counts as your yes (or Love); your partner gets it first in Today's 10.
          const want: SwipeType = opts.love ? 'super' : 'like';
          const cur = get().mine[id];
          if (cur?.type !== want && !(cur?.type === 'super' && want === 'like')) write(id, want, true);
          else if (!cur.added) write(id, cur.type, true);
          return id;
        },

        setTag: (itemId, gender) => {
          set((s) => ({ tags: { ...s.tags, [itemId]: gender } }));
          queue({ kind: 'tag', itemId, gender });
        },

        addDuel: (winner, loser) => {
          const { userId } = get();
          if (!userId) return;
          const duel: Duel = { id: newId(), userId, winner, loser, at: Date.now() };
          set((s) => ({ duels: [...s.duels, duel] }));
          queue({ kind: 'duel', itemId: duel.id!, duel });
        },

        addMyDuel: (winner, loser) => set((s) => ({ myDuels: [...s.myDuels, { userId: s.userId ?? 'me', winner, loser, at: Date.now() }] })),

        startCouch: async () => {
          const { session, userId } = get();
          if (!session || !userId) return;
          const seed = Math.random().toString(36).slice(2, 10);
          // Server first: offline, nothing starts and the caller shows the error.
          try {
            await api.setCouch(session.id, true, seed);
          } catch {
            throw new Error('You’re offline. Couch mode needs both phones online.');
          }
          set({ couch: { startedBy: userId, seed, active: true, startedAt: Date.now() } });
        },

        allowRejoin: async () => {
          const { session } = get();
          if (!session) return;
          await api.allowRejoin(session.id);
        },

        dismissEmailNudge: () => set({ emailNudgeDismissed: true }),

        endCouch: async () => {
          const { session, couch } = get();
          if (!session || !couch || !couch.active) return;
          set({ couch: { ...couch, active: false } });
          await api.setCouch(session.id, false).catch(offline);
        },

        updateSettings: (patch) => {
          const { session, userId } = get();
          if (!session || !userId) return;
          set({ session: { ...session, ...patch } });
          if (patch.lastName !== undefined || patch.genderFilter !== undefined) {
            api
              .updateSession(session.id, {
                ...(patch.lastName !== undefined && { last_name: patch.lastName }),
                ...(patch.genderFilter !== undefined && { gender_filter: patch.genderFilter }),
              })
              .catch(offline);
            // Stacks dealt under the old filter would show the wrong names.
            if (patch.genderFilter !== undefined) set({ stacks: {} });
          }
          if (patch.myName !== undefined && patch.myName) api.updateMe(session.id, userId, { display_name: patch.myName }).catch(offline);
        },

        setEmail: (email) => set({ email }),
        markListSeen: () => set({ listSeenAt: Date.now() }),
        clearJustCreated: () => set({ justCreated: false }),
      };
    },
    {
      name: 'babynames-v3',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        session: s.session,
        mine: s.mine,
        partner: s.partner,
        custom: s.custom,
        tags: s.tags,
        duels: s.duels,
        myDuels: s.myDuels,
        couch: s.couch,
        outbox: s.outbox,
        history: s.history,
        stacks: s.stacks,
        listSeenAt: s.listSeenAt,
        justCreated: s.justCreated,
        emailNudgeDismissed: s.emailNudgeDismissed,
      }),
    }
  )
);

/** How you two think of a name: your tag if you set one, otherwise the data's gender. */
export function genderOf(itemId: string, tags: Record<string, Gender>, fallback: Gender): Gender {
  return tags[itemId] ?? fallback;
}
