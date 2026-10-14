-- ─────────────────────────────────────────────────────────────────────────────
--  HOT AIR BALLOON — a longer, higher flight (75 seconds instead of 40).
--
--  Run this once in the Supabase SQL editor, AFTER 006_balloon.sql. Safe to run again.
--  Only the landing time changes; the game uses the same 75 seconds (src/lib/balloon.js).
--  Rollback: run the balloon_tidy() section of 006_balloon.sql again.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.balloon_tidy()
returns void
language sql
security definer
set search_path = public
as $$
  update public.balloon
     set state = 'docked', location = dest, dest = null, departed_at = null,
         ready_a = false, ready_b = false, updated_at = now()
   where id = 1 and state = 'flying' and departed_at + interval '75 seconds' <= now();
$$;
revoke all on function public.balloon_tidy() from public;
