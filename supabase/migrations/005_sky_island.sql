-- ─────────────────────────────────────────────────────────────────────────────
--  SKY ISLAND — shared progress for the island above the clouds.
--
--  Run this once in the Supabase SQL editor, AFTER 001–004. Safe to run again; it only adds
--  (no existing data is changed or removed). A rollback is at the bottom of this file.
--
--  Stored: whether Sky Island has been opened, the hidden stars you've found (each one once),
--  Cloud Hop rounds and milestones, and the rewards they unlock. Not stored: where anyone is
--  standing — that stays on the private Realtime channel. Every change goes through a function
--  below that checks the caller is one of the two members.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Progress (one row) ───────────────────────────────────────────────────
create table if not exists public.sky_progress (
  id smallint primary key default 1 check (id = 1),
  unlocked_at timestamptz,
  hop_completions integer not null default 0,
  hop_best_stars smallint not null default 0,
  moment_unlocked boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.sky_progress (id) values (1) on conflict (id) do nothing;

-- ── 2. The hidden stars of the Star Observatory (each id can only be found once) ──
create table if not exists public.sky_stars (
  id text primary key check (id in ('obs1', 'obs2', 'obs3', 'obs4', 'obs5', 'obs6', 'obs7', 'obs8')),
  found_by uuid references auth.users (id) on delete set null,
  found_at timestamptz not null default now()
);

-- ── 3. Cloud Hop rounds (only one at a time) ────────────────────────────────
-- Checkpoints go 0 (start) → 3 (the goal). A round is complete when BOTH of you reach the goal.
create table if not exists public.hop_rounds (
  id uuid primary key,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  player_a uuid not null references auth.users (id) on delete cascade,
  player_b uuid not null references auth.users (id) on delete cascade,
  cp_a smallint not null default 0 check (cp_a between 0 and 3),
  cp_b smallint not null default 0 check (cp_b between 0 and 3),
  done_a boolean not null default false,
  done_b boolean not null default false,
  stars text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  ended_at timestamptz
);
create unique index if not exists hop_rounds_one_active on public.hop_rounds ((true)) where status = 'active';
create index if not exists hop_rounds_completed on public.hop_rounds (completed_at desc) where status = 'completed';

alter table public.sky_progress enable row level security;
alter table public.sky_stars enable row level security;
alter table public.hop_rounds enable row level security;
revoke all on public.sky_progress, public.sky_stars, public.hop_rounds from anon, authenticated;
grant select on public.sky_progress, public.sky_stars, public.hop_rounds to authenticated;

drop policy if exists "members see sky progress" on public.sky_progress;
create policy "members see sky progress" on public.sky_progress for select to authenticated using (public.is_couple_member());
drop policy if exists "members see the stars" on public.sky_stars;
create policy "members see the stars" on public.sky_stars for select to authenticated using (public.is_couple_member());
drop policy if exists "members see hop rounds" on public.hop_rounds;
create policy "members see hop rounds" on public.hop_rounds for select to authenticated using (public.is_couple_member());

-- ── 4. Rewards: two new keepsakes for the house catalog ─────────────────────
alter table public.keepsakes drop constraint if exists keepsakes_kind_check;
alter table public.keepsakes add constraint keepsakes_kind_check
  check (kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard', 'star_lamp', 'sky_lantern'));

alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed', 'star_lamp', 'sky_lantern'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree'))
);

create or replace function public.house_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stage smallint;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  if tg_op = 'INSERT' then
    select stage into current_stage from public.house where id = 1;
    if new.area = 'inside' and current_stage < 2 then
      raise exception 'build the cottage first';
    end if;
    if new.area = 'garden' and current_stage < 3 then
      raise exception 'the garden opens at stage 3';
    end if;
    if new.kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard', 'star_lamp', 'sky_lantern')
       and not exists (select 1 from public.keepsakes where kind = new.kind) then
      raise exception 'that keepsake is not unlocked yet';
    end if;
    if (select count(*) from public.house_items) >= 80 then
      raise exception 'the house is full';
    end if;
    new.version := 1;
    new.created_by := auth.uid();
  else
    new.id := old.id;
    new.kind := old.kind;
    new.area := old.area;
    new.created_by := old.created_by;
    new.version := old.version + 1;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

-- ── 5. Functions ────────────────────────────────────────────────────────────

/** The first time either of you arrives: Sky Island is open (for good). */
create or replace function public.sky_visit()
returns public.sky_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.sky_progress;
begin
  perform public.date_check_member();
  update public.sky_progress set unlocked_at = coalesce(unlocked_at, now()), updated_at = now() where id = 1 returning * into p;
  return p;
end;
$$;

/**
 * Found a hidden star. Finding the same star twice (or both at once) changes nothing.
 * 4 stars unlock the star lamp; all 8 open Our Little Moment.
 */
create or replace function public.sky_find_star(p_id text)
returns public.sky_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.sky_progress;
  n integer;
begin
  perform public.date_check_member();
  insert into public.sky_stars (id, found_by) values (p_id, auth.uid()) on conflict (id) do nothing;
  select count(*) into n from public.sky_stars;
  if n >= 4 then
    insert into public.keepsakes (kind) values ('star_lamp') on conflict (kind) do nothing;
  end if;
  update public.sky_progress
     set moment_unlocked = moment_unlocked or n >= 8, updated_at = now()
   where id = 1 returning * into p;
  return p;
