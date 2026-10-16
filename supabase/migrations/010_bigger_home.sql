-- ─────────────────────────────────────────────────────────────────────────────
--  OUR LITTLE HOME — a bigger house, and rooms you build yourselves.
--
--  Run this once in the Supabase SQL editor, AFTER 009_sims_home.sql. Safe to run again.
--
--    • house.size: 1 Kecil (the house you have) → 2 Sedang (120 coins) → 3 Besar (250 coins).
--      It grows wider and deeper toward the back; the front wall, the door, the porch and the
--      garden stay where they are, so nothing already placed moves. It can't grow over garden
--      things: move those first (the game says which).
--    • from "Sedang" on there's no built-in partition: build your own rooms with wall pieces
--      (wall_panel "Dinding sekat", wall_arch "Sekat berpintu").
--    • the inside of the house is checked against its real size.
--
--  The sizes here must match HOUSE_SIZES in src/lib/homeLayout.js (half-width hw, half-depth hd,
--  front wall at z = 2.3; the room is 0.15 inside the walls).
--
--  Rollback (only while the house is still size 1):
--    drop trigger if exists house_items_inside_room on public.house_items;
--    drop function if exists public.house_items_inside_room(), public.house_grow(smallint);
--    alter table public.house drop column if exists size;
--    (then run the kind / bounds constraints from 009 / 002 and item_price() from 009 again)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.house add column if not exists size smallint not null default 1;
alter table public.house drop constraint if exists house_size;
alter table public.house add constraint house_size check (size between 1 and 3);

-- the wall pieces
alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed', 'star_lamp', 'sky_lantern',
                                'stove', 'fridge', 'bathtub', 'tv', 'wall_panel', 'wall_arch'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree'))
);

-- the outer bounds now allow the largest house (the real room is checked by the trigger below)
alter table public.house_items drop constraint if exists house_items_bounds;
alter table public.house_items add constraint house_items_bounds check (
  (area = 'inside' and x between -4.35 and 4.35 and z between -4.35 and 2.15)
  or (area = 'garden' and x between -8 and 8 and z between -6.5 and 10)
);

-- prices (009's list, plus the wall pieces)
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
    else 0
  end
$$;

-- half-width / half-depth of the house for a size (the front wall is at z = 2.3)
create or replace function public.house_dims(s smallint, out hw real, out hd real)
language sql
immutable
as $$
  select case s when 3 then 4.5 when 2 then 3.9 else 3.2 end::real,
         case s when 3 then 3.4 when 2 then 2.9 else 2.3 end::real
$$;

-- every piece inside has to be inside the room as big as it is now
create or replace function public.house_items_inside_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cur smallint;
  d record;
begin
  if new.area <> 'inside' then
    return new;
  end if;
  select size into cur from public.house where id = 1;
  select * into d from public.house_dims(coalesce(cur, 1));
  if new.x < -(d.hw - 0.15) or new.x > d.hw - 0.15 or new.z < 2.3 - 2 * d.hd + 0.15 or new.z > 2.15 then
    raise exception 'outside the house';
  end if;
  return new;
end;
$$;
drop trigger if exists house_items_inside_room on public.house_items;
create trigger house_items_inside_room
  before insert or update on public.house_items
  for each row execute function public.house_items_inside_room();

-- make the house bigger: `expected` is the size the button was pressed on (so it only happens once)
create or replace function public.house_grow(expected smallint)
returns public.house
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.house;
  price integer;
  d record;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into h from public.house where id = 1 for update;
  if h.size <> expected or h.size >= 3 then
    return h;
  end if;
  if h.stage < 2 then
    raise exception 'build the cottage first';
  end if;
  price := case h.size when 1 then 120 else 250 end;
  if h.coins < price then
    raise exception 'not enough coins';
  end if;
  -- the bigger house (with a little margin) mustn't land on anything in the garden
  select * into d from public.house_dims((h.size + 1)::smallint);
  if exists (
    select 1 from public.house_items
     where area = 'garden'
       and x between -(d.hw + 0.6) and d.hw + 0.6
       and z between 2.3 - 2 * d.hd - 0.6 and 2.3
  ) then
    raise exception 'clear the garden';
  end if;
  update public.house set size = size + 1, coins = coins - price where id = 1 returning * into h;
  return h;
end;
$$;
revoke all on function public.house_grow(smallint) from public;
grant execute on function public.house_grow(smallint) to authenticated;
