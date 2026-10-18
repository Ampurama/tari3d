-- ─────────────────────────────────────────────────────────────────────────────
--  GNOME CARNIVAL — DREAMLIGHT FUNFAIR: the booth games' scores and prizes.
--
--  Run this once in the Supabase SQL editor, AFTER 011_gnome_village.sql. Safe to run again.
--  Nothing existing is removed or reset: it only adds.
--
--    • carnival_scores: each person's best score at each booth game (both of you can see both)
--    • carnival_score(game, score): saves a game played to the end. The server checks the score
--      is possible for that game, keeps the best, unlocks the booth's prize for the house once
--      (for both of you) when the score is good enough, and gives a few heart coins for a winning
--      game — at most once every 15 minutes per game, so playing again and again isn't a coin farm
--    • three prizes for the house: a gnome plush, a carnival lantern, a bunch of heart balloons
--      (keepsakes, like the ones from dates, Sky Island and the village)
--
--  The rides need nothing here: they run on the shared clock, and who sits where travels with each
--  character (Realtime broadcast), never stored.
--
--  Rollback:
--    drop function if exists public.carnival_score(text, integer);
--    drop table if exists public.carnival_scores;
--    (then run the keepsakes / kind constraints and house_items_before_write() from 011 again)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. the prizes, as things for the house ───────────────────────────────────
alter table public.keepsakes drop constraint if exists keepsakes_kind_check;
alter table public.keepsakes add constraint keepsakes_kind_check
  check (kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard', 'star_lamp', 'sky_lantern',
                  'mushroom_lamp', 'bread_basket', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern',
                  'gnome_plush', 'carnival_lantern', 'balloon_bunch'));

alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed', 'star_lamp', 'sky_lantern',
                                'stove', 'fridge', 'bathtub', 'tv', 'wall_panel', 'wall_arch',
                                'mushroom_stool', 'toadstool_table', 'mushroom_lamp', 'bread_basket',
                                'gnome_plush'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree',
                                   'gnome_lantern', 'flower_pot', 'moon_flower', 'gnome_statue', 'crystal_shroom', 'twin_lantern',
                                   'carnival_lantern', 'balloon_bunch'))
);

-- keepsakes (the fair's prizes too) can only be placed once they're unlocked
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
                    'gnome_plush', 'carnival_lantern', 'balloon_bunch')
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

-- ── 2. best scores ───────────────────────────────────────────────────────────
create table if not exists public.carnival_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('ringtoss', 'cans', 'shooting')),
  best integer not null default 0 check (best >= 0),
  plays integer not null default 0,
  rewarded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.carnival_scores enable row level security;
revoke all on public.carnival_scores from anon, authenticated;
grant select on public.carnival_scores to authenticated;

drop policy if exists "members see the carnival scores" on public.carnival_scores;
create policy "members see the carnival scores"
  on public.carnival_scores for select
  to authenticated
  using (public.is_couple_member());

/*
 * A booth game played to the end. Returns { best, coins, prize } — prize: the score was good
 * enough for the booth's prize (it's unlocked for the house, once, for both of you).
 */
create or replace function public.carnival_score(game text, score integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  top integer;
  win integer;
  gift text;
  reward integer;
  rec public.carnival_scores;
  coins_added integer := 0;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select m, w, g, c into top, win, gift, reward from (values
    ('ringtoss', 5, 3, 'gnome_plush', 4),
    ('cans', 6, 6, 'carnival_lantern', 4),
    ('shooting', 99, 18, 'balloon_bunch', 4)
  ) as t(k, m, w, g, c) where t.k = game;
  if top is null then
    raise exception 'unknown game';
  end if;
  if score is null or score < 0 or score > top then
    raise exception 'that score is not possible';
  end if;
  insert into public.carnival_scores as s (user_id, game, best, plays)
  values (auth.uid(), game, score, 1)
  on conflict on constraint carnival_scores_pkey
  do update set best = greatest(s.best, excluded.best), plays = s.plays + 1, updated_at = now()
  returning * into rec;
  if score >= win then
    insert into public.keepsakes (kind) values (gift) on conflict (kind) do nothing;
    -- a few coins for a winning game, at most once every 15 minutes per game
    if rec.rewarded_at is null or rec.rewarded_at < now() - interval '15 minutes' then
      update public.house set coins = coins + reward where id = 1;
      update public.carnival_scores s set rewarded_at = now() where s.user_id = auth.uid() and s.game = game;
      coins_added := reward;
    end if;
  end if;
  return jsonb_build_object('best', rec.best, 'coins', coins_added, 'prize', score >= win);
end;
$$;

revoke all on function public.carnival_score(text, integer) from public;
grant execute on function public.carnival_score(text, integer) to authenticated;
