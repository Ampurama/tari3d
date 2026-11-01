-- ─────────────────────────────────────────────────────────────────────────────
--  THE HAUNTED GNOME MANSION — Rumah Kurcaci Berhantu: the story you play through together.
--
--  Run this once in the Supabase SQL editor, AFTER 013_carnival.sql. Safe to run again.
--  Nothing existing is removed or reset: it only adds.
--
--    • mansion_progress (one row): the run you're on together — which steps of the story are done,
--      which of the four heirlooms are found, the four symbol wheels in the secret corridor, how
--      the story ended, and every ending you've seen (kept when you play again)
--    • mansion_presses: the two levers that must be turned at the same moment (who, which, when)
--    • functions for each step; the server checks that a step's prerequisites are done, that the
--      two levers really were turned together (or by one person running between them), the symbol
--      order and the safe's code. Both of you see every change live.
--    • two things for the house: a cuckoo clock (the good ending) and a ghostly disco ball (the funny
--      one), each with a few heart coins, once per ending
--
--  Where the ghosts are and the scares need nothing here: they travel with your characters on the
--  private Realtime channel, never stored.
--
--  Keep the step list below in step with STEPS / ITEMS in src/lib/mansion.js.
--
--  Rollback:
--    drop function if exists public.mansion_step(text), public.mansion_press(text), public.mansion_dial(smallint, smallint),
--      public.mansion_code(text), public.mansion_end(text), public.mansion_reset(), public.mansion_needs(text);
--    drop table if exists public.mansion_presses, public.mansion_progress;
--    (then run the keepsakes / kind constraints and house_items_before_write() from 013 again)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. the endings' rewards, as things for the house ────────────────────────
alter table public.keepsakes drop constraint if exists keepsakes_kind_check;
alter table public.keepsakes add constraint keepsakes_kind_check
  check (kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard', 'star_lamp', 'sky_lantern',
                  'mushroom_lamp', 'bread_basket', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern',
                  'gnome_plush', 'carnival_lantern', 'balloon_bunch',
                  'mansion_clock', 'ghost_disco'));

alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed', 'star_lamp', 'sky_lantern',
                                'stove', 'fridge', 'bathtub', 'tv', 'wall_panel', 'wall_arch',
                                'mushroom_stool', 'toadstool_table', 'mushroom_lamp', 'bread_basket',
                                'gnome_plush',
                                'mansion_clock', 'ghost_disco'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree',
                                   'gnome_lantern', 'flower_pot', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern',
                                   'carnival_lantern', 'balloon_bunch'))
);

-- keepsakes (the mansion's too) can only be placed once they're unlocked
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
                    'mushroom_lamp', 'bread_basket', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern',
                    'gnome_plush', 'carnival_lantern', 'balloon_bunch',
                    'mansion_clock', 'ghost_disco')
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

