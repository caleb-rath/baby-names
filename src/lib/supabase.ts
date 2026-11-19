import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Couch, CustomName, Duel, Gender, GenderFilter, Member, Session, Swipe, SwipeType } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

/** Signs in anonymously once per install. Linking an email later lets a new phone get back in. */
export async function ensureUser(): Promise<{ id: string; email: string | null }> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return { id: data.session.user.id, email: data.session.user.email ?? null };
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) {
    throw new Error(
      error?.message?.includes('Anonymous sign-ins are disabled')
        ? 'Anonymous sign-ins are turned off in Supabase (Authentication > Providers).'
        : error?.message ?? 'Could not sign in'
    );
  }
  return { id: signIn.user.id, email: null };
}

/** Step 1 of saving your account: Supabase emails a 6-digit code to this address. */
export async function linkEmail(email: string) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

/** Step 2: the code from that email attaches the address to this account. */
export async function confirmLinkEmail(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' });
  if (error) throw error;
}

/** New phone: email a 6-digit code to an address that was linked before. */
export async function sendLoginCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, token: string): Promise<string> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) throw error ?? new Error('That code didn’t work');
  return data.user.id;
}

/** Makes a new recovery code for this account (the old one stops working) and returns it, e.g. "K7QM-2XPA-9RTD". */
export async function makeRecoveryCode(): Promise<string> {
  const { data, error } = await supabase.rpc('make_recovery_code');
  if (error) throw new Error(error.message);
  return data as string;
}

/** New phone: moves the account that owns this code (list spot, answers and all) onto the account signed in now. */
export async function recoverWithCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('recover_with_code', { p_code: code });
  if (error) throw new Error(error.message);
  return (data as SessionRow).id;
}

interface SessionRow {
  id: string;
  code: string;
  last_name: string;
  gender_filter: GenderFilter;
}

export async function createSession(lastName: string, genderFilter: GenderFilter, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_session', { p_last_name: lastName, p_gender_filter: genderFilter, p_display_name: displayName });
  if (error) throw new Error(error.message);
  return (data as SessionRow).id;
}

export async function joinSession(code: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_session', { p_code: code, p_display_name: displayName });
  if (error) throw new Error(error.message);
  return (data as SessionRow).id;
}

export async function findMySession(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_session');
  if (error) throw error;
  return (data as SessionRow | null)?.id ?? null;
}

