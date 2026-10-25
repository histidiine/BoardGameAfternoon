-- Board Game Afternoons: up to 2 stars per game (25 Oct 2026)
--
-- A member can give a game 1 or 2 stars to show how much they want to play it.
-- The budget (settings.vote_budget) now counts stars, not games: with 5 stars,
-- a member can give 2 + 2 + 1, or 1 to five games.
-- Existing votes count as 1 star. Safe to run more than once.

alter table public.votes add column if not exists stars smallint not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'votes_stars_check') then
    alter table public.votes add constraint votes_stars_check check (stars between 1 and 2);
  end if;
end
$$;

------------------------------------------------------------
-- Voting rules, now also when a member changes 1 star into 2 (or back)
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

  if tg_op = 'UPDATE' and (new.encounter_id <> old.encounter_id or new.game_id <> old.game_id or new.member_id <> old.member_id) then
    raise exception 'A star cannot be moved. Remove it and give a new one.';
  end if;
  if not public.encounter_accepts_votes(new.encounter_id) then
    raise exception 'Voting for this afternoon is closed.';
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.copies where game_id = new.game_id and active) then
    raise exception 'This game is no longer on the shelf.';
  end if;
  if tg_op = 'UPDATE' and new.stars <= old.stars then
    return new; -- giving fewer stars is always fine
  end if;

  -- Serialize a member's votes for one encounter so two quick taps cannot exceed the budget.
  perform pg_advisory_xact_lock(hashtextextended(new.member_id::text || new.encounter_id::text, 0));
  select vote_budget into v_budget from public.settings;
  select coalesce(sum(stars), 0) into v_used from public.votes
   where member_id = new.member_id and encounter_id = new.encounter_id and game_id <> new.game_id;
  if v_used + new.stars > v_budget then
    raise exception 'You have used your % stars for this afternoon. Remove one to star another game.', v_budget;
  end if;
  return new;
end
$$;

drop trigger if exists votes_check on public.votes;
-- "update of stars" only: the admin merge tool moves votes between members without these checks.
create trigger votes_check
  before insert or delete or update of stars on public.votes
  for each row execute function public.check_vote();

-- Members change the number of stars on their own votes, nothing else.
drop policy if exists "change own votes" on public.votes;
create policy "change own votes" on public.votes for update to authenticated
  using (member_id = (select public.my_member_id()))
  with check (member_id = (select public.my_member_id()));
grant update (stars) on public.votes to authenticated;

------------------------------------------------------------
-- Tally: total stars per game, and each voter's stars (same order as voter_ids)
------------------------------------------------------------
drop function if exists public.get_vote_tally(uuid);
create function public.get_vote_tally(p_encounter uuid)
returns table (game_id uuid, votes int, voter_ids uuid[], voter_stars int[])
language sql stable security definer set search_path = ''
as $$
  select v.game_id,
         sum(v.stars)::int,
         case when not (select anonymous_votes from public.settings) or public.is_admin()
              then array_agg(v.member_id order by v.created_at)
              else array_remove(array_agg(case when v.member_id = public.my_member_id() then v.member_id end order by v.created_at), null)
         end,
         case when not (select anonymous_votes from public.settings) or public.is_admin()
              then array_agg(v.stars::int order by v.created_at)
              else array_remove(array_agg(case when v.member_id = public.my_member_id() then v.stars::int end order by v.created_at), null)
         end
    from public.votes v
   where v.encounter_id = p_encounter
   group by v.game_id
$$;
revoke execute on function public.get_vote_tally(uuid) from public;
grant execute on function public.get_vote_tally(uuid) to anon, authenticated;
