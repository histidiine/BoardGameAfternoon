-- Board Game Afternoons: tolerant owner names, merging members, removing a member's games.
--
-- Until now an owner name matched only when it was identical apart from capitals, so a
-- file with "Aurelie" after an earlier one with "Aurélie" created a second member and a
-- second copy of every game. From now on accents, capitals, spaces and punctuation are
-- ignored when matching names, and admins can merge two members or take one member's
-- games off the shelf.

------------------------------------------------------------
-- Name matching
------------------------------------------------------------
-- "Aurélie", "aurelie" and "Aurelie " all give "aurelie".
create or replace function public.name_key(p text)
returns text language sql immutable set search_path = ''
as $$
  select coalesce(
    nullif(regexp_replace(lower(translate(coalesce(p, ''),
      'àáâäãåæçèéêëìíîïñòóôöõøœùúûüýÿÀÁÂÄÃÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÖÕØŒÙÚÛÜÝŸ',
      'aaaaaaaceeeeiiiinooooooouuuuyyAAAAAAACEEEEIIIINOOOOOOOUUUUYY')), '[^a-z0-9]+', '', 'g'), ''),
    lower(btrim(coalesce(p, ''))))
$$;

-- Same accent table in slugify: the first version was one letter short, which shifted
-- some capitals (an initial "Ç" became "e"). Existing slugs do not change.
create or replace function public.slugify(p text)
returns text language sql immutable set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(lower(translate(p,
    'àáâäãåæçèéêëìíîïñòóôöõøœùúûüýÿÀÁÂÄÃÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÖÕØŒÙÚÛÜÝŸ',
    'aaaaaaaceeeeiiiinooooooouuuuyyAAAAAAACEEEEIIIINOOOOOOOUUUUYY')),
    '[^a-z0-9]+', '-', 'g'), '-'), ''), 'game')
$$;

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
    -- Accents, capitals, spaces and punctuation are ignored: "Aurelie" finds "Aurélie".
    -- If two members already share a name, the one with an account (then the oldest) wins.
    select id into v_member from public.members
     where public.name_key(display_name) = public.name_key(r ->> 'owner')
     order by (user_id is null), created_at
     limit 1;
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
   where id = (select id from public.members
                where public.name_key(display_name) = public.name_key(v_name) and user_id is null
                order by created_at limit 1)
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

-- Sign-up check used by the login page: a name is taken when a member with an account
-- has the same name, ignoring accents, capitals, spaces and punctuation.
create or replace function public.display_name_status(p_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when not exists (select 1 from public.members
                      where public.name_key(display_name) = public.name_key(p_name)) then 'free'
    when exists (select 1 from public.members
                  where public.name_key(display_name) = public.name_key(p_name) and user_id is null) then 'unclaimed'
    else 'taken' end
$$;

------------------------------------------------------------
-- Admin: merge two members
------------------------------------------------------------
-- For one person entered twice. Games, hearts, stars and hosted afternoons move from
-- p_from to p_into, games or hearts both had become one, then p_from is deleted.
-- An account on p_from moves to p_into. Two accounts cannot be merged.
create or replace function public.admin_merge_members(p_from uuid, p_into uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_from public.members;
  v_into public.members;
  v_games int;
  v_favs int;
  v_stars int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can merge members.';
  end if;
  if p_from = p_into then
    raise exception 'Pick two different members.';
  end if;
  select * into v_from from public.members where id = p_from for update;
  select * into v_into from public.members where id = p_into for update;
  if v_from.id is null or v_into.id is null then
    raise exception 'One of these members no longer exists. Reload the page.';
  end if;
  if v_from.user_id is not null and v_into.user_id is not null then
    raise exception '% and % both have an account, so they cannot be merged. Delete the extra account in Supabase first.',
      v_from.display_name, v_into.display_name;
  end if;

  select count(*) into v_games from public.copies where owner_id = p_from and active;
  select count(*) into v_favs from public.favorites where member_id = p_from;
  select count(*) into v_stars from public.votes where member_id = p_from;

  -- Games both own: keep the kept member's copy, active if either was, with any language or notes.
  update public.copies k
     set active = k.active or r.active,
         language = coalesce(k.language, r.language),
         notes = coalesce(k.notes, r.notes)
    from public.copies r
   where r.owner_id = p_from and k.owner_id = p_into and k.game_id = r.game_id;
  update public.copies set owner_id = p_into
   where owner_id = p_from
     and game_id not in (select game_id from public.copies where owner_id = p_into);

  update public.favorites set member_id = p_into
   where member_id = p_from
     and game_id not in (select game_id from public.favorites where member_id = p_into);

  -- Moving a star is an update, not a new star, so it works for closed afternoons too.
  update public.votes v set member_id = p_into
   where v.member_id = p_from
     and not exists (select 1 from public.votes w
                      where w.member_id = p_into and w.encounter_id = v.encounter_id and w.game_id = v.game_id);

  update public.encounters set host_id = p_into where host_id = p_from;
  if v_from.role = 'admin' then
    update public.members set role = 'admin' where id = p_into;
  end if;

  -- Leftover duplicates go with the removed member (cascade).
  delete from public.members where id = p_from;
  if v_from.user_id is not null then
    update public.members set user_id = v_from.user_id where id = p_into;
  end if;

  return jsonb_build_object('removed', v_from.display_name, 'kept', v_into.display_name,
                            'games', v_games, 'favorites', v_favs, 'stars', v_stars);
end
$$;

------------------------------------------------------------
-- Admin: take a member's games off the shelf
------------------------------------------------------------
-- For a wrong import. Copies are hidden (active = false), not deleted, so past vote
-- pages keep their games. Importing the file again brings them back.
create or replace function public.admin_remove_member_copies(p_member uuid)
returns int language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove games.';
  end if;
  update public.copies set active = false where owner_id = p_member and active;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

------------------------------------------------------------
-- Function permissions
------------------------------------------------------------
revoke execute on function public.name_key(text) from public;
revoke execute on function public.admin_merge_members(uuid, uuid) from public, anon;
revoke execute on function public.admin_remove_member_copies(uuid) from public, anon;
grant execute on function public.name_key(text) to anon, authenticated;
grant execute on function public.admin_merge_members(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_member_copies(uuid) to authenticated;
