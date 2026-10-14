-- ─────────────────────────────────────────────────────────────────────────────
--  VIRTUAL DATES, KEEPSAKES AND THE HOUSE LIGHTS
--
--  Run this once in the Supabase SQL editor, AFTER 001_private_couple.sql and
--  002_our_home.sql. It is safe to run again.
--
--  A date goes: pending → accepted → preparing → active → completed
--  (or cancelled / interrupted along the way). Every step goes through a function
--  below that checks who is asking: each person can only answer, get ready or leave
--  for themselves, never for the other one. Only one date can be open at a time.
--  What happens moment to moment (walking, sitting, waving) is never stored here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. House lights (shared: when one of you turns them off, they're off for both) ──
alter table public.house add column if not exists lights_on boolean not null default true;
alter table public.house add column if not exists fairy_on boolean not null default true;
grant update (lights_on, fairy_on) on public.house to authenticated;

-- ── 2. Dates ────────────────────────────────────────────────────────────────
create table if not exists public.date_sessions (
  id uuid primary key,
  kind text not null check (kind in ('sunset_picnic', 'dinner_home', 'camping', 'lakeside')),
  initiator uuid not null references auth.users (id) on delete cascade,
  invitee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'preparing', 'active', 'completed', 'cancelled', 'interrupted')),
  initiator_ready boolean not null default false,
  invitee_ready boolean not null default false,
  step smallint not null default 0,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null,
  end_reason text,
  keepsake text,
  note text check (char_length(note) <= 300)
);

-- only one invitation or date can be open at a time
create unique index if not exists date_sessions_one_open on public.date_sessions ((true))
  where status in ('pending', 'accepted', 'preparing', 'active', 'interrupted');

alter table public.date_sessions enable row level security;

-- Members can read their dates and write a note on a finished one. Everything else
-- happens only through the functions below (no insert / delete / other update rights).
revoke all on public.date_sessions from anon, authenticated;
grant select on public.date_sessions to authenticated;
grant update (note) on public.date_sessions to authenticated;

drop policy if exists "members see their dates" on public.date_sessions;
create policy "members see their dates"
  on public.date_sessions for select
  to authenticated
  using (public.is_couple_member());

drop policy if exists "members write a note on a finished date" on public.date_sessions;
create policy "members write a note on a finished date"
  on public.date_sessions for update
  to authenticated
  using (public.is_couple_member() and status = 'completed')
  with check (public.is_couple_member() and status = 'completed');

