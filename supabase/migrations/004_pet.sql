-- ─────────────────────────────────────────────────────────────────────────────
--  ADOPT A PET — one shared pet for the two of you.
--
--  Run this once in the Supabase SQL editor, AFTER 001, 002 and 003. Safe to run again.
--
--  The pet is a single row (it can never be adopted twice). Where it walks and what it's
--  doing moment to moment is worked out in each game from this row, so nothing about its
--  movement is written here. Holding hands needs nothing in the database: it travels on the
--  private Realtime channel from 001, which only the two of you can use, and where each of
--  you can only speak for yourself.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pets (
  id smallint primary key default 1 check (id = 1),
  kind text not null check (kind in ('cat', 'dog')),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  accessory text not null default 'none' check (accessory in ('none', 'ribbon', 'bell', 'scarf')),
  mode text not null default 'home' check (mode in ('home', 'follow')),
  follow_target uuid references auth.users (id) on delete set null,
  adopted_by uuid references auth.users (id) on delete set null,
  adopted_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.pets enable row level security;

-- members may read it, and rename it / change its accessory; everything else goes through the functions
revoke all on public.pets from anon, authenticated;
grant select on public.pets to authenticated;
grant update (name, accessory) on public.pets to authenticated;

drop policy if exists "members see the pet" on public.pets;
create policy "members see the pet"
  on public.pets for select
  to authenticated
  using (public.is_couple_member());

drop policy if exists "members name the pet" on public.pets;
create policy "members name the pet"
  on public.pets for update
  to authenticated
  using (public.is_couple_member())
  with check (public.is_couple_member());

create or replace function public.pets_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  new.id := old.id;
  new.kind := old.kind;
  new.adopted_by := old.adopted_by;
  new.adopted_at := old.adopted_at;
  new.name := btrim(new.name);
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pets_before_update on public.pets;
create trigger pets_before_update
  before update on public.pets
  for each row execute function public.pets_before_update();

/** Adopt: only ever creates the one pet. Asking again just returns the pet you already have. */
create or replace function public.pet_adopt(p_kind text, p_name text)
returns public.pets
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.pets;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  insert into public.pets (id, kind, name, adopted_by)
  values (1, p_kind, btrim(p_name), auth.uid())
  on conflict (id) do nothing;
  select * into p from public.pets where id = 1;
  return p;
end;
$$;

/**
 * "Ajak Ikut" (follow me) or "Kembali ke Rumah". The pet can only be asked to follow the person
 * asking — never told to follow someone else.
 */
create or replace function public.pet_command(p_mode text)
returns public.pets
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.pets;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  if p_mode not in ('home', 'follow') then
    raise exception 'unknown command';
  end if;
  update public.pets
     set mode = p_mode, follow_target = case when p_mode = 'follow' then auth.uid() else null end
   where id = 1
   returning * into p;
  if not found then raise exception 'no pet yet'; end if;
  return p;
end;
$$;

revoke all on function public.pet_adopt(text, text) from public;
grant execute on function public.pet_adopt(text, text) to authenticated;
revoke all on function public.pet_command(text) from public;
grant execute on function public.pet_command(text) to authenticated;

-- A pet bed for the house catalog (inside the house).
alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard', 'pet_bed'))
  or (area = 'garden' and kind in ('flowers', 'bush', 'lantern', 'garden_bench', 'small_tree'))
);

do $$
begin
  alter publication supabase_realtime add table public.pets;
exception when duplicate_object then null;
end $$;
