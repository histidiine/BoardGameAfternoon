import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllGames, getEncounter, getMembers, getPlayed, getTally, getVoteContext, rank } from "@/lib/data";
import { fmtFull } from "@/lib/domain";
import { EmptyState } from "@/components/Bits";
import { Icon } from "@/components/Icons";
import { Podium, RankList } from "@/components/Ranking";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const e = await getEncounter((await params).id);
  return { title: e ? `Table of ${fmtFull(e.starts_at)}` : "Past table" };
}

export default async function PastTablePage({ params }: Params) {
  const { id } = await params;
  await getVoteContext(); // closes expired encounters first
  const e = await getEncounter(id);
  if (!e || e.status !== "closed") notFound();
  const [tally, games, members, playedAll, vote] = await Promise.all([getTally(e.id), getAllGames(), getMembers(), getPlayed(), getVoteContext()]);
  const rows = rank(tally, games);
  const played = playedAll[e.id] ?? [];
  const host = members.find((m) => m.id === e.host_id);
  const playedNames = played.map((gid) => games.find((g) => g.id === gid)?.name).filter(Boolean);
  const extra = played.filter((gid) => !rows.some((r) => r.game.id === gid)).map((gid) => games.find((g) => g.id === gid)?.name).filter(Boolean);

  return (
    <>
      <p style={{ paddingTop: 16 }}>
        <Link className="back" href="/past">
          <Icon name="back" />
          All past tables
        </Link>
      </p>
      <section className="vhead">
        <div>
          <p className="eyebrow">Past table</p>
          <h1>{fmtFull(e.starts_at)}</h1>
          <p className="lede">
            {e.place}, hosted by {host?.display_name ?? "someone"}. Final ranking, frozen when voting closed.
          </p>
        </div>
      </section>
      {rows.length ? (
        <>
          <div className="podium-wrap">
            <div />
            <Podium rows={rows} members={members} anonymous={vote.anonymous} />
          </div>
          <RankList rows={rows} members={members} anonymous={vote.anonymous} played={played} />
        </>
      ) : (
        <EmptyState mood="sleepy" title="Nobody voted">This afternoon happened without a vote.</EmptyState>
      )}
      {playedNames.length > 0 && (
        <p className="pmuted" style={{ marginTop: 14 }}>
          Played that afternoon: {playedNames.join(", ")}.{extra.length ? ` (${extra.join(", ")} without votes.)` : ""}
        </p>
      )}
    </>
  );
}
