-- BabyNames v3.2: recovery codes for accounts without an email. Run once in the Supabase SQL editor. Keeps all your data.
-- Safe to run again.

-- One code per account. Only a SHA-256 hash is stored, and RLS with no policies means no phone can read
-- this table directly (not even your partner's): only the functions below touch it.
create table if not exists recovery_codes (
  user_id    uuid primary key,
  code_hash  text not null unique,
  created_at timestamptz not null default now()
);
alter table recovery_codes enable row level security;

-- Moves everything one account owns to another: list spots, answers, This or That picks, added names, couch.
-- Used by recover_with_code below, and by you by hand in the SQL editor (see recover-account-manually.sql).
-- Phones can't call it.
create or replace function move_account(p_old uuid, p_new uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_session uuid;
  v_moved int := 0;
begin
  if p_old is null or p_new is null or p_old = p_new then raise exception 'Need two different accounts'; end if;
  for v_session in select session_id from session_members where user_id = p_old loop
    -- The new account may have joined the same list already (e.g. after the partner left). Its fresh rows give way.
    delete from swipes where session_id = v_session and user_id = p_new;
    delete from duels where session_id = v_session and user_id = p_new;
    delete from session_members where session_id = v_session and user_id = p_new;

    update swipes set user_id = p_new where session_id = v_session and user_id = p_old;
    update duels set user_id = p_new where session_id = v_session and user_id = p_old;
    update custom_names set created_by = p_new where session_id = v_session and created_by = p_old;
    update couch set started_by = p_new where session_id = v_session and started_by = p_old;
    update sessions set created_by = p_new where id = v_session and created_by = p_old;
    -- joined_at = now() makes my_session() pick this list over any new one the phone started meanwhile.
    update session_members set user_id = p_new, joined_at = now() where session_id = v_session and user_id = p_old;
    v_moved := v_moved + 1;
  end loop;
  return v_moved;
end;
$$;

-- Makes (or replaces) this account's recovery code and returns it once, as XXXX-XXXX-XXXX.
-- 12 characters from a 31-letter alphabet is about 59 bits, far past guessing range.
create or replace function make_recovery_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v text := '';
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  for i in 1..12 loop
    -- gen_random_uuid() uses a secure random source; random() does not. Byte 0 is fully random.
    v := v || substr(alphabet, 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1);
  end loop;
  insert into recovery_codes (user_id, code_hash) values (auth.uid(), encode(sha256(convert_to(v, 'UTF8')), 'hex'))
    on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
  return substr(v, 1, 4) || '-' || substr(v, 5, 4) || '-' || substr(v, 9, 4);
end;
$$;

-- New phone: the code moves the old account's list spot and answers to the account signed in now.
-- The code is used up afterwards; the app asks for a new one.
create or replace function recover_with_code(p_code text)
returns sessions language plpgsql security definer set search_path = public as $$
declare
  v_old uuid;
  v_row sessions;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select user_id into v_old from recovery_codes
    where code_hash = encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
  if v_old is null then raise exception 'That recovery code didn''t work'; end if;
  if v_old <> auth.uid() then
    perform move_account(v_old, auth.uid());
    delete from recovery_codes where user_id = v_old;
  end if;
  select * into v_row from my_session();
  if v_row.id is null then raise exception 'That code is right, but its account isn''t on a list anymore'; end if;
  return v_row;
end;
$$;

-- Supabase grants new functions to anon and authenticated by default, so revoke from those too.
revoke all on function move_account(uuid, uuid) from public, anon, authenticated;
revoke all on function make_recovery_code(), recover_with_code(text) from public, anon;
grant execute on function make_recovery_code(), recover_with_code(text) to authenticated;
