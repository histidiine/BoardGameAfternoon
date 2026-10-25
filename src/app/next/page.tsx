import type { Metadata } from "next";
import Link from "next/link";
import { getAllGames, getMembers, getViewer, getVoteContext, rank } from "@/lib/data";
import { closesIn, fmtDay, fmtFull, fmtTime, plural } from "@/lib/domain";
import { EmptyState } from "@/components/Bits";
import { Icon, Px } from "@/components/Icons";
import { Mascot } from "@/components/Mascot";
import { Podium, RankList, podiumSize } from "@/components/Ranking";

export const metadata: Metadata = { title: "Next table" };

export default async function NextTablePage() {
  const [vote, viewer, games, members] = await Promise.all([getVoteContext(), getViewer(), getAllGames(), getMembers()]);
  const e = vote.encounter;
  if (!e) {
    return (
      <>
        <section className="vhead">
          <div>
            <p className="eyebrow">Next table</p>
            <h1>No afternoon is open for voting</h1>
          </div>
        </section>
        <EmptyState
          mood="sleepy"
          title="The table is resting"
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link className="btn" href="/past">See past tables</Link>
              {viewer?.role === "admin" && <Link className="btn pink" href="/admin">Plan the next one</Link>}
            </div>
          }
        >
          When an admin plans the next afternoon, its vote page opens here.
        </EmptyState>
      </>
    );
  }

  const rows = rank(vote.tally, games);
  const host = members.find((m) => m.id === e.host_id);
  const used = vote.used;
  const voterCount = new Set(Object.values(vote.tally).flatMap((t) => t.voterIds)).size;
  const live = { vote, loggedIn: !!viewer };

  return (
    <>
      <section className="vhead">
        <div>
          <p className="eyebrow">Next table</p>
          <h1>{fmtFull(e.starts_at)}</h1>
          <p className="lede">You have {vote.budget} stars to give. Give a game 1 star, or 2 if you really want to play it: tap the star once, twice, and a third time to take them back. You can change your stars until voting closes.</p>
        </div>
      </section>
      <div className="surface enc">
        <ul className="facts">
          <li><Icon name="cal" />{fmtDay(e.starts_at)} at {fmtTime(e.starts_at)}</li>
          <li><Icon name="pin" />{e.place}</li>
          <li><Icon name="home" />Hosted by {host?.display_name ?? "someone"}</li>
          <li><Icon name="clock" />Voting closes {closesIn(e.voting_deadline)} ({fmtDay(e.voting_deadline)}, {fmtTime(e.voting_deadline)})</li>
          {!vote.anonymous && <li><Icon name="users" />{voterCount} {voterCount === 1 ? "member has" : "members have"} voted</li>}
        </ul>
        <div className="budget">
          {viewer ? (
            <>
              <b>Your stars</b>
              <div className="stars" aria-hidden="true">
                {Array.from({ length: vote.budget }, (_, i) => (
                  <span key={i} className={i < used ? "used" : ""}>
                    <Px name="star" on={i < used} />
                  </span>
                ))}
              </div>
              <span className="muted">
                {used > vote.budget
                  ? `You have ${used} stars, more than the ${vote.budget} now allowed. Remove ${used - vote.budget} to star another game.`
                  : `${vote.budget - used} of ${vote.budget} left${used ? "" : ". Star games on the shelf or below."}`}
              </span>
            </>
          ) : (
            <>
              <b>Want a say?</b>
              <span className="muted">Log in to give your {vote.budget} stars.</span>
              <Link className="btn pink" href="/login">Log in to vote</Link>
            </>
          )}
          <Link className="btn mint" href="/">
            <Px name="star" on /> Pick from the shelf
          </Link>
        </div>
      </div>

      {rows.length ? (
        <>
          {podiumSize(rows) > 0 && (
            <div className="podium-wrap">
              <div style={{ justifySelf: "center" }}>
                <Mascot mood="cheer" size={110} />
              </div>
              <Podium rows={rows} members={members} anonymous={vote.anonymous} live={live} />
            </div>
          )}
          {rows.length > 1 && rows[0].tie && (
            <p className="pmuted" style={{ marginTop: 12, textAlign: "center" }}>Ties stay ties. The host decides.</p>
          )}
          <RankList rows={rows} members={members} anonymous={vote.anonymous} live={live} />
        </>
      ) : (
        <EmptyState mood="happy" title="No stars yet" action={<Link className="btn" href="/">Go to the shelf</Link>}>
          Star games on the shelf to put them on the table. The leaders get the podium.
        </EmptyState>
      )}
      {vote.anonymous && <p className="pmuted" style={{ marginTop: 16 }}>Voter names are hidden for this group. {plural(rows.reduce((s, r) => s + r.votes, 0), "star")} so far.</p>}
    </>
  );
}
