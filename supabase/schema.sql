-- BabyNames schema v3.
-- Run the whole file in the Supabase SQL editor. It DROPS any earlier BabyNames tables and starts fresh.
-- Also in the dashboard:
--   Authentication > Sign In / Providers: turn on "Allow anonymous sign-ins" and keep Email enabled.
--   Authentication > Email Templates > "Magic Link" and "Change Email Address": include {{ .Token }}
--   so people can type the 6-digit code instead of clicking a link.

drop table if exists recovery_codes cascade;
drop table if exists couch cascade;
drop table if exists duels cascade;
drop table if exists family_names cascade;
drop table if exists name_tags cascade;
drop table if exists swipes cascade;
drop table if exists custom_names cascade;
drop table if exists session_members cascade;
drop table if exists sessions cascade;

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  last_name     text not null default '',
  gender_filter text not null default 'all' check (gender_filter in ('all', 'F', 'M', 'N')),
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  -- New phone, no saved email: the partner opens a short window to rejoin with the code (allow_rejoin).
  rejoin_by     uuid,
  rejoin_until  timestamptz
);

create table session_members (
  session_id   uuid not null references sessions(id) on delete cascade,
  user_id      uuid not null,
  display_name text not null default '',
  joined_at    timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- One row per person per name. Changing your mind updates the row; undo deletes it.
-- created_at is the first time you answered (used for the streak); updated_at is the latest change.
create table swipes (
  session_id uuid not null references sessions(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  item_id    text not null,  -- name slug, e.g. 'josephine'
  swipe_type text not null check (swipe_type in ('like', 'pass', 'super', 'maybe')),
  added      boolean not null default false,  -- typed in with "Add a name"; goes first in the partner's Today's 10
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id, item_id)
);

-- Names someone typed in that aren't in the built-in list.
create table custom_names (
  session_id uuid not null references sessions(id) on delete cascade,
  id         text not null,
  name       text not null,
  gender     text not null check (gender in ('F', 'M', 'N')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (session_id, id)
);

-- Whether you two think of a name as a girl's name, a boy's name, or either. Shared; last change wins.
create table name_tags (
  session_id uuid not null references sessions(id) on delete cascade,
  item_id    text not null,
  gender     text not null check (gender in ('F', 'M', 'N')),
  updated_at timestamptz not null default now(),
  primary key (session_id, item_id)
);

-- This or That picks. Scores are computed in the app.
create table duels (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  winner     text not null,
  loser      text not null,
  created_at timestamptz not null default now()
);

-- At most one Couch mode game per list. The seed makes both phones show the same names in the same order.
create table couch (
  session_id uuid primary key references sessions(id) on delete cascade,
  started_by uuid not null default auth.uid(),
  seed       text not null,
  active     boolean not null default true,
  started_at timestamptz not null default now()
);

-- Membership check used by every policy. security definer avoids RLS recursion on session_members.
create or replace function is_member(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_members where session_id = p_session and user_id = auth.uid());
$$;

-- Codes skip look-alike characters (0/O, 1/I/L).
create or replace function create_session(p_last_name text, p_gender_filter text, p_display_name text)
returns sessions language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_row sessions;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from sessions where code = v_code);
  end loop;
  insert into sessions (code, last_name, gender_filter, created_by)
    values (v_code, coalesce(p_last_name, ''), coalesce(p_gender_filter, 'all'), auth.uid())
    returning * into v_row;
  insert into session_members (session_id, user_id, display_name) values (v_row.id, auth.uid(), coalesce(p_display_name, ''));
  return v_row;
end;
$$;

create or replace function join_session(p_code text, p_display_name text)
returns sessions language plpgsql security definer set search_path = public as $$
declare
  v_row sessions;
  v_old uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into v_row from sessions where code = upper(trim(p_code)) for update;
  if not found then raise exception 'No list with that code'; end if;
  if exists (select 1 from session_members where session_id = v_row.id and user_id = auth.uid()) then
    return v_row;
  end if;
  if (select count(*) from session_members where session_id = v_row.id) >= 2 then
    -- Your partner let you back in: this account takes over your old spot, answers and all.
    if v_row.rejoin_until is not null and v_row.rejoin_until > now() then
      select user_id into v_old from session_members where session_id = v_row.id and user_id <> v_row.rejoin_by limit 1;
      update swipes set user_id = auth.uid() where session_id = v_row.id and user_id = v_old;
      update duels set user_id = auth.uid() where session_id = v_row.id and user_id = v_old;
      update custom_names set created_by = auth.uid() where session_id = v_row.id and created_by = v_old;
      update couch set started_by = auth.uid() where session_id = v_row.id and started_by = v_old;
      update session_members set user_id = auth.uid(), joined_at = now() where session_id = v_row.id and user_id = v_old;
      update sessions set rejoin_by = null, rejoin_until = null where id = v_row.id returning * into v_row;
      return v_row;
    end if;
    raise exception 'That list already has two people. If it''s yours on a new phone, ask your partner to tap "Let them back in" in Settings, then join again.';
  end if;
  insert into session_members (session_id, user_id, display_name) values (v_row.id, auth.uid(), coalesce(p_display_name, ''));
  return v_row;
end;
$$;

create or replace function allow_rejoin(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_session) then raise exception 'Not on this list'; end if;
  update sessions set rejoin_by = auth.uid(), rejoin_until = now() + interval '15 minutes' where id = p_session;
end;
$$;

-- After signing in with email on a new phone, find the list this account belongs to.
create or replace function my_session()
returns sessions language sql stable security definer set search_path = public as $$
  select s.* from sessions s join session_members m on m.session_id = s.id
  where m.user_id = auth.uid() order by m.joined_at desc limit 1;
$$;

create or replace function leave_session(p_session uuid)
returns void language sql security definer set search_path = public as $$
  delete from swipes where session_id = p_session and user_id = auth.uid();
  delete from duels where session_id = p_session and user_id = auth.uid();
  delete from session_members where session_id = p_session and user_id = auth.uid();
$$;

revoke all on function create_session(text, text, text), join_session(text, text), allow_rejoin(uuid), leave_session(uuid), my_session() from public;
grant execute on function create_session(text, text, text), join_session(text, text), allow_rejoin(uuid), leave_session(uuid), my_session(), is_member(uuid) to authenticated;

alter table sessions        enable row level security;
alter table session_members enable row level security;
alter table swipes          enable row level security;
alter table custom_names    enable row level security;
alter table name_tags       enable row level security;
alter table duels           enable row level security;
alter table couch           enable row level security;

-- Sessions are created and joined only through the RPCs above.
create policy "members read session"   on sessions for select using (is_member(id));
create policy "members update session" on sessions for update using (is_member(id)) with check (is_member(id));

create policy "members read members" on session_members for select using (is_member(session_id));
create policy "update own member row" on session_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read swipes" on swipes for select using (is_member(session_id));
create policy "own swipes insert"   on swipes for insert with check (user_id = auth.uid() and is_member(session_id));
create policy "own swipes update"   on swipes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own swipes delete"   on swipes for delete using (user_id = auth.uid());

create policy "members read custom names" on custom_names for select using (is_member(session_id));
create policy "members add custom names"  on custom_names for insert with check (created_by = auth.uid() and is_member(session_id));

create policy "members read name tags"   on name_tags for select using (is_member(session_id));
create policy "members insert name tags" on name_tags for insert with check (is_member(session_id));
create policy "members update name tags" on name_tags for update using (is_member(session_id)) with check (is_member(session_id));

create policy "members read duels" on duels for select using (is_member(session_id));
create policy "own duels insert"   on duels for insert with check (user_id = auth.uid() and is_member(session_id));
create policy "own duels delete"   on duels for delete using (user_id = auth.uid());

create policy "members read couch"  on couch for select using (is_member(session_id));
create policy "members write couch" on couch for insert with check (is_member(session_id));
create policy "members update couch" on couch for update using (is_member(session_id)) with check (is_member(session_id));

-- Keep created_at as the first answer time when a swipe is changed.
create or replace function keep_created_at() returns trigger language plpgsql as $$
begin
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger swipes_keep_created before update on swipes for each row execute function keep_created_at();

-- Realtime: the app refetches when anything in its list changes.
alter publication supabase_realtime add table sessions, session_members, swipes, custom_names, name_tags, duels, couch;

-- v3.2: recovery codes (same as v3.2-recovery.sql).

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