end;
$$;

/** Start a Cloud Hop round for the two of you (or join the one that's already going). */
create or replace function public.hop_start(p_id uuid)
returns public.hop_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hop_rounds;
  mate uuid;
begin
  perform public.date_check_member();
  -- a round nobody touched for 3 hours is put away
  update public.hop_rounds set status = 'abandoned', ended_at = now()
   where status = 'active' and started_at < now() - interval '3 hours';
  select * into r from public.hop_rounds where status = 'active' limit 1;
  if found then return r; end if;
  mate := public.date_partner();
  if mate is null then raise exception 'the other person has not joined yet'; end if;
  insert into public.hop_rounds (id, player_a, player_b) values (p_id, auth.uid(), mate)
  on conflict (id) do nothing
  returning * into r;
  if r.id is null then select * into r from public.hop_rounds where id = p_id; end if;
  return r;
end;
$$;

/** Reached a checkpoint: it only ever moves forward, and only for yourself. */
create or replace function public.hop_checkpoint(p_round uuid, p_index smallint)
returns public.hop_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hop_rounds;
begin
  perform public.date_check_member();
  if p_index < 0 or p_index > 3 then raise exception 'no such checkpoint'; end if;
  update public.hop_rounds
     set cp_a = case when player_a = auth.uid() then greatest(cp_a, p_index) else cp_a end,
         cp_b = case when player_b = auth.uid() then greatest(cp_b, p_index) else cp_b end
   where id = p_round and status = 'active' and auth.uid() in (player_a, player_b)
   returning * into r;
  if not found then select * into r from public.hop_rounds where id = p_round; end if;
  return r;
end;
$$;

/** Picked up a Cloud Hop star (shared by both of you; each star counts once). */
create or replace function public.hop_star(p_round uuid, p_star text)
returns public.hop_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hop_rounds;
begin
  perform public.date_check_member();
  if p_star not in ('h1', 'h2', 'h3', 'h4', 'h5') then raise exception 'no such star'; end if;
  update public.hop_rounds
     set stars = case when p_star = any(stars) then stars else array_append(stars, p_star) end
   where id = p_round and status = 'active'
   returning * into r;
  if not found then select * into r from public.hop_rounds where id = p_round; end if;
  return r;
end;
$$;

/**
 * Reached the goal (your checkpoint must already be the goal). When you've BOTH arrived the
 * round is complete, counted once, and the rewards unlock (each only once, ever).
 */
create or replace function public.hop_finish(p_round uuid)
returns public.hop_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hop_rounds;
begin
  perform public.date_check_member();
  select * into r from public.hop_rounds where id = p_round for update;
  if not found then raise exception 'no such round'; end if;
  if r.status <> 'active' then return r; end if;
  if auth.uid() = r.player_a and r.cp_a >= 3 then
    r.done_a := true;
  elsif auth.uid() = r.player_b and r.cp_b >= 3 then
    r.done_b := true;
  else
    return r;
  end if;
  if r.done_a and r.done_b then
    update public.hop_rounds set done_a = true, done_b = true, status = 'completed', completed_at = now(), ended_at = now()
     where id = p_round returning * into r;
    update public.sky_progress
       set hop_completions = hop_completions + 1,
           hop_best_stars = greatest(hop_best_stars, coalesce(array_length(r.stars, 1), 0)),
           moment_unlocked = true,
           updated_at = now()
     where id = 1;
    insert into public.keepsakes (kind) values ('sky_lantern') on conflict (kind) do nothing;
  else
    update public.hop_rounds set done_a = r.done_a, done_b = r.done_b where id = p_round returning * into r;
  end if;
  return r;
end;
$$;

/** "Keluar": put the round away (nothing is lost: stars found on the island stay found). */
create or replace function public.hop_leave(p_round uuid)
returns public.hop_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hop_rounds;
begin
  perform public.date_check_member();
  update public.hop_rounds set status = 'abandoned', ended_at = now()
   where id = p_round and status = 'active'
   returning * into r;
  if not found then select * into r from public.hop_rounds where id = p_round; end if;
  return r;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['sky_visit()', 'sky_find_star(text)', 'hop_start(uuid)', 'hop_checkpoint(uuid, smallint)',
                           'hop_star(uuid, text)', 'hop_finish(uuid)', 'hop_leave(uuid)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── 6. Live updates (on the private room channel) ───────────────────────────
do $$ begin alter publication supabase_realtime add table public.sky_progress; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.sky_stars; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.hop_rounds; exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
--  ROLLBACK (only if you want Sky Island's data gone again; run by hand):
--
--  drop function if exists public.sky_visit(), public.sky_find_star(text), public.hop_start(uuid),
--    public.hop_checkpoint(uuid, smallint), public.hop_star(uuid, text), public.hop_finish(uuid), public.hop_leave(uuid);
--  drop table if exists public.hop_rounds, public.sky_stars, public.sky_progress;
--  delete from public.house_items where kind in ('star_lamp', 'sky_lantern');
--  delete from public.keepsakes where kind in ('star_lamp', 'sky_lantern');
--  -- then re-run the constraint + trigger sections of 004_pet.sql / 003_dates.sql
-- ─────────────────────────────────────────────────────────────────────────────
