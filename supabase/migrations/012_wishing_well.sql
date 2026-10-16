-- ─────────────────────────────────────────────────────────────────────────────
--  THE WELL OF WISHES — wishes and messages for the future, dropped into the wishing well.
--
--  Run this once in the Supabase SQL editor (after 001; any order after the others). Safe to run
--  again. Nothing existing is changed or removed: it only adds.
--
--    • wishes: who wrote it, its kind, whether it's waiting for the other person's "yes", the day
--      it may be opened again — but NOT what it says
--    • wish_texts: what it says. Nobody can read this table directly; only wish_read() below can,
--      and it checks who's asking and, with the server's own clock, whether the day has come
--    • kinds: 'pribadi' (a wish of your own: only you can see it), 'bersama' (a dream for both of
--      you: it's kept once the other person agrees), 'pasangan' (a message for the other person)
--    • every write goes through a function with an id made by the game, so pressing "confirm"
--      twice, or both at the same moment, never saves anything twice
--
--  Rollback:
--    drop function if exists public.wish_make(uuid, text, text, date), public.wish_answer(uuid, boolean),
--      public.wish_read(uuid), public.wish_withdraw(uuid), public.wish_today();
--    drop table if exists public.wish_texts; drop table if exists public.wishes;
--    drop policy if exists "couple members hear about wishes" on realtime.messages;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. the wishes (what's known about them) and their words (kept apart) ─────
create table if not exists public.wishes (
  id uuid primary key,
  author uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('pribadi', 'bersama', 'pasangan')),
  status text not null default 'tersimpan' check (status in ('tersimpan', 'menunggu', 'ditolak')),
  open_on date,
  created_at timestamptz not null default now(),
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  opened_at timestamptz
);
create index if not exists wishes_author on public.wishes (author);

create table if not exists public.wish_texts (
  wish_id uuid primary key references public.wishes (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500)
);

alter table public.wishes enable row level security;
alter table public.wish_texts enable row level security;
revoke all on public.wishes from anon, authenticated;
revoke all on public.wish_texts from anon, authenticated;
-- (the words: no rights at all; the functions below read and write them)
grant select on public.wishes to authenticated;

-- a wish of your own is yours alone; dreams together and messages are seen by both of you
drop policy if exists "members see the wishes they may" on public.wishes;
create policy "members see the wishes they may"
  on public.wishes for select
  to authenticated
  using (public.is_couple_member() and (author = auth.uid() or category <> 'pribadi'));

-- new wishes and answers arrive live (Realtime applies the policy above to each change)
do $$
begin
  alter publication supabase_realtime add table public.wishes;
exception when duplicate_object then null;
end $$;

-- each of you may listen on your own wishes topic ("couple-wishes:<your user id>")
drop policy if exists "couple members hear about wishes" on realtime.messages;
create policy "couple members hear about wishes"
  on realtime.messages for select
  to authenticated
  using (public.is_couple_member() and (select realtime.topic()) = 'couple-wishes:' || auth.uid()::text);

-- ── 2. the server's day (in the game's world time zone, WITA) ────────────────
create or replace function public.wish_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Makassar')::date
$$;
grant execute on function public.wish_today() to authenticated;

-- ── 3. making, answering, reading and taking back a wish ─────────────────────

/*
 * Drop a wish into the well. `wish_id` is made by the game, so a retry (or a double tap) returns
 * the same wish instead of a second one. A dream together waits for the other person's answer.
 */
create or replace function public.wish_make(wish_id uuid, category text, body text, open_on date)
returns public.wishes
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  w public.wishes;
  words text := btrim(coalesce(body, ''));
  inserted integer;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  if category not in ('pribadi', 'bersama', 'pasangan') then
    raise exception 'unknown kind of wish';
  end if;
  if char_length(words) < 1 or char_length(words) > 500 then
    raise exception 'a wish is 1 to 500 characters';
  end if;
  if open_on is not null and (open_on <= public.wish_today() or open_on > public.wish_today() + 3660) then
    raise exception 'the day to open it must be after today and within ten years';
  end if;
  -- already made (a retry): the same wish back
  select * into w from public.wishes where id = wish_id;
  if found then
    if w.author <> auth.uid() then
      raise exception 'not allowed';
    end if;
    return w;
  end if;
  if (select count(*) from public.wishes x where x.author = auth.uid()) >= 300 then
    raise exception 'the well is full of your wishes';
  end if;
  insert into public.wishes (id, author, category, status, open_on)
  values (wish_id, auth.uid(), category, case when category = 'bersama' then 'menunggu' else 'tersimpan' end, open_on)
  on conflict (id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    insert into public.wish_texts (wish_id, body) values (wish_id, words);
  end if;
  select * into w from public.wishes where id = wish_id;
  if w.author <> auth.uid() then
    raise exception 'not allowed';
  end if;
  return w;
end;
$$;

/* The other person's answer to a dream together ("yes" keeps it; "no" leaves it with its writer). */
create or replace function public.wish_answer(wish_id uuid, accept boolean)
returns public.wishes
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  w public.wishes;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into w from public.wishes where id = wish_id;
  if not found or w.category <> 'bersama' or w.author = auth.uid() then
    raise exception 'not allowed';
  end if;
  -- only the first answer counts (both tapping at once, or twice, changes nothing more)
  update public.wishes
     set status = case when accept then 'tersimpan' else 'ditolak' end,
         answered_by = auth.uid(),
         answered_at = now()
   where id = wish_id and status = 'menunggu'
  returning * into w;
  if not found then
    select * into w from public.wishes where id = wish_id;
  end if;
  return w;
end;
$$;

/*
 * Read a wish's words — if you may (yours, or one for both of you), and if its day has come by
 * the server's clock. Opening a dated wish for the first time marks it opened.
 */
create or replace function public.wish_read(wish_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  w public.wishes;
  words text;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into w from public.wishes where id = wish_id;
  if not found or (w.author <> auth.uid() and (w.category = 'pribadi' or w.status = 'ditolak')) then
    raise exception 'not allowed';
  end if;
  -- (a dream waiting for its answer can be read, so the other person knows what they agree to)
  if w.status = 'tersimpan' and w.open_on is not null and public.wish_today() < w.open_on then
    raise exception 'locked until %', w.open_on;
  end if;
  select t.body into words from public.wish_texts t where t.wish_id = w.id;
  if w.status = 'tersimpan' and w.open_on is not null and w.opened_at is null then
    update public.wishes set opened_at = now() where id = w.id;
  end if;
  return words;
end;
$$;

/* Take back a wish of your own (not a dream you both agreed on). */
create or replace function public.wish_withdraw(wish_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  w public.wishes;
begin
  if not public.is_couple_member() then
    raise exception 'not a member of this private room';
  end if;
  select * into w from public.wishes where id = wish_id;
  if not found then
    return true;
  end if;
  if w.author <> auth.uid() or (w.category = 'bersama' and w.status = 'tersimpan') then
    raise exception 'not allowed';
  end if;
  delete from public.wishes where id = wish_id;
  return true;
end;
$$;

revoke all on function public.wish_make(uuid, text, text, date) from public;
revoke all on function public.wish_answer(uuid, boolean) from public;
revoke all on function public.wish_read(uuid) from public;
revoke all on function public.wish_withdraw(uuid) from public;
grant execute on function public.wish_make(uuid, text, text, date) to authenticated;
grant execute on function public.wish_answer(uuid, boolean) to authenticated;
grant execute on function public.wish_read(uuid) to authenticated;
grant execute on function public.wish_withdraw(uuid) to authenticated;
