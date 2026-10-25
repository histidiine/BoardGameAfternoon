-- Board Game Afternoons: initial schema (v1)
-- Tables follow the spec's data model: members, games, copies, favorites,
-- encounters (one board game afternoon), votes. Plus encounter_games_played and settings.
-- The voting rules live in the database so no client can bypass them.

------------------------------------------------------------
-- Types
------------------------------------------------------------
create type public.game_type as enum ('party', 'family', 'expert', 'small', 'coop', 'two');
create type public.complexity_level as enum ('light', 'medium', 'heavy');
create type public.member_role as enum ('member', 'admin');
create type public.encounter_status as enum ('open', 'closed');

------------------------------------------------------------
-- Tables
------------------------------------------------------------

-- A member is a person in the group. Owners imported from the Excel file
-- exist before they have an account (user_id is null); when that person
-- signs up with the same display name, their account claims the row.
create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  role public.member_role not null default 'member',
  theme text not null default 'a' check (theme in ('a', 'b', 'c')),
  color public.game_type not null default 'family', -- avatar color, reuses the type palette
  created_at timestamptz not null default now()
);
create unique index members_display_name_key on public.members (lower(btrim(display_name)));

-- One row per title.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  min_players int not null check (min_players between 1 and 99),
  max_players int not null check (max_players between 1 and 99),
  duration_min int not null check (duration_min between 1 and 1440),
  types public.game_type[] not null check (cardinality(types) >= 1),
  complexity public.complexity_level,
  min_age int check (min_age between 0 and 99),
  description text check (char_length(description) <= 600),
  bgg_id int unique check (bgg_id > 0),
  rules_video_url text check (rules_video_url is null or rules_video_url ~* '^https?://'),
  created_at timestamptz not null default now(),
  check (max_players >= min_players)
);
create unique index games_name_key on public.games (lower(btrim(name)));

-- Who owns which game. Removing a copy sets active = false, so past
-- vote pages keep the game's name and picture.
create table public.copies (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  owner_id uuid not null references public.members (id) on delete cascade,
  language text check (language in ('LI', 'FR', 'EN', 'DE', 'IT')),
  notes text check (char_length(notes) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (game_id, owner_id)
);
create index copies_owner_idx on public.copies (owner_id);

-- A heart: personal and permanent.
create table public.favorites (
  member_id uuid not null references public.members (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, game_id)
);
create index favorites_game_idx on public.favorites (game_id);

-- One board game afternoon.
create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  place text not null check (char_length(btrim(place)) between 1 and 120),
  host_id uuid references public.members (id) on delete set null,
  voting_deadline timestamptz not null,
  status public.encounter_status not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (voting_deadline <= starts_at)
);
-- Only one encounter is open for voting at a time.
create unique index encounters_one_open on public.encounters ((true)) where status = 'open';
create index encounters_starts_idx on public.encounters (starts_at desc);

create table public.encounter_games_played (
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  primary key (encounter_id, game_id)
);

-- A star: at most one per member, game and encounter.
create table public.votes (
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (encounter_id, game_id, member_id)
);
create index votes_member_idx on public.votes (member_id, encounter_id);

-- Group-wide settings, a single row.
create table public.settings (
  id boolean primary key default true check (id),
  vote_budget int not null default 5 check (vote_budget between 1 and 50),
  anonymous_votes boolean not null default false
);
insert into public.settings default values;

------------------------------------------------------------
-- Helpers
------------------------------------------------------------
create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.members where user_id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin') $$;

create or replace function public.encounter_accepts_votes(p_encounter uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.encounters
    where id = p_encounter and status = 'open' and voting_deadline > now()
  )
$$;

create or replace function public.slugify(p text)
returns text language sql immutable set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(lower(translate(p,
    'àáâäãåæçèéêëìíîïñòóôöõøœùúûüýÿÀÁÂÄÃÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÖÕØŒÙÚÛÜÝ',
    'aaaaaaaceeeeiiiinoooooouuuuyyAAAAAAACEEEEIIIINOOOOOOOUUUUY')),
    '[^a-z0-9]+', '-', 'g'), '-'), ''), 'game')