-- ── 3. Keepsakes (one of each, ever) ────────────────────────────────────────
create table if not exists public.keepsakes (
  kind text primary key check (kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard')),
  session_id uuid references public.date_sessions (id) on delete set null,
  unlocked_at timestamptz not null default now()
);

alter table public.keepsakes enable row level security;
revoke all on public.keepsakes from anon, authenticated;
grant select on public.keepsakes to authenticated;

drop policy if exists "members see the keepsakes" on public.keepsakes;
create policy "members see the keepsakes"
  on public.keepsakes for select
  to authenticated
  using (public.is_couple_member());

-- Keepsakes can be placed in the house once they're unlocked.
alter table public.house_items drop constraint if exists house_items_kind;
alter table public.house_items add constraint house_items_kind check (
  (area = 'inside' and kind in ('bed', 'sofa', 'table', 'chair', 'rug', 'floor_lamp', 'plant', 'bookshelf', 'picture', 'heart_lamp', 'teddy', 'vase',
                                'picnic_basket', 'candles', 'camp_lantern', 'postcard'))
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
    if new.kind in ('picnic_basket', 'candles', 'camp_lantern', 'postcard')
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

-- ── 4. The date functions ───────────────────────────────────────────────────

-- the other member (not the caller)
create or replace function public.date_partner()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.couple_members where user_id <> auth.uid() limit 1;
$$;
revoke all on function public.date_partner() from public;

-- Old invitations and dates that were never started run out quietly.
create or replace function public.date_tidy()
returns void
language sql
security definer
set search_path = public
as $$
  update public.date_sessions
     set status = 'cancelled', end_reason = 'expired', ended_at = now(), initiator_ready = false, invitee_ready = false
   where (status in ('pending', 'accepted', 'preparing') and expires_at < now())
      or (status = 'interrupted' and ended_at < now() - interval '1 day');
$$;
revoke all on function public.date_tidy() from public;

-- the dinner needs a table and two chairs in the house
create or replace function public.date_dining_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select stage from public.house where id = 1) >= 2
     and (select count(*) from public.house_items where kind = 'table') >= 1
     and (select count(*) from public.house_items where kind = 'chair') >= 2;
$$;
revoke all on function public.date_dining_ready() from public;

create or replace function public.date_check_member()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
end;
$$;
revoke all on function public.date_check_member() from public;

/** Invite the other person. `p_id` is made by the browser: sending it twice never makes two. */
create or replace function public.date_invite(p_id uuid, p_kind text)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
  mate uuid;
begin
  perform public.date_check_member();
  select * into d from public.date_sessions where id = p_id;
  if found then
    if d.initiator <> auth.uid() then raise exception 'not yours'; end if;
    return d;
  end if;
  perform public.date_tidy();
  if exists (select 1 from public.date_sessions where status in ('pending', 'accepted', 'preparing', 'active', 'interrupted')) then
    raise exception 'busy: a date is already open';
  end if;
  mate := public.date_partner();
  if mate is null then raise exception 'the other person has not joined yet'; end if;
  if p_kind = 'dinner_home' and not public.date_dining_ready() then
    raise exception 'need: a table and two chairs';
  end if;
  insert into public.date_sessions (id, kind, initiator, invitee, status, expires_at)
  values (p_id, p_kind, auth.uid(), mate, 'pending', now() + interval '15 minutes')
  returning * into d;
  return d;
end;
$$;

/** Accept or decline — only the invited person can. */
create or replace function public.date_respond(p_id uuid, p_accept boolean)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
begin
  perform public.date_check_member();
  perform public.date_tidy();
  select * into d from public.date_sessions where id = p_id for update;
  if not found then raise exception 'no such date'; end if;
  if d.invitee <> auth.uid() then raise exception 'only the invited person can answer'; end if;
  if d.status <> 'pending' then return d; end if;
  if p_accept then
    update public.date_sessions set status = 'accepted', responded_at = now(), expires_at = now() + interval '3 hours'
     where id = p_id returning * into d;
  else
    update public.date_sessions set status = 'cancelled', end_reason = 'declined', responded_at = now(), ended_at = now()
     where id = p_id returning * into d;
  end if;
  return d;
end;
$$;

/** "Siap" (or not ready any more) — for yourself only. When both are ready, the date begins. */
create or replace function public.date_ready(p_id uuid, p_ready boolean)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
begin
  perform public.date_check_member();
  perform public.date_tidy();
  select * into d from public.date_sessions where id = p_id for update;
  if not found then raise exception 'no such date'; end if;
  if d.status not in ('accepted', 'preparing') then return d; end if;
  if auth.uid() = d.initiator then
    d.initiator_ready := p_ready;
  elsif auth.uid() = d.invitee then
    d.invitee_ready := p_ready;
  else
    raise exception 'not part of this date';
  end if;
  if d.initiator_ready and d.invitee_ready then
    if d.kind = 'dinner_home' and not public.date_dining_ready() then
      raise exception 'need: a table and two chairs';
    end if;
    update public.date_sessions
       set initiator_ready = true, invitee_ready = true, status = 'active', started_at = now(), step = 0
     where id = p_id returning * into d;
  else
    update public.date_sessions
       set initiator_ready = d.initiator_ready, invitee_ready = d.invitee_ready,
           status = case when d.initiator_ready or d.invitee_ready then 'preparing' else 'accepted' end
     where id = p_id returning * into d;
  end if;
  return d;
end;
$$;

/** Next conversation prompt (only if nobody else just moved it on). */
create or replace function public.date_step(p_id uuid, p_expected smallint)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
begin
  perform public.date_check_member();
  update public.date_sessions set step = step + 1
   where id = p_id and status = 'active' and step = p_expected and step < 50
   returning * into d;
  if not found then select * into d from public.date_sessions where id = p_id; end if;
  return d;
end;
$$;

/**
 * "Akhiri Kencan" (or "Batalkan" before it starts). A date that really happened (at least a minute
 * together) is kept as a memory and unlocks its keepsake once; anything shorter just ends.
 */
create or replace function public.date_finish(p_id uuid)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
  gift text;
begin
  perform public.date_check_member();
  select * into d from public.date_sessions where id = p_id for update;
  if not found then raise exception 'no such date'; end if;
  if d.status = 'active' and d.started_at <= now() - interval '60 seconds' then
    gift := case d.kind when 'sunset_picnic' then 'picnic_basket' when 'dinner_home' then 'candles'
                        when 'camping' then 'camp_lantern' else 'postcard' end;
    insert into public.keepsakes (kind, session_id) values (gift, d.id) on conflict (kind) do nothing;
    update public.date_sessions
       set status = 'completed', completed_at = now(), ended_at = now(), keepsake = gift
     where id = p_id returning * into d;
  elsif d.status in ('pending', 'accepted', 'preparing', 'active', 'interrupted') then
    update public.date_sessions
       set status = 'cancelled', ended_at = now(), initiator_ready = false, invitee_ready = false,
           end_reason = case when d.status = 'active' then 'ended_early' else 'cancelled' end
     where id = p_id returning * into d;
  end if;
  return d;
end;
$$;

/** One of you went offline in the middle: the date pauses (never counts as finished). */
create or replace function public.date_interrupt(p_id uuid)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
begin
  perform public.date_check_member();
  update public.date_sessions
     set status = 'interrupted', end_reason = 'disconnected', ended_at = now(), initiator_ready = false, invitee_ready = false
   where id = p_id and status in ('accepted', 'preparing', 'active')
   returning * into d;
  if not found then select * into d from public.date_sessions where id = p_id; end if;
  return d;
end;
$$;

/** Pick an interrupted date back up: you both get ready again, from the start. */
create or replace function public.date_resume(p_id uuid)
returns public.date_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.date_sessions;
begin
  perform public.date_check_member();
  update public.date_sessions
     set status = 'accepted', end_reason = null, ended_at = null, started_at = null, step = 0,
         initiator_ready = false, invitee_ready = false, expires_at = now() + interval '3 hours'
   where id = p_id and status = 'interrupted'
   returning * into d;
  if not found then select * into d from public.date_sessions where id = p_id; end if;
  return d;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['date_invite(uuid, text)', 'date_respond(uuid, boolean)', 'date_ready(uuid, boolean)',
                           'date_step(uuid, smallint)', 'date_finish(uuid)', 'date_interrupt(uuid)', 'date_resume(uuid)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── 5. Live updates (on the same private channel as the house) ──────────────
do $$
begin
  alter publication supabase_realtime add table public.date_sessions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.keepsakes;
exception when duplicate_object then null;
end $$;
