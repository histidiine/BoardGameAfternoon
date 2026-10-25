import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncounterPanel, FixMembersPanel, ImportPanel, MembersPanel, PlayedPanel, VotingPanel, type AdminMember } from "@/app/admin/AdminPanels";
import { getAllGames, getClosedEncounters, getMembers, getPlayed, getTally, getViewer, getVoteContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/Bits";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "admin") {
    return (
      <EmptyState mood="confused" title="This room is for admins" action={<Link className="btn" href="/">Back to the shelf</Link>}>
        Admins load the games file and plan afternoons. Ask one of them if you need something changed.
      </EmptyState>
    );
  }
  const supabase = await createClient();
  const [vote, closed, games, members, played, { data: adminMembers }] = await Promise.all([
    getVoteContext(),
    getClosedEncounters(),
    getAllGames(),
    getMembers(),
    getPlayed(),
    supabase.rpc("admin_list_members"),
  ]);
  const tallies = await Promise.all(closed.map((e) => getTally(e.id)));
  const name = new Map(games.map((g) => [g.id, g.name]));
  const candidates = Object.fromEntries(
    closed.map((e, i) => [
      e.id,
      Object.entries(tallies[i])
        .sort((a, b) => b[1].votes - a[1].votes)
        .map(([id]) => ({ id, name: name.get(id) ?? "Removed game" })),
    ]),
  );
  const others = games.map((g) => ({ id: g.id, name: g.name }));
  // Members holding more stars than the current budget allows (after the budget was lowered).
  const starsPerMember = new Map<string, number>();
  for (const t of Object.values(vote.tally)) for (const id of t.voterIds) starsPerMember.set(id, (starsPerMember.get(id) ?? 0) + 1);
  const overBudget = [...starsPerMember.values()].filter((n) => n > vote.budget).length;

  return (
    <>
      <section className="vhead">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Run the afternoons</h1>
          <p className="lede">Load the games, plan the next table, set the voting rules, close voting and keep track of what was played.</p>
        </div>
      </section>
      <div className="panels two">
        <EncounterPanel open={vote.encounter} members={members} me={viewer.id} />
        <ImportPanel />
        <PlayedPanel encounters={closed} candidates={candidates} others={others} played={played} />
        <VotingPanel budget={vote.budget} anonymous={vote.anonymous} open={!!vote.encounter} overBudget={overBudget} />
        <MembersPanel members={(adminMembers ?? []) as AdminMember[]} me={viewer.id} />
        <FixMembersPanel members={(adminMembers ?? []) as AdminMember[]} />
      </div>
    </>
  );
}
