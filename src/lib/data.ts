import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Encounter, GameView, Member, MemberLite, TallyRow, VoteContext } from "@/lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */

// The logged-in member, if any. Cached for the duration of one request.
export const getViewer = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: member } = await supabase
    .from("members")
    .select("id, user_id, display_name, role, theme, color")
    .eq("user_id", userId)
    .maybeSingle();
  return (member as Member) ?? null;
});

export const getMembers = cache(async (): Promise<MemberLite[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("members").select("id, display_name, color").order("display_name");
  if (error) throw error;
  return data as MemberLite[];
});

const GAME_COLUMNS =
  "id, slug, name, image_url, min_players, max_players, duration_min, types, complexity, min_age, description, bgg_id, rules_video_url, created_at, copies(language, notes, active, available, owner:members(id, display_name, color))";

function toGameView(row: any): GameView {
  const copies = (row.copies ?? [])
    .filter((c: any) => c.active && c.owner)
    .map((c: any) => ({ owner: c.owner, language: c.language, notes: c.notes, available: c.available !== false }))
    .sort((a: any, b: any) => a.owner.display_name.localeCompare(b.owner.display_name));
  return { ...row, copies };
}

// Every game ever entered, including those whose last copy was removed (for past vote pages).
export const getAllGames = cache(async (): Promise<GameView[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("games").select(GAME_COLUMNS).order("name");
  if (error) throw error;
  return (data ?? []).map(toGameView);
});

// Games currently on someone's shelf.
export async function getShelfGames() {
  return (await getAllGames()).filter((g) => g.copies.length > 0);
}

export async function getGameBySlug(slug: string): Promise<GameView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("games").select(GAME_COLUMNS).eq("slug", slug).maybeSingle();
  return data ? toGameView(data) : null;
}

export const getMyFavorites = cache(async (): Promise<string[]> => {
  const viewer = await getViewer();
  if (!viewer) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("game_id").eq("member_id", viewer.id);
  return (data ?? []).map((f) => f.game_id as string);
});

export async function getTally(encounterId: string): Promise<Record<string, TallyRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vote_tally", { p_encounter: encounterId });
  if (error) throw error;
  const tally: Record<string, TallyRow> = {};
  for (const r of (data ?? []) as any[]) tally[r.game_id] = { votes: r.votes, voterIds: r.voter_ids ?? [] };
  return tally;
}

// Closes any encounter whose deadline has passed, then returns the one open for voting.
export const getVoteContext = cache(async (): Promise<VoteContext> => {
  const supabase = await createClient();
  await supabase.rpc("close_expired_encounters");
  const [{ data: enc }, { data: settings }, viewer] = await Promise.all([
    supabase.from("encounters").select("*").eq("status", "open").maybeSingle(),
    supabase.from("settings").select("vote_budget, anonymous_votes").single(),
    getViewer(),
  ]);
  const encounter = (enc as Encounter) ?? null;
  const tally = encounter ? await getTally(encounter.id) : {};
  const myVotes = viewer
    ? Object.entries(tally).filter(([, t]) => t.voterIds.includes(viewer.id)).map(([g]) => g)
    : [];
  return {
    encounter,
    tally,
    myVotes,
    budget: settings?.vote_budget ?? 5,
    anonymous: settings?.anonymous_votes ?? false,
  };
});

export const getClosedEncounters = cache(async (): Promise<Encounter[]> => {
  const supabase = await createClient();
  await supabase.rpc("close_expired_encounters");
  const { data, error } = await supabase
    .from("encounters")
    .select("*")
    .eq("status", "closed")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data as Encounter[];
});

export async function getEncounter(id: string): Promise<Encounter | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("encounters").select("*").eq("id", id).maybeSingle();
  return (data as Encounter) ?? null;
}

// encounter id -> game ids played that afternoon
export const getPlayed = cache(async (): Promise<Record<string, string[]>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("encounter_games_played").select("encounter_id, game_id");
  if (error) throw error;
  const out: Record<string, string[]> = {};
  for (const r of data ?? []) (out[r.encounter_id] ??= []).push(r.game_id);
  return out;
});

// Ranking of an encounter: games with at least one star, most votes first, ties share a rank.
export interface RankRow {
  game: GameView;
  votes: number;
  voterIds: string[];
  rank: number;
  tie: boolean;
}
export function rank(tally: Record<string, TallyRow>, games: GameView[]): RankRow[] {
  const byId = new Map(games.map((g) => [g.id, g]));
  const rows = Object.entries(tally)
    .filter(([id, t]) => t.votes > 0 && byId.has(id))
    .map(([id, t]) => ({ game: byId.get(id)!, votes: t.votes, voterIds: t.voterIds, rank: 0, tie: false }))
    .sort((a, b) => b.votes - a.votes || a.game.name.localeCompare(b.game.name));
  for (const r of rows) {
    r.rank = 1 + rows.filter((o) => o.votes > r.votes).length;
    r.tie = rows.filter((o) => o.votes === r.votes).length > 1;
  }
  return rows;
}
