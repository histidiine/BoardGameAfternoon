import Link from "next/link";
import type { MemberLite, VoteContext } from "@/lib/domain";
import { plural } from "@/lib/domain";
import type { RankRow } from "@/lib/data";
import { starProps } from "@/lib/votes";
import { Cover } from "@/components/Bits";
import { Icon, Px } from "@/components/Icons";
import { StarButton } from "@/components/VoteButtons";

function voterLine(ids: string[], stars: number[], votes: number, names: Map<string, string>, anonymous: boolean) {
  if (anonymous || stars.reduce((s, n) => s + n, 0) < votes) return plural(votes, "star");
  return ids.map((id, i) => (names.get(id) ?? "Former member") + (stars[i] > 1 ? ` ×${stars[i]}` : "")).join(", ");
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

// How many games stand on the podium. Tied games move up only as a whole group that fits in
// the 3 places. The lowest group stays in the list when several games share it, so when every
// game has the same number of stars there is no podium at all.
//   2,1,1,1 -> 1 on the podium · 2,2,1,1 -> 2 · 2,2,2,2,1,1 -> 0 · 1,1,1 -> 0 · 3,2,1 -> 3
export function podiumSize(rows: RankRow[]) {
  const groups: number[] = [];
  rows.forEach((r, i) => (i && r.votes === rows[i - 1].votes ? groups[groups.length - 1]++ : groups.push(1)));
  let n = 0;
  for (let g = 0; g < groups.length; g++) {
    const isLast = g === groups.length - 1;
    if (n + groups[g] > 3 || (isLast && groups[g] > 1)) break;
    n += groups[g];
  }
  return n;
}

// Podium places, left to right: second, first, third, as on a real podium.
const COLUMN = [2, 1, 3];

export function Podium({ rows, members, anonymous, live }: Props) {
  const top = rows.slice(0, podiumSize(rows));
  if (!top.length) return null;
  const names = new Map(members.map((m) => [m.id, m.display_name]));
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="podium" role="list" aria-label="Top games">
      {order.map((r) => {
        const pos = top.indexOf(r) + 1;
        return (
          <div className="spot" role="listitem" key={r.game.id} style={{ gridColumn: COLUMN[pos - 1], gridRow: 1 }}>
            <Link href={`/games/${r.game.slug}`} tabIndex={-1} aria-hidden="true" style={{ width: "100%", display: "grid", justifyItems: "center", textDecoration: "none" }}>
              <Cover game={r.game} size="mid" />
            </Link>
            <Link className="nm" href={`/games/${r.game.slug}`}>
              {r.game.name}
            </Link>
            {live && r.game.copies.length ? <StarButton {...starProps(r.game, live.vote, live.loggedIn)} /> : <StaticStar votes={r.votes} />}
            <span className="vn">{voterLine(r.voterIds, r.voterStars, r.votes, names, anonymous)}</span>
            <div className={`step r${Math.min(r.rank, 3)}`} aria-label={`Rank ${r.rank}${r.tie ? ", tied" : ""}`}>
              {r.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RankList({ rows, members, anonymous, live, played }: Props) {
  const rest = rows.slice(podiumSize(rows));
  if (!rest.length) return null;
  const names = new Map(members.map((m) => [m.id, m.display_name]));
  return (
    <ol className="ranks" style={rest.length === rows.length ? { marginTop: 24 } : undefined}>
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
            <span className="vn">{voterLine(r.voterIds, r.voterStars, r.votes, names, anonymous)}</span>
          </div>
          {live && r.game.copies.length ? <StarButton {...starProps(r.game, live.vote, live.loggedIn)} /> : <StaticStar votes={r.votes} />}
        </li>
      ))}
    </ol>
  );
}
