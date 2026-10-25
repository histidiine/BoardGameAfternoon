"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data";
import { MAX_STARS_PER_GAME, isTheme } from "@/lib/domain";
import { THEME_COOKIE } from "@/lib/theme";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Messages raised by the database rules are written for people; anything else gets a generic line.
function friendly(error: { code?: string; message: string }, fallback: string) {
  return error.code === "P0001" ? error.message : fallback;
}

export async function toggleFavorite(gameId: string, on: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in to keep favorites." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("favorites").upsert({ member_id: viewer.id, game_id: gameId }, { ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("member_id", viewer.id).eq("game_id", gameId);
  if (error) return { ok: false, error: friendly(error, "That did not save. Try again.") };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Sets how many stars the viewer gives a game for the open afternoon: 0 (none), 1 or 2.
export async function setStars(encounterId: string, gameId: string, stars: number): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in to vote." };
  if (!Number.isInteger(stars) || stars < 0 || stars > MAX_STARS_PER_GAME) return { ok: false, error: "Give a game up to " + MAX_STARS_PER_GAME + " stars." };
  const supabase = await createClient();
  const mine = { encounter_id: encounterId, game_id: gameId, member_id: viewer.id };
  let error: { code?: string; message: string } | null = null;
  if (stars === 0) {
    ({ error } = await supabase.from("votes").delete().match(mine));
  } else {
    // Change the existing star first; give a new one only if there was none.
    const upd = await supabase.from("votes").update({ stars }).match(mine).select("game_id");
    error = upd.error;
    if (!error && !upd.data?.length) {
      ({ error } = await supabase.from("votes").insert({ ...mine, stars }));
      if (error?.code === "23505") ({ error } = await supabase.from("votes").update({ stars }).match(mine));
    }
  }
  if (error) return { ok: false, error: friendly(error, "Your star did not save. Try again.") };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Saved in the member's profile, and in a cookie for visitors who are not logged in.
export async function setTheme(theme: string): Promise<ActionResult> {
  if (!isTheme(theme)) return { ok: false, error: "Unknown theme." };
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const viewer = await getViewer();
  if (viewer) {
    const supabase = await createClient();
    await supabase.from("members").update({ theme }).eq("id", viewer.id);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDisplayName(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in first." };
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 40) return { ok: false, error: "Use a name between 1 and 40 characters." };
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ display_name: name }).eq("id", viewer.id);
  if (error?.code === "23505") return { ok: false, error: "Someone in the group already uses that name." };
  if (error) return { ok: false, error: "Your name did not save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// A member fixes a game they own: its name (typos), whether their copy is available, and their comment.
export async function updateMyCopy(gameId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in first." };
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const notes = String(formData.get("notes") ?? "").trim();
  const available = formData.get("available") === "on";
  if (!name || name.length > 120) return { ok: false, error: "Use a game name between 1 and 120 characters." };
  if (notes.length > 200) return { ok: false, error: "Keep the comment under 200 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("member_update_copy", { p_game: gameId, p_name: name, p_available: available, p_notes: notes });
  if (error) return { ok: false, error: friendly(error, "Your changes did not save. Try again.") };
  revalidatePath("/", "layout");
  return { ok: true };
}