/** Your partner got a new phone and never saved an email: for 15 minutes, joining with your code moves them back in. */
export async function allowRejoin(sessionId: string) {
  const { error } = await supabase.rpc('allow_rejoin', { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function leaveSession(sessionId: string) {
  const { error } = await supabase.rpc('leave_session', { p_session: sessionId });
  if (error) throw error;
}

export async function fetchSession(sessionId: string, userId: string): Promise<Session> {
  const [{ data: row, error }, { data: members, error: mErr }] = await Promise.all([
    supabase.from('sessions').select().eq('id', sessionId).single(),
    supabase.from('session_members').select('user_id, display_name').eq('session_id', sessionId),
  ]);
  if (error) throw error;
  if (mErr) throw mErr;
  const list: Member[] = (members ?? []).map((m: any) => ({ userId: m.user_id, displayName: m.display_name ?? '' }));
  const r = row as SessionRow;
  return {
    id: r.id,
    code: r.code,
    lastName: r.last_name ?? '',
    genderFilter: r.gender_filter ?? 'all',
    partner: list.find((m) => m.userId !== userId) ?? null,
    myName: list.find((m) => m.userId === userId)?.displayName ?? '',
  };
}

export async function updateSession(sessionId: string, patch: Partial<{ last_name: string; gender_filter: GenderFilter }>) {
  const { error } = await supabase.from('sessions').update(patch).eq('id', sessionId);
  if (error) throw error;
}

export async function updateMe(sessionId: string, userId: string, patch: Partial<{ display_name: string }>) {
  const { error } = await supabase.from('session_members').update(patch).eq('session_id', sessionId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchAllSwipes(sessionId: string): Promise<Record<string, Swipe[]>> {
  const { data, error } = await supabase.from('swipes').select('user_id, item_id, swipe_type, added, created_at, updated_at').eq('session_id', sessionId);
  if (error) throw error;
  const out: Record<string, Swipe[]> = {};
  for (const r of data ?? []) {
    (out[r.user_id] ??= []).push({
      itemId: r.item_id,
      type: r.swipe_type as SwipeType,
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      ...(r.added ? { added: true } : null),
    });
  }
  return out;
}

export async function upsertSwipe(sessionId: string, itemId: string, type: SwipeType, added?: boolean) {
  // `added` is only ever set, never cleared, so a later answer from a pack keeps the "you added this" mark.
  const { error } = await supabase
    .from('swipes')
    .upsert({ session_id: sessionId, item_id: itemId, swipe_type: type, updated_at: new Date().toISOString(), ...(added && { added: true }) }, { onConflict: 'session_id,user_id,item_id' });
  if (error) throw error;
}

export async function deleteSwipe(sessionId: string, userId: string, itemId: string) {
  const { error } = await supabase.from('swipes').delete().eq('session_id', sessionId).eq('user_id', userId).eq('item_id', itemId);
  if (error) throw error;
}

export async function deleteAllMySwipes(sessionId: string, userId: string) {
  const { error } = await supabase.from('swipes').delete().eq('session_id', sessionId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchExtras(sessionId: string): Promise<{ custom: CustomName[]; tags: Record<string, Gender>; duels: Duel[]; couch: Couch | null }> {
  const [c, f, d, k] = await Promise.all([
    supabase.from('custom_names').select('id, name, gender').eq('session_id', sessionId),
    supabase.from('name_tags').select('item_id, gender').eq('session_id', sessionId),
    supabase.from('duels').select('id, user_id, winner, loser, created_at').eq('session_id', sessionId),
    supabase.from('couch').select('started_by, seed, active, started_at').eq('session_id', sessionId).maybeSingle(),
  ]);
  for (const r of [c, f, d, k]) if (r.error) throw r.error;
  return {
    custom: (c.data ?? []) as CustomName[],
    tags: Object.fromEntries((f.data ?? []).map((r: any) => [r.item_id, r.gender as Gender])),
    duels: (d.data ?? []).map((r: any) => ({ id: r.id, userId: r.user_id, winner: r.winner, loser: r.loser, at: new Date(r.created_at).getTime() })),
    couch: k.data ? { startedBy: k.data.started_by, seed: k.data.seed, active: k.data.active, startedAt: new Date(k.data.started_at).getTime() } : null,
  };
}

export async function addCustomName(sessionId: string, name: CustomName) {
  const { error } = await supabase
    .from('custom_names')
    .upsert({ session_id: sessionId, id: name.id, name: name.name, gender: name.gender }, { onConflict: 'session_id,id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function setNameTag(sessionId: string, itemId: string, gender: Gender) {
  const { error } = await supabase
    .from('name_tags')
    .upsert({ session_id: sessionId, item_id: itemId, gender, updated_at: new Date().toISOString() }, { onConflict: 'session_id,item_id' });
  if (error) throw error;
}

export async function addDuel(sessionId: string, duel: Duel) {
  const { error } = await supabase
    .from('duels')
    .upsert({ id: duel.id, session_id: sessionId, winner: duel.winner, loser: duel.loser, created_at: new Date(duel.at).toISOString() }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function setCouch(sessionId: string, active: boolean, seed?: string) {
  const row: any = { session_id: sessionId, active };
  if (seed) Object.assign(row, { seed, started_at: new Date().toISOString(), started_by: (await supabase.auth.getUser()).data.user?.id });
  const { error } = active
    ? await supabase.from('couch').upsert(row, { onConflict: 'session_id' })
    : await supabase.from('couch').update({ active: false }).eq('session_id', sessionId);
  if (error) throw error;
}

let channelSeq = 0;

/** Stops a channel from subscribeToSession and forgets it, so it can't rejoin on its own. */
export function closeChannel(ch: RealtimeChannel) {
  supabase.removeChannel(ch).catch(() => {});
}

/** Calls onChange whenever anything in this list changes. RLS limits events to members. */
export function subscribeToSession(sessionId: string, onChange: () => void, onDropped?: () => void): RealtimeChannel {
  const filter = `session_id=eq.${sessionId}`;
  // A fresh topic each time: supabase.channel() hands back an existing channel with the same name, even one
  // that is still closing, which left reconnects with doubled listeners or none at all.
  let ch = supabase.channel(`session:${sessionId}:${++channelSeq}`);
  for (const table of ['swipes', 'session_members', 'custom_names', 'name_tags', 'duels', 'couch']) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange);
  }
  return ch
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, onChange)
    // Delete events can't be filtered server-side; they carry only the primary key, which includes session_id.
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'swipes' }, (p: any) => {
      if (p.old?.session_id === sessionId) onChange();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onDropped?.();
    });
}
