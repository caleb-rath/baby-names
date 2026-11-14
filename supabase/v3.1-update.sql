-- BabyNames v3.1 update. Run once in the Supabase SQL editor on a v3 database. Keeps all your data.
-- (schema.sql already includes this for a fresh install.)

-- Names typed in with "Add a name" go first in your partner's Today's 10.
alter table swipes add column if not exists added boolean not null default false;

-- New phone, no saved email: your partner opens a 15-minute window and you join with the code again.
alter table sessions add column if not exists rejoin_by uuid;
alter table sessions add column if not exists rejoin_until timestamptz;

create or replace function allow_rejoin(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_session) then raise exception 'Not on this list'; end if;
  update sessions set rejoin_by = auth.uid(), rejoin_until = now() + interval '15 minutes' where id = p_session;
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

revoke all on function allow_rejoin(uuid) from public;
grant execute on function allow_rejoin(uuid), join_session(text, text) to authenticated;
