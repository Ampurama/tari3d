-- ─────────────────────────────────────────────────────────────────────────────
--  OUR LITTLE HOME — living in it, like The Sims.
--
--  Run this once in the Supabase SQL editor, AFTER 008_plant_care.sql. Safe to run again.
--
--    • heart coins (koin hati) you share: the house starts with 150; buying furniture costs coins
--      (the server charges them, and refunds them if you take a piece away); you earn coins by
--      living in the house — cooking, sleeping, reading, a bath, watering the plants, and the
--      things you do together — each with a little wait before it counts again
--    • every piece of furniture can come in a few colours (variant 0–3), free to change
--    • the walls and the floor can be redone (a small price per change)
--    • new furniture: a stove, a fridge, a bathtub and a TV
--
--  Prices live in public.item_price() below and must match `price` in src/lib/homeLayout.js.
--
--  Rollback:
--    drop trigger if exists house_items_charge on public.house_items;
--    drop trigger if exists house_items_refund on public.house_items;
--    drop function if exists public.house_items_charge(), public.item_price(text), public.house_reward(text), public.house_style(text, text);
--    drop table if exists public.house_rewards;
--    alter table public.house drop column if exists coins, drop column if exists wall_style, drop column if exists floor_style;
--    alter table public.house_items drop column if exists variant;
--    (then run the kind constraint and water_plant() from 005 / 008 again)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. coins, styles, colours ────────────────────────────────────────────────
alter table public.house add column if not exists coins integer not null default 150;
alter table public.house add column if not exists wall_style text not null default 'krem';
alter table public.house add column if not exists floor_style text not null default 'kayu';
alter table public.house drop constraint if exists house_styles;
alter table public.house add constraint house_styles check (
  wall_style in ('krem', 'blush', 'sage', 'lavender', 'langit', 'bintik')
  and floor_style in ('kayu', 'walnut', 'putih', 'pink', 'kotak')
);
alter table public.house drop constraint if exists house_coins;
alter table public.house add constraint house_coins check (coins >= 0);

alter table public.house_items add column if not exists variant smallint not null default 0;
alter table public.house_items drop constraint if exists house_items_variant;
alter table public.house_items add constraint house_items_variant check (variant between 0 and 3);

-- ── 2. new furniture ─────────────────────────────────────────────────────────
alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed', 'star_lamp', 'sky_lantern',
                                'stove', 'fridge', 'bathtub', 'tv'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree'))
);

-- placing a piece may choose its colour; moving it may repaint it (free)
grant insert (id, kind, area, x, z, rot, variant) on public.house_items to authenticated;
grant update (x, z, rot, variant) on public.house_items to authenticated;

-- ── 3. prices: buying charges the shared coins, taking a piece away refunds them ──
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
    when 'flowers' then 12 when 'bush' then 10 when 'lantern' then 12 when 'garden_bench' then 25 when 'small_tree' then 30
    else 0 -- keepsakes from dates and Sky Island are gifts
  end
$$;

create or replace function public.house_items_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  price integer;
begin
  if tg_op = 'INSERT' then
    price := public.item_price(new.kind);
    if price > 0 then
      update public.house set coins = coins - price where id = 1 and coins >= price;
      if not found then
        raise exception 'not enough coins';
      end if;
    end if;
    return new;
  end if;
  -- DELETE: the coins come back
  price := public.item_price(old.kind);
  if price > 0 then
    update public.house set coins = coins + price where id = 1;
  end if;
  return old;
end;
$$;

drop trigger if exists house_items_charge on public.house_items;
create trigger house_items_charge
  before insert on public.house_items
  for each row execute function public.house_items_charge();
drop trigger if exists house_items_refund on public.house_items;
create trigger house_items_refund
  after delete on public.house_items
  for each row execute function public.house_items_charge();

-- ── 4. earning coins by living in the house ──────────────────────────────────
-- each of you, each activity: it counts again after its little wait
create table if not exists public.house_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  act text not null,
  last_at timestamptz not null default now(),
  primary key (user_id, act)
);
alter table public.house_rewards enable row level security;
revoke all on public.house_rewards from anon, authenticated;

-- returns how many coins it added (0 if it was too soon), so the game can say so
create or replace function public.house_reward(act text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  coins_for integer;
  wait interval;
  prev timestamptz;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select c, w into coins_for, wait from (values
    ('cook', 6, interval '30 minutes'),
    ('sleep', 5, interval '3 hours'),
    ('read', 3, interval '30 minutes'),
    ('bath', 4, interval '1 hour'),
    ('eat', 3, interval '30 minutes'),
    ('snack', 1, interval '20 minutes'),
    ('tv', 2, interval '30 minutes'),
    ('together', 8, interval '20 minutes')
  ) as t(a, c, w) where t.a = act;
  if coins_for is null then
    raise exception 'unknown activity';
  end if;
  select r.last_at into prev from public.house_rewards r where r.user_id = auth.uid() and r.act = house_reward.act;
  if prev is not null and prev > now() - wait then
    return 0;
  end if;
  insert into public.house_rewards (user_id, act, last_at) values (auth.uid(), house_reward.act, now())
  on conflict (user_id, act) do update set last_at = now();
  update public.house set coins = coins + coins_for where id = 1;
  return coins_for;
end;
$$;
revoke all on function public.house_reward(text) from public;
grant execute on function public.house_reward(text) to authenticated;

-- watering a plant now also earns 2 coins (when it counts toward growing: once every 4 hours)
create or replace function public.water_plant(item uuid)
returns public.house_items
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.house_items;
  counts boolean;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into it from public.house_items where id = item for update;
  if not found then
    raise exception 'no such item';
  end if;
  if it.kind not in ('plant', 'flowers', 'bush', 'small_tree', 'vase') then
    raise exception 'not a plant';
  end if;
  counts := it.watered_at is null or it.watered_at < now() - interval '4 hours';
  update public.house_items
     set watered_at = now(),
         care = least(99, care + case when counts then 1 else 0 end)
   where id = item
  returning * into it;
  if counts then
    update public.house set coins = coins + 2 where id = 1;
  end if;
  return it;
end;
$$;
revoke all on function public.water_plant(uuid) from public;
grant execute on function public.water_plant(uuid) to authenticated;

-- ── 5. redoing the walls and the floor (15 coins for each part that changes) ──
create or replace function public.house_style(new_wall text, new_floor text)
returns public.house
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.house;
  cost integer := 0;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into h from public.house where id = 1 for update;
  if new_wall is distinct from h.wall_style then cost := cost + 15; end if;
  if new_floor is distinct from h.floor_style then cost := cost + 15; end if;
  if cost = 0 then
    return h;
  end if;
  if h.coins < cost then
    raise exception 'not enough coins';
  end if;
  update public.house set wall_style = new_wall, floor_style = new_floor, coins = coins - cost where id = 1 returning * into h;
  return h;
end;
$$;
revoke all on function public.house_style(text, text) from public;
grant execute on function public.house_style(text, text) to authenticated;