-- ── 2. the run (one row, shared) ─────────────────────────────────────────────
create table if not exists public.mansion_progress (
  id smallint primary key default 1 check (id = 1),
  run_id uuid,
  steps text[] not null default '{}',
  items text[] not null default '{}',
  dial smallint[] not null default '{0,0,0,0}' check (array_length(dial, 1) = 4),
  ending text check (ending in ('good', 'funny')),
  endings_seen text[] not null default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.mansion_progress (id) values (1) on conflict (id) do nothing;

create table if not exists public.mansion_presses (
  user_id uuid not null references auth.users (id) on delete cascade,
  button text not null check (button in ('hearth', 'oven')),
  pressed_at timestamptz not null default now(),
  primary key (user_id, button)
);

alter table public.mansion_progress enable row level security;
alter table public.mansion_presses enable row level security;
revoke all on public.mansion_progress, public.mansion_presses from anon, authenticated;
grant select on public.mansion_progress to authenticated;

drop policy if exists "members see the mansion" on public.mansion_progress;
create policy "members see the mansion" on public.mansion_progress for select to authenticated using (public.is_couple_member());

-- ── 3. the rules ─────────────────────────────────────────────────────────────

/** What a step (or an heirloom) needs first; null for something that isn't part of the story. */
create or replace function public.mansion_needs(p_step text)
returns text[]
language sql
immutable
as $$
  select case p_step
    when 'enter' then '{}'::text[]
    when 'diary' then '{enter}'
    when 'cici' then '{enter}'
    when 'library_open' then '{diary}'
    when 'mirror' then '{diary}'
    when 'key_a' then '{diary}'
    when 'key_b' then '{mirror}'
    when 'basement_open' then '{key_a,key_b}'
    when 'bookcase' then '{library_open}'
    when 'dial_open' then '{bookcase}'
    when 'safe' then '{basement_open}'
    when 'attic_open' then '{dial_open,safe}'
    when 'boss_seen' then '{attic_open}'
    when 'boss_done' then '{boss_seen}'
    -- the heirlooms
    when 'watch' then '{diary}'
    when 'hat' then '{key_a}'
    when 'musicbox' then '{bookcase}'
    when 'candle' then '{safe}'
    else null
  end
$$;

/**
 * A step of the story (or an heirloom found). Only if its prerequisites are done; doing it twice
 * (or both at once) changes nothing. The two levers, the wheels and the safe have their own functions.
 */
create or replace function public.mansion_step(p_step text)
returns public.mansion_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.mansion_progress;
  needs text[];
begin
  perform public.date_check_member();
  needs := public.mansion_needs(p_step);
  if needs is null or p_step in ('library_open', 'dial_open', 'safe') then
    raise exception 'no such step';
  end if;
  select * into p from public.mansion_progress where id = 1 for update;
  if not (needs <@ p.steps) then
    return p;
  end if;
  if p_step in ('watch', 'hat', 'musicbox', 'candle') then
    if not (p_step = any(p.items)) then
      update public.mansion_progress set items = array_append(items, p_step), updated_at = now() where id = 1 returning * into p;
    end if;
  elsif not (p_step = any(p.steps)) then
    update public.mansion_progress
       set steps = array_append(steps, p_step),
           run_id = coalesce(run_id, gen_random_uuid()),
           started_at = coalesce(started_at, now()),
           updated_at = now()
     where id = 1 returning * into p;
  end if;
  return p;
end;
$$;

/**
 * One of the two levers (the hearth in the living room, the oven in the kitchen). The library opens
 * when the other lever was turned within 3 seconds by the other person — or within 7 seconds by the
 * same person (alone, running between them).
 */
create or replace function public.mansion_press(p_button text)
returns public.mansion_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.mansion_progress;
  other text;
  together boolean;
begin
  perform public.date_check_member();
  if p_button not in ('hearth', 'oven') then
    raise exception 'no such lever';
  end if;
  other := case p_button when 'hearth' then 'oven' else 'hearth' end;
  insert into public.mansion_presses (user_id, button, pressed_at) values (auth.uid(), p_button, now())
  on conflict (user_id, button) do update set pressed_at = excluded.pressed_at;
  select * into p from public.mansion_progress where id = 1 for update;
  if 'library_open' = any(p.steps) or not ('diary' = any(p.steps)) then
    return p;
  end if;
  select exists (
    select 1 from public.mansion_presses
     where button = other
       and ((user_id <> auth.uid() and pressed_at > now() - interval '3 seconds')
         or (user_id = auth.uid() and pressed_at > now() - interval '7 seconds'))
  ) into together;
  if together then
    update public.mansion_progress set steps = array_append(steps, 'library_open'), updated_at = now() where id = 1 returning * into p;
  end if;
  return p;
end;
$$;

/** Turn one of the four symbol wheels (0…3) to a symbol (0…5). The right order opens the first lock. */
create or replace function public.mansion_dial(p_wheel smallint, p_symbol smallint)
returns public.mansion_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.mansion_progress;
begin
  perform public.date_check_member();
  if p_wheel < 0 or p_wheel > 3 or p_symbol < 0 or p_symbol > 5 then
    raise exception 'no such wheel or symbol';
  end if;
  select * into p from public.mansion_progress where id = 1 for update;
  if not ('bookcase' = any(p.steps)) or 'dial_open' = any(p.steps) then
    return p;
  end if;
  update public.mansion_progress set dial[p_wheel + 1] = p_symbol, updated_at = now() where id = 1 returning * into p;
  -- 🌙 🍄 🐔 🕯️ (the four paintings, I to IV)
  if p.dial = '{1,0,4,3}'::smallint[] then
    update public.mansion_progress set steps = array_append(steps, 'dial_open'), updated_at = now() where id = 1 returning * into p;
  end if;
  return p;
end;
$$;

/** The basement safe's three digits (the book's cipher, read off the boiler room wall). */
create or replace function public.mansion_code(p_code text)
returns public.mansion_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.mansion_progress;
begin
  perform public.date_check_member();
  select * into p from public.mansion_progress where id = 1 for update;
  if not ('basement_open' = any(p.steps)) or 'safe' = any(p.steps) then
    return p;
  end if;
  if p_code = '297' then
    update public.mansion_progress set steps = array_append(steps, 'safe'), updated_at = now() where id = 1 returning * into p;
  end if;
  return p;
end;
$$;

/**
 * How the story ends, once a run (the first choice counts, for both of you). The good ending needs
 * all four heirlooms. Each ending's gift for the house (and 15 heart coins) is given once, ever.
 */
create or replace function public.mansion_end(p_ending text)
returns public.mansion_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.mansion_progress;
  first_time boolean;
begin
  perform public.date_check_member();
  if p_ending not in ('good', 'funny') then
    raise exception 'no such ending';
  end if;
  select * into p from public.mansion_progress where id = 1 for update;
  if p.ending is not null or not ('boss_done' = any(p.steps)) then
    return p;
  end if;
  if p_ending = 'good' and not ('{watch,hat,musicbox,candle}'::text[] <@ p.items) then
    return p;
  end if;
  first_time := not (p_ending = any(p.endings_seen));
  update public.mansion_progress
     set ending = p_ending,
         endings_seen = case when first_time then array_append(endings_seen, p_ending) else endings_seen end,
         ended_at = now(),
         updated_at = now()
   where id = 1 returning * into p;
  if first_time then
    insert into public.keepsakes (kind) values (case p_ending when 'good' then 'mansion_clock' else 'ghost_disco' end) on conflict (kind) do nothing;
    update public.house set coins = coins + 15 where id = 1;
  end if;
  return p;
end;
$$;

/** Play again from the start (the endings you've seen stay seen). */
create or replace function public.mansion_reset()
returns public.mansion_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.mansion_progress;
begin
  perform public.date_check_member();
  update public.mansion_progress
     set run_id = null, steps = '{}', items = '{}', dial = '{0,0,0,0}', ending = null,
         started_at = null, ended_at = null, updated_at = now()
   where id = 1 returning * into p;
  delete from public.mansion_presses;
  return p;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['mansion_step(text)', 'mansion_press(text)', 'mansion_dial(smallint, smallint)',
                           'mansion_code(text)', 'mansion_end(text)', 'mansion_reset()']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.mansion_needs(text) from public;

-- ── 4. live updates (on the private room channel) ────────────────────────────
do $$ begin alter publication supabase_realtime add table public.mansion_progress; exception when duplicate_object then null; end $$;
