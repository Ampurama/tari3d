-- ─────────────────────────────────────────────────────────────────────────────
--  GNOME VILLAGE — the little village by The Little Gnome Café.
--
--  Run this once in the Supabase SQL editor, AFTER 010_bigger_home.sql. Safe to run again.
--  Nothing existing is removed or reset: it only adds.
--
--    • village_quests: the little jobs each of you has finished in the village (one row per person
--      per job, so a job never counts twice — not when it's done again, not when you both do it)
--    • village_complete(quest): saves a finished job and gives its reward once — a few heart coins
--      for the shared house, and a decoration unlocked for the house (one of each, for both of you)
--    • ten new things for the house: four the village merchant sells (for coins), six that are
--      rewards (keepsakes, like the ones from dates and Sky Island)
--
--  Prices live in public.item_price() below and must match `price` in src/lib/homeLayout.js.
--
--  Rollback:
--    drop function if exists public.village_complete(text);
--    drop table if exists public.village_quests;
--    (then run the keepsakes / kind constraints, item_price() and house_items_before_write() from
--     005 / 010 again)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. the new things for the house ──────────────────────────────────────────
alter table public.keepsakes drop constraint if exists keepsakes_kind_check;
alter table public.keepsakes add constraint keepsakes_kind_check
  check (kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard', 'star_lamp', 'sky_lantern',
                  'mushroom_lamp', 'bread_basket', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern'));

alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed', 'star_lamp', 'sky_lantern',
                                'stove', 'fridge', 'bathtub', 'tv', 'wall_panel', 'wall_arch',
                                'mushroom_stool', 'toadstool_table', 'mushroom_lamp', 'bread_basket'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree',
                                   'gnome_lantern', 'flower_pot', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern'))
);

-- prices (010's list, plus what the village merchant sells; the rewards are gifts)
create or replace function public.item_price(k text)
returns integer
language sql
immutable
as $$
  select case k
    when 'bed' then 60 when 'sofa' then 50 when 'table' then 35 when 'chair' then 15 when 'rug' then 20
    when 'floor_lamp' then 18 when 'plant' then 12 when 'bookshelf' then 40 when 'picture' then 15
    when 'heart_lamp' then 22 when 'teddy' then 15 when 'vase' then 10 when 'pet_bed' then 20
    when 'stove' then 55 when 'fridge' then 50 when 'bathtub' then 70 when 'tv' then 45
    when 'wall_panel' then 10 when 'wall_arch' then 15
    when 'flowers' then 12 when 'bush' then 10 when 'lantern' then 12 when 'garden_bench' then 25 when 'small_tree' then 30
    when 'mushroom_stool' then 15 when 'toadstool_table' then 30 when 'gnome_lantern' then 18 when 'flower_pot' then 10
    else 0
  end
$$;

-- keepsakes (the village's too) can only be placed once they're unlocked
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
    if new.kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard', 'star_lamp', 'sky_lantern',
                    'mushroom_lamp', 'bread_basket', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern')
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

-- ── 2. the jobs you've finished ──────────────────────────────────────────────
create table if not exists public.village_quests (
  user_id uuid not null references auth.users (id) on delete cascade,
  quest text not null check (quest in ('siram', 'bahan', 'antar', 'kacamata', 'rahasia', 'lentera', 'topi')),
  done_at timestamptz not null default now(),
  primary key (user_id, quest)
);
alter table public.village_quests enable row level security;
revoke all on public.village_quests from anon, authenticated;
grant select on public.village_quests to authenticated;

drop policy if exists "members see the village jobs" on public.village_quests;
create policy "members see the village jobs"
  on public.village_quests for select
  to authenticated
  using (public.is_couple_member());

/*
 * A job finished: saved once for this person. The first time, the house gets its coins and the
 * decoration is unlocked (once, for both of you). Returns the coins added (0 if it was already done).
 */
create or replace function public.village_complete(quest text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  coins_for integer;
  gift text;
  added integer;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select c, g into coins_for, gift from (values
    ('siram', 10, 'moon_flower'),
    ('bahan', 10, 'bread_basket'),
    ('antar', 10, 'mushroom_lamp'),
    ('kacamata', 15, 'gnome_statue'),
    ('rahasia', 15, 'crystal_shroom'),
    ('lentera', 10, 'twin_lantern'),
    ('topi', 0, null)
  ) as t(q, c, g) where t.q = village_complete.quest;
  if coins_for is null then
    raise exception 'unknown job';
  end if;
  insert into public.village_quests (user_id, quest) values (auth.uid(), village_complete.quest)
  on conflict on constraint village_quests_pkey do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    return 0;
  end if;
  if gift is not null then
    insert into public.keepsakes (kind) values (gift) on conflict (kind) do nothing;
  end if;
  if coins_for > 0 then
    update public.house set coins = coins + coins_for where id = 1;
  end if;
  return coins_for;
end;
$$;

revoke all on function public.village_complete(text) from public;
grant execute on function public.village_complete(text) to authenticated;
