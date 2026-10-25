import type { Metadata } from "next";
import Link from "next/link";
import { getMyFavorites, getPlayed, getShelfGames, getViewer, getVoteContext } from "@/lib/data";
import { EmptyState } from "@/components/Bits";
import { Shelf } from "@/components/Shelf";

export const metadata: Metadata = { title: "My favorites" };

export default async function FavoritesPage() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <EmptyState mood="happy" title="Your favorites live here" action={<Link className="btn pink" href="/login">Log in</Link>}>
        Log in to heart games and find them again on any device. Browsing the shelf works without an account.
      </EmptyState>
    );
  }
  const [games, favorites, vote, played] = await Promise.all([getShelfGames(), getMyFavorites(), getVoteContext(), getPlayed()]);
  return (
    <>
      <section className="vhead">
        <div>
          <p className="eyebrow">My favorites</p>
          <h1>Games you hearted</h1>
          <p className="lede">Your personal list. Hearts stay until you remove them.</p>
        </div>
      </section>
      <Shelf mode="favorites" games={games} favorites={favorites} vote={vote} played={[...new Set(Object.values(played).flat())]} loggedIn />
    </>
  );
}
