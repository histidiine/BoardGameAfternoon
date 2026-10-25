-- Sample data for trying the site locally (supabase db reset loads it).
-- Do NOT run this on the group's real project: load your own Excel file from the admin area instead.

insert into public.members (display_name, color) values
  ('Aurélie', 'party'), ('Marc', 'family'), ('Léa', 'expert'), ('Tom', 'small'),
  ('Sofia', 'coop'), ('Nico', 'two'), ('Jonas', 'party'), ('Inès', 'family');

insert into public.games (slug, name, min_players, max_players, duration_min, types, complexity, min_age, bgg_id, description, created_at) values
  ('azul', 'Azul', 2, 4, 45, '{family}', 'light', 8, 230802, 'Draft colorful tiles from shared factories and lay them on your palace wall. Quick to teach, sneaky to master.', '2026-08-10'),
  ('wingspan', 'Wingspan', 1, 5, 70, '{family}', 'medium', 10, 266192, 'Attract birds to your wildlife reserve and chain their powers across forest, grassland and wetland.', '2026-08-10'),
  ('codenames', 'Codenames', 2, 8, 15, '{party}', 'light', 14, 178900, 'Two teams, one-word clues, twenty-five secret agents. Find your team''s words without touching the assassin.', '2026-08-10'),
  ('ticket-to-ride-europe', 'Ticket to Ride: Europe', 2, 5, 60, '{family}', 'light', 8, 14996, 'Collect train cards and claim railway routes across Europe to complete your secret destination tickets.', '2026-08-12'),
  ('catan', 'Catan', 3, 4, 90, '{family}', 'medium', 10, 13, 'Gather wood, brick, wool, grain and ore, trade with everyone, and build roads and towns across the island.', '2026-08-12'),
  ('7-wonders-duel', '7 Wonders Duel', 2, 2, 30, '{two}', 'medium', 10, 173346, 'A head-to-head take on 7 Wonders: draft cards from a shared pyramid and win by science, army or points.', '2026-08-15'),
  ('pandemic', 'Pandemic', 2, 4, 45, '{coop}', 'medium', 8, 30549, 'A team of specialists races to stop four diseases from spreading around the world before time runs out.', '2026-08-15'),
  ('dixit', 'Dixit', 3, 8, 30, '{party,family}', 'light', 8, 39856, 'Give a poetic clue for one of your dreamlike cards. Not too obvious, not too obscure.', '2026-08-20'),
  ('splendor', 'Splendor', 2, 4, 30, '{family,small}', 'light', 10, 148228, 'Collect gems, buy mines and caravans, and attract nobles. A tight, fast engine-building game.', '2026-08-20'),
  ('terraforming-mars', 'Terraforming Mars', 1, 5, 150, '{expert}', 'heavy', 12, 167791, 'Lead a corporation turning Mars green: raise temperature, oxygen and oceans with a huge deck of projects.', '2026-09-02'),
  ('the-crew-mission-deep-sea', 'The Crew: Mission Deep Sea', 2, 5, 20, '{coop,small}', 'light', 10, 324856, 'A cooperative trick-taking game where you complete missions together while barely saying a word.', '2026-09-02'),
  ('just-one', 'Just One', 3, 7, 20, '{party,coop}', 'light', 8, 254640, 'Everyone writes a one-word clue for the guesser, but identical clues cancel out. Instant laughs.', '2026-09-25'),
  ('patchwork', 'Patchwork', 2, 2, 30, '{two,small}', 'light', 8, 163412, 'Two players race to sew the coziest quilt from oddly shaped patches, paying in buttons and time.', '2026-09-25'),
  ('cascadia', 'Cascadia', 1, 4, 40, '{family}', 'light', 10, 295947, 'Build a landscape of habitat tiles and place wildlife in the patterns each animal likes best.', '2026-08-10'),
  ('spirit-island', 'Spirit Island', 1, 4, 120, '{coop,expert}', 'heavy', 13, 162886, 'Play island spirits defending their land against invaders. Deep, cooperative and very satisfying.', '2026-09-02'),
  ('skull', 'Skull', 3, 6, 30, '{party,small}', 'light', 10, 92415, 'A bluffing game with beautiful coasters: place flowers and skulls, then bet on how many you can flip.', '2026-08-10'),
  ('brass-birmingham', 'Brass: Birmingham', 2, 4, 120, '{expert}', 'heavy', 14, 224517, 'Build canals, railways and industries across the Midlands during the industrial revolution.', '2026-10-01'),
  ('kingdomino', 'Kingdomino', 2, 4, 15, '{family,small}', 'light', 8, 204583, 'Pick domino tiles and connect matching terrain to build a five by five kingdom in fifteen minutes.', '2026-10-01'),
  ('the-resistance-avalon', 'The Resistance: Avalon', 5, 10, 30, '{party}', 'light', 13, 128882, 'Loyal knights against hidden traitors. Vote on quest teams and work out who is lying.', '2026-10-18'),
  ('love-letter', 'Love Letter', 2, 6, 20, '{party,small}', 'light', 10, 277085, 'Sixteen cards, one princess to reach. Deduce, bluff and knock the others out of the round.', '2026-10-18');

