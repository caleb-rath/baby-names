-- Run once in Supabase SQL Editor: lets swipes store a "maybe" answer.
alter table swipes drop constraint if exists swipes_swipe_type_check;
alter table swipes add constraint swipes_swipe_type_check check (swipe_type in ('like', 'pass', 'super', 'maybe'));