$$;

------------------------------------------------------------
-- Voting rules
------------------------------------------------------------
create or replace function public.check_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_budget int;
  v_used int;
begin
  -- Rows removed by a cascade (a member or game deleted by an admin) skip the rules.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if not public.encounter_accepts_votes(old.encounter_id) then
      raise exception 'Voting for this afternoon is closed.';
    end if;
    return old;
  end if;

  if not public.encounter_accepts_votes(new.encounter_id) then
    raise exception 'Voting for this afternoon is closed.';
  end if;
  if not exists (select 1 from public.copies where game_id = new.game_id and active) then
    raise exception 'This game is no longer on the shelf.';
  end if;

  -- Serialize a member's votes for one encounter so two quick taps cannot exceed the budget.
  perform pg_advisory_xact_lock(hashtextextended(new.member_id::text || new.encounter_id::text, 0));
  select vote_budget into v_budget from public.settings;
  select count(*) into v_used from public.votes
    where member_id = new.member_id and encounter_id = new.encounter_id;
  if v_used >= v_budget then
    raise exception 'You have used your % stars for this afternoon. Remove one to star another game.', v_budget;
  end if;
  return new;
end
$$;

create trigger votes_check
  before insert or delete on public.votes
  for each row execute function public.check_vote();

-- Voting closes automatically at the deadline. Pages call this before reading
-- encounters, so the archive is right even without a scheduled job.
create or replace function public.close_expired_encounters()
returns void language sql volatile security definer set search_path = ''
as $$
  update public.encounters
     set status = 'closed', closed_at = voting_deadline
   where status = 'open' and voting_deadline <= now()
$$;

-- Vote counts per game. Voter ids are hidden when votes are anonymous
-- (admins and each member's own votes stay visible).
create or replace function public.get_vote_tally(p_encounter uuid)
returns table (game_id uuid, votes int, voter_ids uuid[])
language sql stable security definer set search_path = ''
as $$
  select v.game_id,
         count(*)::int,
         case when not (select anonymous_votes from public.settings) or public.is_admin()
              then array_agg(v.member_id order by v.created_at)
              else array_remove(array_agg(case when v.member_id = public.my_member_id() then v.member_id end), null)
         end
    from public.votes v
   where v.encounter_id = p_encounter
   group by v.game_id
$$;

------------------------------------------------------------
-- Accounts
------------------------------------------------------------
-- When someone signs up, link them to the member with the same display name
-- (an owner imported from the Excel file) or create a new member.
-- The first person with an account becomes admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 40);
  v_id uuid;
  v_first boolean;
begin
  if v_name is null then
    v_name := left(split_part(new.email, '@', 1), 40);
  end if;
  select not exists (select 1 from public.members where role = 'admin' and user_id is not null)
    into v_first;

  update public.members set user_id = new.id
   where lower(btrim(display_name)) = lower(v_name) and user_id is null
   returning id into v_id;

  if v_id is null then
    if exists (select 1 from public.members where lower(btrim(display_name)) = lower(v_name)) then
      v_name := left(v_name, 35) || ' ' || substr(replace(new.id::text, '-', ''), 1, 4);
    end if;
    insert into public.members (user_id, display_name, color)
    values (new.id, v_name,
            (array['party','family','expert','small','coop','two'])[1 + floor(random() * 6)::int]::public.game_type)
    returning id into v_id;
  end if;

  if v_first then
    update public.members set role = 'admin' where id = v_id;
  end if;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by the login server action (service role only), never exposed to browsers.
create or replace function public.email_is_registered(p_email text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from auth.users where lower(email) = lower(btrim(p_email))) $$;

