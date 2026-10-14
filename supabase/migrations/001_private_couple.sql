-- ─────────────────────────────────────────────────────────────────────────────
--  OUR LITTLE UNIVERSE — the private room for exactly two people.
--
--  Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--  Every rule below is enforced by Postgres / Supabase Realtime on the server:
--  the website cannot bypass it, and no display name, URL or room code is trusted.
--
--  After running it, add the two people (see the bottom of this file).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The two members ───────────────────────────────────────────────────────
-- Exactly two possible rows: one 'owner' and one 'tari' (the role is unique).
create table if not exists public.couple_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null unique check (role in ('owner', 'tari')),
  created_at timestamptz not null default now()
);

alter table public.couple_members enable row level security;

-- Is the signed-in user one of the two? (security definer so policies can use it
-- without exposing the table; stable so Postgres can cache it within a statement)
create or replace function public.is_couple_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.couple_members where user_id = auth.uid());
$$;

revoke all on function public.is_couple_member() from public;
grant execute on function public.is_couple_member() to authenticated;

-- Members can see the two member rows (to know who their partner is). Nobody can
-- add, change or remove members through the API — only you, here in the dashboard.
revoke all on public.couple_members from anon, authenticated;
grant select on public.couple_members to authenticated;

drop policy if exists "members can see the couple" on public.couple_members;
create policy "members can see the couple"
  on public.couple_members for select
  to authenticated
  using (public.is_couple_member());

-- ── 2. Letters in a bottle ───────────────────────────────────────────────────
create table if not exists public.bottles (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  opened_at timestamptz
);

alter table public.bottles enable row level security;

-- The sender is always the signed-in user and the recipient is always the *other*
-- member — set on the server, so the browser can't send as someone else or to anyone else.
create or replace function public.bottles_set_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select user_id into partner from public.couple_members where user_id <> auth.uid() limit 1;
  if partner is null then
    raise exception 'the other person has not joined yet';
  end if;
  new.sender := auth.uid();
  new.recipient := partner;
  new.created_at := now();
  new.opened_at := null;
  return new;
end;
$$;

drop trigger if exists bottles_set_people on public.bottles;
create trigger bottles_set_people
  before insert on public.bottles
  for each row execute function public.bottles_set_people();

-- Column-level rights: a member may only write the letter's text, and later mark a
-- letter they received as opened. Nothing can be edited or deleted from the website.
revoke all on public.bottles from anon, authenticated;
grant select on public.bottles to authenticated;
grant insert (body) on public.bottles to authenticated;
grant update (opened_at) on public.bottles to authenticated;

drop policy if exists "members read their letters" on public.bottles;
create policy "members read their letters"
  on public.bottles for select
  to authenticated
  using (public.is_couple_member() and (sender = auth.uid() or recipient = auth.uid()));

drop policy if exists "members send letters" on public.bottles;
create policy "members send letters"
  on public.bottles for insert
  to authenticated
  with check (public.is_couple_member() and sender = auth.uid());

drop policy if exists "recipient opens a letter" on public.bottles;
create policy "recipient opens a letter"
  on public.bottles for update
  to authenticated
  using (public.is_couple_member() and recipient = auth.uid())
  with check (public.is_couple_member() and recipient = auth.uid());

-- New letters arrive live (Realtime applies the select policy above to each change).
do $$
begin
  alter publication supabase_realtime add table public.bottles;
exception when duplicate_object then null;
end $$;

-- ── 3. Realtime authorization (private channels) ────────────────────────────
-- Each person broadcasts their character on their OWN topic: "couple-player:<their user id>".
-- Only members may listen to couple topics, and a member may only send on their own
-- player topic — so each identity can only move its own character.
-- (Also switch on "Private channels only" in Dashboard → Realtime → Settings.)
-- Row Level Security is already on for realtime.messages (Supabase owns that table),
-- so only the policies are added here.

drop policy if exists "couple members can listen" on realtime.messages;
create policy "couple members can listen"
  on realtime.messages for select
  to authenticated
  using (
    public.is_couple_member()
    and (
      (select realtime.topic()) like 'couple-player:%'
      or (select realtime.topic()) = 'couple-letters:' || auth.uid()::text
    )
  );

drop policy if exists "couple members send their own moves" on realtime.messages;
create policy "couple members send their own moves"
  on realtime.messages for insert
  to authenticated
  with check (
    public.is_couple_member()
    and realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'couple-player:' || auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
--  ADD THE TWO OF YOU (run after creating both accounts in Authentication → Users):
--
--  insert into public.couple_members (user_id, role)
--    select id, 'owner' from auth.users where email = 'ampuramar@gmail.com';
--  insert into public.couple_members (user_id, role)
--    select id, 'tari'  from auth.users where email = 'utarianisadwi17@gmail.com';
--
--  Anyone else who somehow gets an account is not in this table, so every policy
--  above denies them: no room, no characters, no letters.
-- ─────────────────────────────────────────────────────────────────────────────
