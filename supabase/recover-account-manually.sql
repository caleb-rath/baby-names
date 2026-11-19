-- Recover an account that has NO saved email and NO recovery code, by hand, in the Supabase SQL editor.
-- Needs v3.2-recovery.sql run first (it creates move_account).
--
-- Easier, if the partner still has the app: partner opens Settings > "<name> got a new phone?" > Let them back in,
-- then the new phone taps "I have a code" and joins with the list code. No SQL needed.
--
-- Otherwise:
--   1. On the new phone, open the app once (that creates a fresh account). Don't bother starting a list.
--   2. Run step A and step B below (select each block and run it on its own).
--   3. Paste the two ids into step C and run it.
--   4. On the new phone, reload the app. If it had started its own list, tap Settings > Leave this list first.

-- A. Who is on each list. The old account is the one with the right name; is_anonymous = true, email empty.
select s.code, m.display_name, m.user_id, u.is_anonymous, u.email, u.created_at, u.last_sign_in_at
from session_members m
join sessions s on s.id = m.session_id
left join auth.users u on u.id = m.user_id
order by s.code, m.joined_at;

-- B. The new phone's account: the newest anonymous account, signed in a minute ago, on no list (or on its own new one).
select u.id, u.created_at, u.last_sign_in_at,
       (select string_agg(s.code, ', ') from session_members m join sessions s on s.id = m.session_id where m.user_id = u.id) as lists
from auth.users u
where u.is_anonymous
order by u.created_at desc
limit 5;

-- C. Move everything. Returns how many lists were moved (should be 1).
select move_account(
  'OLD-USER-ID-FROM-STEP-A'::uuid,
  'NEW-USER-ID-FROM-STEP-B'::uuid
);
