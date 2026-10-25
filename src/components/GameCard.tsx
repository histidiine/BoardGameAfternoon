import Link from "next/link";
import type { GameView, VoteContext } from "@/lib/domain";
import { duration, isAvailable, players } from "@/lib/domain";
import { starProps } from "@/lib/votes";
import { Avatar, Cover, Tag } from "@/components/Bits";
import { Icon } from "@/components/Icons";
import { HeartButton, StarButton } from "@/components/VoteButtons";

export function GameCard({ game, fav, vote, loggedIn }: { game: GameView; fav: boolean; vote: VoteContext; loggedIn: boolean }) {
  const owners = [...new Map(game.copies.map((c) => [c.owner.id, c.owner])).values()];
  return (
    <article className={`card${isAvailable(game) ? "" : " off"}`}>
      <Link href={`/games/${game.slug}`} tabIndex={-1} aria-hidden="true" style={{ textDecoration: "none" }}>
        <Cover game={game} />
      </Link>
      <div className="cbody">
        <h3 className="ctitle">
          <Link href={`/games/${game.slug}`}>{game.name}</Link>
        </h3>
        <div className="meta">
          <span title="Players">
            <Icon name="meeple" />
            <span className="sr">Players </span>
            {players(game)}
          </span>
          <span title="Duration">
            <Icon name="hourglass" />
            <span className="sr">Duration </span>
            {duration(game.duration_min)}
          </span>
        </div>
        <div className="tags">
          {game.types.map((t) => (
            <Tag key={t} type={t} />
          ))}
        </div>
        {!isAvailable(game) && <span className="unavail sm">Not available right now</span>}
        <div className="cfoot">
          <div className="owners" aria-label={`Owners: ${owners.map((o) => o.display_name).join(", ")}`}>
            {owners.map((o) => (
              <Avatar key={o.id} member={o} />
            ))}
          </div>
          <div className="acts">
            <HeartButton gameId={game.id} gameName={game.name} on={fav} loggedIn={loggedIn} />
            <StarButton {...starProps(game, vote, loggedIn)} />
          </div>
        </div>
      </div>
    </article>
  );
}
