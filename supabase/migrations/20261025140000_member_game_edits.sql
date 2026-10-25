-- Board Game Afternoons: members edit their own games (25 Oct 2026)
--
-- 1. Each copy gets an availability flag. "Not available" means the owner cannot
--    bring it for now (lent out, at another place). The game stays on the shelf.
-- 2. A member can fix the name of a game they own (typos), mark their copy
--    available or not, and change their comment on it. Everything goes through
--    one function, so members never get write access to the games and copies tables.
-- Safe to run more than once.

alter table public.copies add column if not exists available boolean not null default true;

create or replace function public.member_update_copy(
  p_game uuid,
  p_name text,
  p_available boolean,
  p_notes text
)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_member_id();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_old text;
begin
  if v_me is null then
    raise exception 'Log in to change your games.';
  end if;
  if not exists (select 1 from public.copies where game_id = p_game and owner_id = v_me and active) then
    raise exception 'You can only change games on your own shelf.';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Use a game name between 1 and 120 characters.';
  end if;
  if char_length(coalesce(v_notes, '')) > 200 then
    raise exception 'Keep the comment under 200 characters.';
  end if;
  if exists (select 1 from public.games where lower(btrim(name)) = lower(v_name) and id <> p_game) then
    raise exception 'Another game on the shelf is already called %. Ask an admin if these are the same game.', v_name;
  end if;

  select name into v_old from public.games where id = p_game for update;
  -- The game's web address (slug) stays the same, so links shared earlier keep working.
  update public.games set name = v_name where id = p_game and name is distinct from v_name;
  update public.copies set available = coalesce(p_available, available), notes = v_notes
   where game_id = p_game and owner_id = v_me;

  return jsonb_build_object('old_name', v_old, 'name', v_name);
end
$$;

revoke execute on function public.member_update_copy(uuid, text, boolean, text) from public, anon;
grant execute on function public.member_update_copy(uuid, text, boolean, text) to authenticated;
