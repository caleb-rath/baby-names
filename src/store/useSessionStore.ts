import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CustomName, DeckMode, Gender, GenderFilter, Match, OutboxOp, Session, Swipe, SwipeType } from '../types';
import * as api from '../lib/supabase';
import { nameSlug } from '../data/names';
import { computeMatches, swipeKey } from '../lib/matches';

type SyncStatus = 'idle' | 'syncing' | 'offline';

interface State {
  userId: string | null;
  session: Session | null;
  mySwipes: Record<string, Swipe>;
  partnerSwipes: Record<string, Swipe>;
  customNames: CustomName[];
  outbox: Record<string, OutboxOp>;
  /** Swipe keys in order, for Undo. */
  history: string[];
  /** Match keys the person has already been shown. */
  seenMatches: string[];
  /** New matches waiting for the match sheet. */
  pendingMatches: Match[];
  tutorialSeen: boolean;
  justCreated: boolean;
  sync: SyncStatus;
  error: string | null;

  init: () => Promise<void>;
  createSession: (lastName: string, genderFilter: GenderFilter) => Promise<void>;
  joinSession: (code: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  refresh: () => Promise<void>;
  swipe: (mode: DeckMode, itemId: string, type: SwipeType) => void;
  changeSwipe: (mode: DeckMode, itemId: string, type: SwipeType | null) => void;
  undo: () => { mode: DeckMode; itemId: string } | null;
  resetMySwipes: () => Promise<void>;
  addCustomName: (name: string, gender: Gender) => Promise<string>;
  updateSettings: (patch: Partial<Pick<Session, 'lastName' | 'genderFilter' | 'lockedMiddle' | 'shortlist'>>) => void;
  moveToTop: (matchKey: string) => void;
  dismissMatches: () => void;
  setTutorialSeen: () => void;
  clearJustCreated: () => void;
  flush: () => Promise<void>;
}

let channel: RealtimeChannel | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function emptySessionState() {
  return {
    session: null,
    mySwipes: {},
    partnerSwipes: {},
    customNames: [],
    outbox: {},
    history: [],
    seenMatches: [],
    pendingMatches: [],
    justCreated: false,
  };
}

function byKey(swipes: Swipe[]): Record<string, Swipe> {
  return Object.fromEntries(swipes.map((s) => [swipeKey(s.mode, s.itemId), s]));
}

export const useSessionStore = create<State>()(
  persist(
    (set, get) => {
      function subscribe(sessionId: string) {
        channel?.unsubscribe();
        channel = api.subscribeToSession(sessionId, () => {
          // Partner swipes arrive in bursts; one refetch per burst is enough.
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => get().refresh(), 400);
        });
      }

      function collectNewMatches() {
        const { mySwipes, partnerSwipes, seenMatches, pendingMatches } = get();
        const seen = new Set(seenMatches);
        const fresh = computeMatches(mySwipes, partnerSwipes).filter((m) => !seen.has(m.key));
        if (!fresh.length) return;
        // The sheet shows the last entry, so put the most exciting match (both love, first names) last.
        const weight = (m: Match) => (m.bothLove ? 4 : m.anyLove ? 2 : 0) + (m.mode === 'first' ? 1 : 0);
        fresh.sort((a, b) => weight(a) - weight(b));
        set({
          pendingMatches: [...pendingMatches, ...fresh],
          seenMatches: [...seenMatches, ...fresh.map((m) => m.key)],
        });
      }

      function queue(op: OutboxOp) {
        set((s) => ({ outbox: { ...s.outbox, [swipeKey(op.mode, op.itemId)]: op } }));
        get().flush();
      }

      return {
        userId: null,
        ...emptySessionState(),
        tutorialSeen: false,
        sync: 'idle',
        error: null,

        init: async () => {
          await AsyncStorage.multiRemove(['session', 'userId', '@babynames_user_id', 'tutorial_seen', 'settings']).catch(() => {});
          try {
            const userId = await api.ensureUser();
            set({ userId, error: null });
          } catch (e: any) {
            set({ error: e.message, sync: 'offline' });
            return;
          }
          const { session } = get();
          if (session) {
            subscribe(session.id);
            get().refresh();
          }
        },

        createSession: async (lastName, genderFilter) => {
          const session = await api.createSession(lastName.trim(), genderFilter);
          set({ ...emptySessionState(), session, justCreated: true });
          subscribe(session.id);
        },

        joinSession: async (code) => {
          const session = await api.joinSession(code.trim().toUpperCase());
          set({ ...emptySessionState(), session });
          subscribe(session.id);
          await get().refresh();
        },

        leaveSession: async () => {
          const { session } = get();
          channel?.unsubscribe();
          channel = null;
          if (session) await api.leaveSession(session.id).catch(() => {});
          set(emptySessionState());
        },

        refresh: async () => {
          const { session, userId } = get();
          if (!session || !userId) return;
          set({ sync: 'syncing' });
          try {
            const fresh = await api.fetchSession(session.id);
            const [mine, partner, customNames] = await Promise.all([
              api.fetchSwipes(session.id, userId),
              fresh.partnerId ? api.fetchSwipes(session.id, fresh.partnerId) : Promise.resolve([]),
              api.fetchCustomNames(session.id),
            ]);
            // Server is the truth for my swipes, except for writes still waiting in the outbox.
            const { outbox } = get();
            const merged = byKey(mine);
            for (const [key, op] of Object.entries(outbox)) {
              if (op.kind === 'delete') delete merged[key];
              else merged[key] = { itemId: op.itemId, mode: op.mode, type: op.type, updatedAt: Date.now() };
            }
            set({ session: fresh, mySwipes: merged, partnerSwipes: byKey(partner), customNames, sync: 'idle' });
            collectNewMatches();
            get().flush();
          } catch {
            set({ sync: 'offline' });
          }
        },

        swipe: (mode, itemId, type) => {
          const key = swipeKey(mode, itemId);
          set((s) => ({
            mySwipes: { ...s.mySwipes, [key]: { itemId, mode, type, updatedAt: Date.now() } },
            history: [...s.history.slice(-49), key],
          }));
          queue({ kind: 'upsert', mode, itemId, type });
          if (type !== 'pass') collectNewMatches();
        },

        changeSwipe: (mode, itemId, type) => {
          const key = swipeKey(mode, itemId);
          if (type === null) {
            set((s) => {
              const { [key]: _, ...rest } = s.mySwipes;
              return { mySwipes: rest };
            });
            queue({ kind: 'delete', mode, itemId });
            return;
          }
          set((s) => ({ mySwipes: { ...s.mySwipes, [key]: { itemId, mode, type, updatedAt: Date.now() } } }));
          queue({ kind: 'upsert', mode, itemId, type });
          if (type !== 'pass') collectNewMatches();
        },

        undo: () => {
          const { history, mySwipes } = get();
          const key = history[history.length - 1];
          if (!key) return null;
          const swipe = mySwipes[key];
          set((s) => {
            const { [key]: _, ...rest } = s.mySwipes;
            return {
              history: s.history.slice(0, -1),
              mySwipes: rest,
              seenMatches: s.seenMatches.filter((k) => k !== key),
              pendingMatches: s.pendingMatches.filter((m) => m.key !== key),
            };
          });
          if (!swipe) return null;
          queue({ kind: 'delete', mode: swipe.mode, itemId: swipe.itemId });
          return { mode: swipe.mode, itemId: swipe.itemId };
        },

        resetMySwipes: async () => {
          const { session, userId } = get();
          if (!session || !userId) return;
          await api.deleteAllMySwipes(session.id, userId);
          set({ mySwipes: {}, outbox: {}, history: [], seenMatches: [], pendingMatches: [] });
        },

        addCustomName: async (raw, gender) => {
          const { session } = get();
          const name = raw.trim().replace(/\s+/g, ' ');
          const id = nameSlug(name);
          if (!session || !id) throw new Error('Type a name first');
          const custom = { id, name: name[0].toUpperCase() + name.slice(1), gender };
          set((s) => ({ customNames: s.customNames.some((c) => c.id === id) ? s.customNames : [...s.customNames, custom] }));
          api.addCustomName(session.id, custom).catch(() => set({ sync: 'offline' }));
          return id;
        },

        updateSettings: (patch) => {
          const { session } = get();
          if (!session) return;
          set({ session: { ...session, ...patch } });
          api
            .updateSession(session.id, {
              ...(patch.lastName !== undefined && { last_name: patch.lastName }),
              ...(patch.genderFilter !== undefined && { gender_filter: patch.genderFilter }),
              ...(patch.lockedMiddle !== undefined && { locked_middle: patch.lockedMiddle }),
              ...(patch.shortlist !== undefined && { shortlist: patch.shortlist }),
            })
            .catch(() => set({ sync: 'offline' }));
        },

        moveToTop: (matchKey) => {
          const { session } = get();
          if (!session) return;
          get().updateSettings({ shortlist: [matchKey, ...session.shortlist.filter((k) => k !== matchKey)] });
        },

        dismissMatches: () => set({ pendingMatches: [] }),
        setTutorialSeen: () => set({ tutorialSeen: true }),
        clearJustCreated: () => set({ justCreated: false }),

        flush: async () => {
          const { session, userId } = get();
          if (!session || !userId || flushing) return;
          flushing = true;
          try {
            for (const [key, op] of Object.entries(get().outbox)) {
              if (op.kind === 'upsert') await api.upsertSwipe(session.id, op.mode, op.itemId, op.type);
              else await api.deleteSwipe(session.id, userId, op.mode, op.itemId);
              // Only clear the entry if no newer op replaced it while we were sending.
              set((s) => {
                if (s.outbox[key] !== op) return {};
                const { [key]: _, ...rest } = s.outbox;
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
      };
    },
    {
      name: 'babynames-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        session: s.session,
        mySwipes: s.mySwipes,
        partnerSwipes: s.partnerSwipes,
        customNames: s.customNames,
        outbox: s.outbox,
        history: s.history,
        seenMatches: s.seenMatches,
        tutorialSeen: s.tutorialSeen,
      }),
    }
  )
);
