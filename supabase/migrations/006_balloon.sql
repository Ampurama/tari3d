-- ─────────────────────────────────────────────────────────────────────────────
--  HOT AIR BALLOON — one shared balloon between the main island and Sky Island.
--
--  Run this once in the Supabase SQL editor, AFTER 001–005. Safe to run again; it only adds.
--  Rollback at the bottom.
--
--  The balloon is a single row: where it's docked, who is in its two seats (each person can only
--  take or leave a seat for themselves), who's ready, and when it took off. Its position in the air
--  is NOT stored: every game works it out from `departed_at` and the fixed route (40 seconds),
--  so both of you see the same balloon without sending positions around. A flight that has had
--  its 40 seconds counts as landed (every function below tidies that up first).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.balloon (
  id smallint primary key default 1 check (id = 1),
  state text not null default 'docked' check (state in ('docked', 'flying')),
  location text not null default 'main' check (location in ('main', 'sky')),
  dest text check (dest in ('main', 'sky')),
  seat_a uuid references auth.users (id) on delete set null,
  seat_b uuid references auth.users (id) on delete set null,
  ready_a boolean not null default false,
  ready_b boolean not null default false,
  departed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint balloon_two_people check (seat_a is null or seat_b is null or seat_a <> seat_b),
  constraint balloon_flight check ((state = 'flying') = (dest is not null and departed_at is not null))
);
insert into public.balloon (id) values (1) on conflict (id) do nothing;

alter table public.balloon enable row level security;
revoke all on public.balloon from anon, authenticated;
grant select on public.balloon to authenticated;
drop policy if exists "members see the balloon" on public.balloon;
create policy "members see the balloon" on public.balloon for select to authenticated using (public.is_couple_member());

/** The server's clock, so both games fly the balloon on the same time. */
create or replace function public.balloon_clock()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$ select now(); $$;

/** A flight whose time is up has landed at its destination. */
create or replace function public.balloon_tidy()
returns void
language sql
security definer
set search_path = public
as $$
  update public.balloon
     set state = 'docked', location = dest, dest = null, departed_at = null,
         ready_a = false, ready_b = false, updated_at = now()
   where id = 1 and state = 'flying' and departed_at + interval '40 seconds' <= now();
$$;
revoke all on function public.balloon_tidy() from public;

/** "Naik Balon Udara": take a free seat (only while it's docked). Asking twice changes nothing. */
create or replace function public.balloon_board()
returns public.balloon
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.balloon;
begin
  perform public.date_check_member();
  perform public.balloon_tidy();
  select * into b from public.balloon where id = 1 for update;
  if auth.uid() in (b.seat_a, b.seat_b) then return b; end if;
  if b.state <> 'docked' then raise exception 'busy: the balloon is flying'; end if;
  if b.seat_a is null then
    update public.balloon set seat_a = auth.uid(), ready_a = false, updated_at = now() where id = 1 returning * into b;
  elsif b.seat_b is null then
    update public.balloon set seat_b = auth.uid(), ready_b = false, updated_at = now() where id = 1 returning * into b;
  else
    raise exception 'full: both seats are taken';
  end if;
  return b;
end;
$$;

/** "Turun dari Balon": only on the ground, and only yourself. */
create or replace function public.balloon_leave()
returns public.balloon
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.balloon;
begin
  perform public.date_check_member();
  perform public.balloon_tidy();
  select * into b from public.balloon where id = 1 for update;
  if auth.uid() is distinct from b.seat_a and auth.uid() is distinct from b.seat_b then
    return b;
  end if;
  if b.state = 'flying' then raise exception 'flying: wait until it lands'; end if;
  update public.balloon
     set seat_a = case when seat_a = auth.uid() then null else seat_a end,
         ready_a = case when seat_a = auth.uid() then false else ready_a end,
         seat_b = case when seat_b = auth.uid() then null else seat_b end,
         ready_b = case when seat_b = auth.uid() then false else ready_b end,
         updated_at = now()
   where id = 1 returning * into b;
  return b;
end;
$$;

/**
 * "Siap Terbang" (for yourself). When everyone in the basket is ready, it takes off for the other
 * island. Nobody can be marked ready by someone else, and a taking-off balloon can't take off twice.
 */
create or replace function public.balloon_ready(p_ready boolean)
returns public.balloon
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.balloon;
begin
  perform public.date_check_member();
  perform public.balloon_tidy();
  select * into b from public.balloon where id = 1 for update;
  if b.state <> 'docked' then return b; end if;
  if b.seat_a = auth.uid() then
    b.ready_a := p_ready;
  elsif b.seat_b = auth.uid() then
    b.ready_b := p_ready;
  else
    raise exception 'not aboard';
  end if;
  if (b.seat_a is null or b.ready_a) and (b.seat_b is null or b.ready_b) then
    update public.balloon
       set state = 'flying', dest = case when location = 'main' then 'sky' else 'main' end,
           departed_at = now(), ready_a = b.ready_a, ready_b = b.ready_b, updated_at = now()
     where id = 1 returning * into b;
  else
    update public.balloon set ready_a = b.ready_a, ready_b = b.ready_b, updated_at = now() where id = 1 returning * into b;
  end if;
  return b;
end;
$$;

/** "Panggil balon udara": the empty balloon flies over to the island where you're waiting. */
create or replace function public.balloon_call(p_to text)
returns public.balloon
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.balloon;
begin
  perform public.date_check_member();
  if p_to not in ('main', 'sky') then raise exception 'no such dock'; end if;
  perform public.balloon_tidy();
  select * into b from public.balloon where id = 1 for update;
  if b.state = 'docked' and b.location <> p_to and b.seat_a is null and b.seat_b is null then
    update public.balloon set state = 'flying', dest = p_to, departed_at = now(), updated_at = now() where id = 1 returning * into b;
  end if;
  return b;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['balloon_clock()', 'balloon_board()', 'balloon_leave()', 'balloon_ready(boolean)', 'balloon_call(text)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$ begin alter publication supabase_realtime add table public.balloon; exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
--  ROLLBACK (by hand):
--  drop function if exists public.balloon_clock(), public.balloon_tidy(), public.balloon_board(),
--    public.balloon_leave(), public.balloon_ready(boolean), public.balloon_call(text);
--  drop table if exists public.balloon;
-- ─────────────────────────────────────────────────────────────────────────────
