-- ─────────────────────────────────────────────────────────────────────────────
--  OUR LITTLE HOME — one shared house for the two of you.
--
--  Run this once in the Supabase SQL editor, AFTER 001_private_couple.sql
--  (it uses public.is_couple_member() from that file). It is safe to run again.
--
--  Every rule is enforced here on the server: only the two members can see or change
--  the house, furniture types and positions are validated, and the website can't
--  skip building stages or pretend to be the other person.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The house (exactly one row) ──────────────────────────────────────────
create table if not exists public.house (
  id smallint primary key default 1 check (id = 1),
  stage smallint not null default 1 check (stage between 1 and 5),
  memory_title text check (char_length(memory_title) <= 60),
  memory_date date,
  memory_note text check (char_length(memory_note) <= 200),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.house (id) values (1) on conflict (id) do nothing;

alter table public.house enable row level security;

-- Who changed it is always the signed-in user. Only the owner picks the special date.
create or replace function public.house_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  if new.memory_date is distinct from old.memory_date
     and not exists (select 1 from public.couple_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'only the owner picks the special date';
  end if;
  new.id := old.id;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists house_before_update on public.house;
create trigger house_before_update
  before update on public.house
  for each row execute function public.house_before_update();

-- Members may read the house and edit the memory corner. The stage can only change
-- through house_upgrade() below (no column grant for it).
revoke all on public.house from anon, authenticated;
grant select on public.house to authenticated;
grant update (memory_title, memory_date, memory_note) on public.house to authenticated;

drop policy if exists "members see the house" on public.house;
create policy "members see the house"
  on public.house for select
  to authenticated
  using (public.is_couple_member());

drop policy if exists "members edit the memory corner" on public.house;
create policy "members edit the memory corner"
  on public.house for update
  to authenticated
  using (public.is_couple_member())
  with check (public.is_couple_member());

-- ── 2. Furniture and garden decorations ─────────────────────────────────────
-- Positions are in metres relative to the house, in quarter turns. The id is made by the
-- browser once per new item, so a retried or repeated request can never make a duplicate.
create table if not exists public.house_items (
  id uuid primary key,
  kind text not null,
  area text not null check (area in ('inside', 'garden')),
  x real not null,
  z real not null,
  rot smallint not null default 0 check (rot between 0 and 3),
  version integer not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint house_items_kind check (
    (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase'))
    or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree'))
  ),
  constraint house_items_bounds check (
    (area = 'inside' and x between -3.05 and 3.05 and z between -2.15 and 2.15)
    or (area = 'garden' and x between -8 and 8 and z between -6.5 and 10)
  )
);

alter table public.house_items enable row level security;

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
    if (select count(*) from public.house_items) >= 80 then
      raise exception 'the house is full';
    end if;
    new.version := 1;
    new.created_by := auth.uid();
  else
    -- an item never changes what it is; every accepted change bumps its version
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

drop trigger if exists house_items_before_write on public.house_items;
create trigger house_items_before_write
  before insert or update on public.house_items
  for each row execute function public.house_items_before_write();

revoke all on public.house_items from anon, authenticated;
grant select, delete on public.house_items to authenticated;
grant insert (id, kind, area, x, z, rot) on public.house_items to authenticated;
grant update (x, z, rot) on public.house_items to authenticated;

drop policy if exists "members see the furniture" on public.house_items;
create policy "members see the furniture"
  on public.house_items for select
  to authenticated
  using (public.is_couple_member());

drop policy if exists "members place furniture" on public.house_items;
create policy "members place furniture"
  on public.house_items for insert
  to authenticated
  with check (public.is_couple_member());

drop policy if exists "members move furniture" on public.house_items;
create policy "members move furniture"
  on public.house_items for update
  to authenticated
  using (public.is_couple_member())
  with check (public.is_couple_member());

drop policy if exists "members remove furniture" on public.house_items;
create policy "members remove furniture"
  on public.house_items for delete
  to authenticated
  using (public.is_couple_member());

-- ── 3. Building the next stage (atomic, and only once even if you both press it) ──
-- `expected` is the stage the button was pressed on: if the other person already upgraded,
-- nothing happens twice. Each stage asks for a little something first.
create or replace function public.house_upgrade(expected smallint)
returns public.house
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.house;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into h from public.house where id = 1 for update;
  if h.stage <> expected or h.stage >= 5 then
    return h;
  end if;
  if h.stage = 2 and (select count(*) from public.house_items where area = 'inside') < 3 then
    raise exception 'need: 3 furniture inside';
  end if;
  if h.stage = 3 and (select count(*) from public.house_items where area = 'garden') < 2 then
    raise exception 'need: 2 garden decorations';
  end if;
  if h.stage = 4 and coalesce(btrim(h.memory_title), '') = '' then
    raise exception 'need: a title for the memory corner';
  end if;
  update public.house set stage = stage + 1 where id = 1 returning * into h;
  return h;
end;
$$;

revoke all on function public.house_upgrade(smallint) from public;
grant execute on function public.house_upgrade(smallint) to authenticated;

-- ── 4. Live updates ─────────────────────────────────────────────────────────
-- Changes reach the other person through the private "couple-letters:<their id>" channel
-- (already authorized in 001); Realtime applies the select policies above to each change.
do $$
begin
  alter publication supabase_realtime add table public.house;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.house_items;
exception when duplicate_object then null;
end $$;
