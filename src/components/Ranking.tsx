import Link from "next/link";
import type { MemberLite, VoteContext } from "@/lib/domain";
import { plural } from "@/lib/domain";
import type { RankRow } from "@/lib/data";
import { starProps } from "@/lib/votes";
import { Cover } from "@/components/Bits";
import { Icon, Px } from "@/components/Icons";
import { StarButton } from "@/components/VoteButtons";

function voterLine(ids: string[], votes: number, names: Map<string, string>, anonymous: boolean) {
  if (anonymous || ids.length < votes) return plural(votes, "star");
  return ids.map((id) => names.get(id) ?? "Former member").join(", ");
}

function StaticStar({ votes }: { votes: number }) {
  return (
    <span className="hs star on" style={{ boxShadow: "none" }}>
      <Px name="star" on />
      <span>{votes}</span>
    </span>
  );
}

interface Props {
  rows: RankRow[];
  members: MemberLite[];
  anonymous: boolean;
  // Live pages pass the vote context so stars can still be added or removed.
  live?: { vote: VoteContext; loggedIn: boolean };
  played?: string[];
}

export function Podium({ rows, members, anonymous, live }: Props) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  const names = new Map(members.map((m) => [m.id, m.display_name]));
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="podium" role="list" aria-label="Top games">
      {order.map((r) => {
        const pos = top.indexOf(r) + 1;
        return (
          <div className="spot" role="listitem" key={r.game.id}>
            <Link href={`/games/${r.game.slug}`} tabIndex={-1} aria-hidden="true" style={{ width: "100%", display: "grid", justifyItems: "center", textDecoration: "none" }}>
              <Cover game={r.game} size="mid" />
            </Link>
            <Link className="nm" href={`/games/${r.game.slug}`}>
              {r.game.name}
            </Link>
            {live && r.game.copies.length ? <StarButton {...starProps(r.game, live.vote, live.loggedIn)} /> : <StaticStar votes={r.votes} />}
            <span className="vn">{voterLine(r.voterIds, r.votes, names, anonymous)}</span>
            <div className={`step r${pos}`} aria-label={`Rank ${r.rank}${r.tie ? ", tied" : ""}`}>
              {r.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RankList({ rows, members, anonymous, live, played }: Props) {
  const rest = rows.slice(3);
  if (!rest.length) return null;
  const names = new Map(members.map((m) => [m.id, m.display_name]));
  return (
    <ol className="ranks">
      {rest.map((r) => (
        <li className="surface rrow" key={r.game.id}>
          <span className="rnum">{r.rank}</span>
          <Cover game={r.game} size="thumb" />
          <div className="rmain">
            <span>
              <Link href={`/games/${r.game.slug}`}>{r.game.name}</Link>
              {r.tie && <span className="tie">tie</span>}
              {played?.includes(r.game.id) && (
                <>
                  {" "}
                  <span className="played">
                    <Icon name="check" />
                    Played
                  </span>
                </>
              )}
            </span>
            <span className="vn">{voterLine(r.voterIds, r.votes, names, anonymous)}</span>
          </div>
          {live && r.game.copies.length ? <StarButton {...starProps(r.game, live.vote, live.loggedIn)} /> : <StaticStar votes={r.votes} />}
        </li>
      ))}
    </ol>
  );
}