insert into public.copies (game_id, owner_id, language, notes)
select g.id, m.id, c.lang, nullif(c.notes, '')
from (values
  ('azul','Aurélie','LI',''), ('azul','Marc','LI','sleeved'), ('wingspan','Aurélie','FR',''),
  ('codenames','Léa','FR',''), ('codenames','Nico','EN',''), ('ticket-to-ride-europe','Tom','FR',''),
  ('catan','Marc','DE','missing 2 road pieces'), ('7-wonders-duel','Aurélie','FR',''), ('pandemic','Sofia','EN',''),
  ('dixit','Léa','LI','with the Odyssey expansion'), ('splendor','Nico','LI',''),
  ('terraforming-mars','Jonas','FR','sleeved, with organizer'), ('the-crew-mission-deep-sea','Inès','FR',''),
  ('just-one','Tom','FR',''), ('patchwork','Sofia','LI',''), ('cascadia','Aurélie','LI',''), ('cascadia','Jonas','LI',''),
  ('spirit-island','Marc','EN',''), ('skull','Nico','LI',''), ('brass-birmingham','Jonas','EN',''),
  ('kingdomino','Inès','LI',''), ('the-resistance-avalon','Léa','EN',''), ('love-letter','Tom','FR','')
) as c(slug, owner, lang, notes)
join public.games g on g.slug = c.slug
join public.members m on m.display_name = c.owner;

-- Three past afternoons and the next one, which opens 13 days from now.
insert into public.encounters (id, starts_at, place, host_id, voting_deadline, status, closed_at)
select x.id::uuid, x.starts::timestamptz, x.place, m.id, x.starts::timestamptz, x.status::public.encounter_status,
       case when x.status = 'closed' then x.starts::timestamptz end
from (values
  ('00000000-0000-4000-8000-000000000001', '2026-08-22 14:00+02', 'Sofia''s place', 'Sofia', 'closed'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-19 14:00+02', 'Aurélie''s place', 'Aurélie', 'closed'),
  ('00000000-0000-4000-8000-000000000003', '2026-10-10 14:00+02', 'Léa''s place', 'Léa', 'closed'),
  ('00000000-0000-4000-8000-000000000004', (date_trunc('day', now()) + interval '13 days 13 hours')::text, 'Marc''s place', 'Marc', 'open')
) as x(id, starts, place, host, status)
join public.members m on m.display_name = x.host;

-- Past votes are inserted directly, bypassing the voting rules that would refuse closed afternoons.
alter table public.votes disable trigger votes_check;
insert into public.votes (encounter_id, game_id, member_id)
select ('00000000-0000-4000-8000-00000000000' || v.e)::uuid, g.id, m.id
from (values
  ('1','cascadia','Aurélie'),('1','cascadia','Léa'),('1','cascadia','Sofia'),('1','cascadia','Nico'),
  ('1','skull','Marc'),('1','skull','Léa'),('1','skull','Tom'),('1','skull','Nico'),
  ('1','pandemic','Aurélie'),('1','pandemic','Sofia'),('1','wingspan','Aurélie'),('1','wingspan','Tom'),
  ('1','azul','Marc'),('1','codenames','Léa'),('1','codenames','Tom'),
  ('2','terraforming-mars','Marc'),('2','terraforming-mars','Jonas'),('2','terraforming-mars','Aurélie'),
  ('2','dixit','Léa'),('2','dixit','Sofia'),('2','dixit','Inès'),('2','azul','Aurélie'),('2','azul','Inès'),('2','azul','Sofia'),
  ('2','the-crew-mission-deep-sea','Inès'),('2','the-crew-mission-deep-sea','Léa'),('2','spirit-island','Marc'),('2','spirit-island','Jonas'),
  ('3','wingspan','Aurélie'),('3','wingspan','Léa'),('3','wingspan','Tom'),('3','wingspan','Nico'),('3','wingspan','Inès'),
  ('3','just-one','Léa'),('3','just-one','Tom'),('3','just-one','Nico'),('3','brass-birmingham','Marc'),('3','brass-birmingham','Jonas'),
  ('3','kingdomino','Inès'),('3','kingdomino','Aurélie'),('3','patchwork','Tom'),('3','7-wonders-duel','Aurélie'),
  ('4','spirit-island','Marc'),('4','spirit-island','Jonas'),('4','spirit-island','Sofia'),
  ('4','the-resistance-avalon','Léa'),('4','the-resistance-avalon','Nico'),('4','the-resistance-avalon','Tom'),
  ('4','cascadia','Sofia'),('4','cascadia','Inès'),('4','codenames','Léa'),('4','codenames','Tom'),
  ('4','catan','Marc'),('4','catan','Tom'),('4','terraforming-mars','Jonas'),('4','love-letter','Nico')
) as v(e, slug, who)
join public.games g on g.slug = v.slug
join public.members m on m.display_name = v.who;
alter table public.votes enable trigger votes_check;

insert into public.encounter_games_played (encounter_id, game_id)
select ('00000000-0000-4000-8000-00000000000' || p.e)::uuid, g.id
from (values ('1','cascadia'),('1','skull'),('1','codenames'),
             ('2','terraforming-mars'),('2','dixit'),('2','the-crew-mission-deep-sea'),
             ('3','wingspan'),('3','just-one'),('3','kingdomino')) as p(e, slug)
join public.games g on g.slug = p.slug;
