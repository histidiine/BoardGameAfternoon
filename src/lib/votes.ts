import type { GameView, VoteContext } from "@/lib/domain";
import { fmtDay } from "@/lib/domain";
import type { StarProps } from "@/components/VoteButtons";

// Everything a star button needs for one game, from the page's vote context.
export function starProps(game: Pick<GameView, "id" | "name">, vote: VoteContext, loggedIn: boolean): StarProps {
  const used = vote.myVotes.length;
  return {
    gameId: game.id,
    gameName: game.name,
    encounterId: vote.encounter?.id ?? null,
    on: vote.myVotes.includes(game.id),
    count: vote.tally[game.id]?.votes ?? 0,
    budgetLeft: vote.budget - used,
    budget: vote.budget,
    loggedIn,
    dayLabel: vote.encounter ? fmtDay(vote.encounter.starts_at) : undefined,
  };
}
