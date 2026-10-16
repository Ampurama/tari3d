-- ─────────────────────────────────────────────────────────────────────────────
--  OUR LITTLE HOME — plants that need watering (like The Sims).
--
--  Run this once in the Supabase SQL editor, AFTER 002_our_home.sql. Safe to run again.
--
--  Every plant in the house (potted plant, flower bed, bush, flowering tree, vase of flowers)
--  remembers when it was last watered and how well it has been cared for. Either of you can water
--  it; the other sees it happen live. Plants get thirsty with real time (even while the game is
--  closed), droop when they've been forgotten, and grow fuller and bloom with care. They never die:
--  a little water always brings them back.
--
--  Rollback:
--    drop function if exists public.water_plant(uuid);
--    alter table public.house_items drop column if exists watered_at, drop column if exists care;
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.house_items add column if not exists watered_at timestamptz;
alter table public.house_items add column if not exists care smallint not null default 0;
alter table public.house_items alter column watered_at set default now();

-- the plants already in the house start freshly watered
-- (the furniture trigger only lets the two of you change items, and this runs as the database
--  owner, so it's switched off for this one backfill and straight back on)
alter table public.house_items disable trigger house_items_before_write;
update public.house_items set watered_at = now() where watered_at is null;
alter table public.house_items enable trigger house_items_before_write;

-- Water a plant. Anyone in the private room may; it can't be used on anything that isn't a plant.
-- Watering always quenches its thirst; it only counts toward growing once every 4 hours
-- (so care is about coming back, not about tapping many times).
create or replace function public.water_plant(item uuid)
returns public.house_items
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.house_items;
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
  update public.house_items
     set watered_at = now(),
         care = least(99, care + case when it.watered_at is null or it.watered_at < now() - interval '4 hours' then 1 else 0 end)
   where id = item
  returning * into it;
  return it;
end;
$$;

revoke all on function public.water_plant(uuid) from public;
grant execute on function public.water_plant(uuid) to authenticated;
