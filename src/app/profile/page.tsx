import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { MyGameRow, NameForm } from "@/app/profile/ProfileForms";
import { getMyFavorites, getShelfGames, getViewer, getVoteContext } from "@/lib/data";
import { LANG_LABEL, plural } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Cover } from "@/components/Bits";
import { ThemeOptions } from "@/components/ThemePicker";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const supabase = await createClient();
  const [{ data: claims }, games, favorites, vote] = await Promise.all([supabase.auth.getClaims(), getShelfGames(), getMyFavorites(), getVoteContext()]);
  const email = (claims?.claims?.email as string | undefined) ?? null;
  const mine = games.flatMap((g) => g.copies.filter((c) => c.owner.id === viewer.id).map((c) => ({ g, c })));

  return (
    <>
      <section className="vhead">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar member={viewer} large />
          <div>
            <p className="eyebrow">Profile</p>
            <h1>{viewer.display_name}</h1>
          </div>
        </div>
        <form action={logout}>
          <button className="btn ghost" type="submit">Log out</button>
        </form>
      </section>
      <div className="panels two">
        <div style={{ display: "grid", gap: 18 }}>
          <NameForm name={viewer.display_name} email={email} />
          <p className="pmuted">
            {plural(favorites.length, "favorite")}
            {vote.encounter ? ` · ${vote.used} of ${vote.budget} stars used for the next table` : ""}
            {viewer.role === "admin" ? " · admin" : ""}
          </p>
        </div>
        <div className="surface panel">
          <h2>Theme</h2>
          <p className="hint">Saved to your profile, on every device. Personal colors come later.</p>
          <div className="skins">
            <ThemeOptions current={viewer.theme} />
          </div>
        </div>
        <div className="surface panel">
          <h2>Games I own</h2>
          {mine.length ? (
            <ul className="plist" style={{ gap: 14 }}>
              {mine.map(({ g, c }) => (
                <MyGameRow
                  key={g.id}
                  startOpen={edit === g.slug}
                  cover={<Cover game={g} size="thumb" />}
                  game={{
                    gameId: g.id,
                    slug: g.slug,
                    name: g.name,
                    available: c.available,
                    notes: c.notes,
                    language: c.language ? LANG_LABEL[c.language] : null,
                    coOwners: g.copies.length - 1,
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="muted">No games under your name yet.</p>
          )}
          <p className="hint">Fix a typo in a name, say when you cannot bring a game, or add a comment. Adding and removing games still goes through an admin and the Excel file.</p>
        </div>
      </div>
    </>
  );
}
