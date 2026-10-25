import type { GameView, VoteContext } from "@/lib/domain";
import { fmtDay } from "@/lib/domain";
import type { StarProps } from "@/components/VoteButtons";

// Everything a star button needs for one game, from the page's vote context.
export function starProps(game: Pick<GameView, "id" | "name">, vote: VoteContext, loggedIn: boolean): StarProps {
  const used = vote.used;
  return {
    gameId: game.id,
    gameName: game.name,
    encounterId: vote.encounter?.id ?? null,
    mine: vote.myStars[game.id] ?? 0,
    count: vote.tally[game.id]?.votes ?? 0,
    budgetLeft: vote.budget - used,
    budget: vote.budget,
    loggedIn,
    dayLabel: vote.encounter ? fmtDay(vote.encounter.starts_at) : undefined,
  };
}