create or replace function public.display_name_status(p_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when m.id is null then 'free'
    when m.user_id is null then 'unclaimed'
    else 'taken' end
  from (select 1) x
  left join public.members m on lower(btrim(m.display_name)) = lower(btrim(p_name))
$$;

------------------------------------------------------------
-- Admin functions
------------------------------------------------------------
create or replace function public.admin_list_members()
returns table (id uuid, display_name text, role public.member_role, color public.game_type,
               email text, has_account boolean, copies int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the member list.';
  end if;
  return query
    select m.id, m.display_name, m.role, m.color, u.email::text, m.user_id is not null,
           (select count(*)::int from public.copies c where c.owner_id = m.id and c.active)
      from public.members m
      left join auth.users u on u.id = m.user_id
     order by lower(m.display_name);
end
$$;

create or replace function public.admin_set_role(p_member uuid, p_role public.member_role)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles.';
  end if;
  if p_role = 'member' and (select count(*) from public.members where role = 'admin' and id <> p_member) = 0 then
    raise exception 'The group needs at least one admin.';
  end if;
  update public.members set role = p_role where id = p_member;
end
$$;

-- Import rows from the Excel template in one transaction.
-- Each row: {name, owner, min, max, duration, types[], complexity, min_age,
--            language, image_url, bgg_id, description, notes}
-- Rows are merged into games by BGG ID, then by name. Never touches favorites or votes.
create or replace function public.import_games(p_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  r jsonb;
  v_member uuid;
  v_game uuid;
  v_slug text;
  v_n int;
  v_bgg int;
  v_inserted boolean;
  v_name text;
  new_games text[] := '{}';
  updated_games text[] := '{}';
  new_members text[] := '{}';
  new_copies int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can import games.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of rows.';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    -- owner
    select id into v_member from public.members
     where lower(btrim(display_name)) = lower(btrim(r ->> 'owner'));
    if v_member is null then
      insert into public.members (display_name, color)
      values (btrim(r ->> 'owner'),
              (array['party','family','expert','small','coop','two'])[1 + floor(random() * 6)::int]::public.game_type)
      returning id into v_member;
      new_members := new_members || btrim(r ->> 'owner');
    end if;

    -- game: by BGG ID, then by name
    v_bgg := nullif(r ->> 'bgg_id', '')::int;
    v_game := null;
    if v_bgg is not null then
      select id into v_game from public.games where bgg_id = v_bgg;
    end if;
    if v_game is null then
      select id into v_game from public.games where lower(btrim(name)) = lower(btrim(r ->> 'name'));
    end if;

    if v_game is null then
      v_slug := public.slugify(r ->> 'name');
      v_n := 2;
      while exists (select 1 from public.games where slug = v_slug) loop
        v_slug := public.slugify(r ->> 'name') || '-' || v_n;
        v_n := v_n + 1;
      end loop;
      insert into public.games (slug, name, image_url, min_players, max_players, duration_min, types,
                                complexity, min_age, description, bgg_id)
      values (v_slug, btrim(r ->> 'name'), nullif(r ->> 'image_url', ''),
              (r ->> 'min')::int, (r ->> 'max')::int, (r ->> 'duration')::int,
              array(select jsonb_array_elements_text(r -> 'types'))::public.game_type[],
              nullif(r ->> 'complexity', '')::public.complexity_level,
              nullif(r ->> 'min_age', '')::int, nullif(r ->> 'description', ''), v_bgg)
      returning id into v_game;
      new_games := new_games || btrim(r ->> 'name');
    else
      update public.games set
        min_players = (r ->> 'min')::int,
        max_players = (r ->> 'max')::int,
        duration_min = (r ->> 'duration')::int,
        types = array(select jsonb_array_elements_text(r -> 'types'))::public.game_type[],
        complexity = coalesce(nullif(r ->> 'complexity', '')::public.complexity_level, complexity),
        min_age = coalesce(nullif(r ->> 'min_age', '')::int, min_age),
        image_url = coalesce(nullif(r ->> 'image_url', ''), image_url),
        description = coalesce(nullif(r ->> 'description', ''), description),
        bgg_id = coalesce(v_bgg, bgg_id)
      where id = v_game
      returning name into v_name;
      if not (v_name = any (new_games)) and not (v_name = any (updated_games)) then
        updated_games := updated_games || v_name;
      end if;
    end if;

    -- copy
    insert into public.copies (game_id, owner_id, language, notes, active)
    values (v_game, v_member, nullif(r ->> 'language', ''), nullif(r ->> 'notes', ''), true)
    on conflict (game_id, owner_id) do update set
      active = true,
      language = coalesce(excluded.language, public.copies.language),
      notes = coalesce(excluded.notes, public.copies.notes)
    returning (xmax = 0) into v_inserted;
    if v_inserted then
      new_copies := new_copies + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'new_games', to_jsonb(new_games),
    'updated_games', to_jsonb(updated_games),
    'new_members', to_jsonb(new_members),
    'new_copies', new_copies);
end
$$;

------------------------------------------------------------
-- Row level security
-- Anyone with the link can browse; hearts and stars need an account;
-- admins manage games, encounters and members.
------------------------------------------------------------
alter table public.members enable row level security;
alter table public.games enable row level security;
alter table public.copies enable row level security;
alter table public.favorites enable row level security;
alter table public.encounters enable row level security;
alter table public.encounter_games_played enable row level security;
alter table public.votes enable row level security;
alter table public.settings enable row level security;

-- members: everyone sees names; you edit your own name, theme and color; admins rename anyone
create policy "members are visible" on public.members for select using (true);
create policy "members edit themselves" on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "admins edit members" on public.members for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, update, delete on public.members from anon, authenticated;
grant update (display_name, theme, color) on public.members to authenticated;

-- games and copies: public catalogue, admin-managed in v1
create policy "games are visible" on public.games for select using (true);
create policy "admins manage games" on public.games for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "copies are visible" on public.copies for select using (true);
create policy "admins manage copies" on public.copies for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- favorites: personal
create policy "see own favorites" on public.favorites for select to authenticated
  using (member_id = (select public.my_member_id()));
create policy "add own favorites" on public.favorites for insert to authenticated
  with check (member_id = (select public.my_member_id()));
create policy "remove own favorites" on public.favorites for delete to authenticated
  using (member_id = (select public.my_member_id()));

-- encounters and played games: public, admin-managed
create policy "encounters are visible" on public.encounters for select using (true);
create policy "admins manage encounters" on public.encounters for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "played games are visible" on public.encounter_games_played for select using (true);
create policy "admins manage played games" on public.encounter_games_played for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- votes: names visible unless the group switches to anonymous counts
create policy "votes are visible" on public.votes for select
  using (
    not (select anonymous_votes from public.settings)
    or member_id = (select public.my_member_id())
    or (select public.is_admin())
  );
create policy "cast own votes" on public.votes for insert to authenticated
  with check (member_id = (select public.my_member_id()));
create policy "remove own votes" on public.votes for delete to authenticated
  using (member_id = (select public.my_member_id()));
revoke update on public.votes from anon, authenticated;

-- settings
create policy "settings are visible" on public.settings for select using (true);
create policy "admins change settings" on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, delete on public.settings from anon, authenticated;

------------------------------------------------------------
-- Function permissions
------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_member_id() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.encounter_accepts_votes(uuid) to anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;
grant execute on function public.close_expired_encounters() to anon, authenticated;
grant execute on function public.get_vote_tally(uuid) to anon, authenticated;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.admin_set_role(uuid, public.member_role) to authenticated;
grant execute on function public.import_games(jsonb) to authenticated;
grant execute on function public.email_is_registered(text) to service_role;
grant execute on function public.display_name_status(text) to service_role;
