import Link from "next/link";
import { getMyFavorites, getPlayed, getShelfGames, getViewer, getVoteContext } from "@/lib/data";
import { EmptyState } from "@/components/Bits";
import { Shelf } from "@/components/Shelf";

export default async function ShelfPage() {
  const [games, favorites, vote, played, viewer] = await Promise.all([getShelfGames(), getMyFavorites(), getVoteContext(), getPlayed(), getViewer()]);
  const owners = new Set(games.flatMap((g) => g.copies.map((c) => c.owner.id))).size;
  return (
    <>
      <section className="vhead">
        <div>
          <p className="eyebrow">The shelf</p>
          <h1>Everything we can play</h1>
          <p className="lede">
            {games.length} games from {owners} friends{"’"} shelves. Tap a heart to keep a game, a star to vote for the next table.
          </p>
        </div>
      </section>
      {games.length ? (
        <Shelf mode="shelf" games={games} favorites={favorites} vote={vote} played={[...new Set(Object.values(played).flat())]} loggedIn={!!viewer} />
      ) : (
        <EmptyState mood="sleepy" title="The shelf is empty" action={viewer?.role === "admin" ? <Link className="btn pink" href="/admin">Load the games file</Link> : undefined}>
          An admin loads the group{"’"}s games from the Excel file. Check back soon.
        </EmptyState>
      )}
    </>
  );
}
