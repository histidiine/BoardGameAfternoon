import type { Metadata } from "next";
import Link from "next/link";
import { getAllGames, getClosedEncounters, getPlayed, getTally, getVoteContext, rank } from "@/lib/data";
import { fmtStamp, plural } from "@/lib/domain";
import { EmptyState } from "@/components/Bits";

export const metadata: Metadata = { title: "Past tables" };

export default async function PastTablesPage() {
  const [encounters, games, played, vote] = await Promise.all([getClosedEncounters(), getAllGames(), getPlayed(), getVoteContext()]);
  const tallies = await Promise.all(encounters.map((e) => getTally(e.id)));
  return (
    <>
      <section className="vhead">
        <div>
          <p className="eyebrow">Past tables</p>
          <h1>Our afternoons so far</h1>
          <p className="lede">Every vote page, frozen when voting closed. Open one to see the full ranking and what we actually played.</p>
        </div>
      </section>
      {encounters.length ? (
        <div className="tickets">
          {encounters.map((e, i) => {
            const rows = rank(tallies[i], games);
            const voters = new Set(Object.values(tallies[i]).flatMap((t) => t.voterIds)).size;
            const stamp = fmtStamp(e.starts_at);
            const nPlayed = played[e.id]?.length ?? 0;
            return (
              <Link className="ticket" href={`/past/${e.id}`} key={e.id}>
                <div className="stub">
                  <div className="stamp">
                    <b>{stamp.day}</b>
                    <span>{stamp.month} {stamp.year}</span>
                  </div>
                </div>
                <div className="tbody">
                  <h3>{e.place}</h3>
                  <span className="sub">
                    {voters && !vote.anonymous ? `${plural(voters, "voter")} · ` : ""}
                    {plural(nPlayed, "game")} played
                  </span>
                  <ol className="top3">
                    {rows.length ? (
                      rows.slice(0, 3).map((r) => (
                        <li key={r.game.id}>
                          {r.game.name} <span className="muted">({r.votes})</span>
                        </li>
                      ))
                    ) : (
                      <li className="muted">No votes</li>
                    )}
                  </ol>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState mood="sleepy" title="No past tables yet">Each afternoon lands here once voting closes, with its final ranking.</EmptyState>
      )}
    </>
  );
}
