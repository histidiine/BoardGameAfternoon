"use server";

import ExcelJS from "exceljs";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/data";
import { parseRows, previewSummary, type ImportRow, type ImportSummary } from "@/lib/import";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions";
import { VOTE_BUDGET_MAX, VOTE_BUDGET_MIN } from "@/lib/domain";

async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.role === "admin" ? viewer : null;
}
const NOT_ADMIN = { ok: false as const, error: "Only admins can do this." };
const friendly = (e: { code?: string; message: string }, fallback: string) => (e.code === "P0001" ? e.message : fallback);

/* ---------- Excel import ---------- */

export type PreviewResult =
  | { ok: true; file: string; rows: ImportRow[]; errors: string[]; warnings: string[]; summary: ImportSummary }
  | { ok: false; error: string };

// ExcelJS cells can hold rich text, hyperlinks, formulas or dates; reduce each to plain text.
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("hyperlink" in v) return String(v.hyperlink ?? v.text ?? "");
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String((v as { text: unknown }).text);
    return "";
  }
  return String(v);
}

async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: "greedy" });
    return parsed.data;
  }
  if (!name.endsWith(".xlsx")) throw new Error("format");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = cellText(cell.value).trim()));
  const out: Record<string, unknown>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, col) => {
      if (h) obj[h] = cellText(row.getCell(col).value);
    });
    out.push(obj);
  }
  return out;
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a file first." };
  if (file.size > 4_000_000) return { ok: false, error: "That file is over 4 MB. Keep only the games sheet and try again." };

  let raw: Record<string, unknown>[];
  try {
    raw = await readSheet(file);
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).message === "format"
        ? "Use an .xlsx or .csv file. Older .xls files: open them in Excel and save as .xlsx."
        : `Could not read ${file.name}. Save it as .xlsx or .csv and try again.`,
    };
  }
  const parsed = parseRows(raw);

  const supabase = await createClient();
  const [{ data: games }, { data: members }, { data: copies }] = await Promise.all([
    supabase.from("games").select("name, bgg_id"),
    supabase.from("members").select("display_name"),
    supabase.from("copies").select("game:games(name), owner:members(display_name)").eq("active", true),
  ]);
  const summary = previewSummary(parsed.rows, {
    games: games ?? [],
    members: (members ?? []).map((m) => m.display_name),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    copies: (copies ?? []).map((c: any) => ({ game: c.game?.name ?? "", owner: c.owner?.display_name ?? "" })),
  });
  return { ok: true, file: file.name, ...parsed, summary };
}

export async function applyImport(rows: ImportRow[]): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: "There is nothing to import." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_games", { p_rows: rows });
  if (error) {
    return { ok: false, error: friendly(error, "The import stopped and nothing was changed. Check the file and try again.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, summary: data as ImportSummary };
}

/* ---------- encounters ---------- */

// Reads and checks the afternoon form, shared by "Open voting" and "Edit".
function readEncounterForm(formData: FormData) {
  const startsAt = String(formData.get("starts_at") ?? "");
  const deadline = String(formData.get("voting_deadline") ?? "") || startsAt;
  const place = String(formData.get("place") ?? "").trim();
  const host = String(formData.get("host") ?? "") || null;
  const start = new Date(startsAt);
  const dl = new Date(deadline);

  let error: string | null = null;
  if (Number.isNaN(start.getTime())) error = "Pick a date and a start time.";
  else if (start <= new Date()) error = "That date is in the past. Pick a future afternoon.";
  else if (!place) error = "Add a place so people know where to go.";
  else if (place.length > 120) error = "Keep the place under 120 characters.";
  else if (Number.isNaN(dl.getTime()) || dl <= new Date()) error = "The voting deadline must be in the future.";
  else if (dl > start) error = "Voting has to close before the afternoon starts, or at the start.";
  if (error) return { ok: false as const, error };
  return { ok: true as const, row: { starts_at: start.toISOString(), voting_deadline: dl.toISOString(), place, host_id: host } };
}

export async function createEncounter(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const form = readEncounterForm(formData);
  if (!form.ok) return form;
  const supabase = await createClient();
  await supabase.rpc("close_expired_encounters");
  const { error } = await supabase.from("encounters").insert(form.row);
  if (error?.code === "23505") return { ok: false, error: "Only one afternoon can be open for voting. Close the current one first." };
  if (error) return { ok: false, error: "The afternoon was not created. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Changes the date, time, place, host or deadline of the afternoon open for voting. Stars stay.
export async function updateEncounter(encounterId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const form = readEncounterForm(formData);
  if (!form.ok) return form;
  const supabase = await createClient();
  await supabase.rpc("close_expired_encounters");
  const { data, error } = await supabase
    .from("encounters")
    .update(form.row)
    .eq("id", encounterId)
    .eq("status", "open")
    .select("id");
  if (error) return { ok: false, error: "The changes did not save. Try again." };
  if (!data?.length) return { ok: false, error: "Voting for this afternoon has closed in the meantime. Reload the page." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function closeVoting(encounterId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { error } = await supabase
    .from("encounters")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", encounterId)
    .eq("status", "open");
  if (error) return { ok: false, error: "Voting did not close. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPlayed(encounterId: string, gameId: string, played: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { error } = played
    ? await supabase.from("encounter_games_played").upsert({ encounter_id: encounterId, game_id: gameId }, { ignoreDuplicates: true })
    : await supabase.from("encounter_games_played").delete().eq("encounter_id", encounterId).eq("game_id", gameId);
  if (error) return { ok: false, error: "That did not save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- members and settings ---------- */

export async function setRole(memberId: string, role: "member" | "admin"): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_member: memberId, p_role: role });
  if (error) return { ok: false, error: friendly(error, "The role did not change. Try again.") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface MergeSummary { removed: string; kept: string; games: number; favorites: number; stars: number }

// One person entered twice: everything of `fromId` moves to `intoId`, then `fromId` is deleted.
export async function mergeMembers(fromId: string, intoId: string): Promise<{ ok: true; summary: MergeSummary } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_merge_members", { p_from: fromId, p_into: intoId });
  if (error) return { ok: false, error: friendly(error, "The members were not merged. Reload the page and try again.") };
  revalidatePath("/", "layout");
  return { ok: true, summary: data as MergeSummary };
}

// Takes every copy of one member off the shelf (hidden, not deleted). A new import brings them back.
export async function removeMemberCopies(memberId: string): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_remove_member_copies", { p_member: memberId });
  if (error) return { ok: false, error: friendly(error, "The games were not removed. Try again.") };
  revalidatePath("/", "layout");
  return { ok: true, removed: data as number };
}

export async function setAnonymousVotes(anonymous: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ anonymous_votes: anonymous }).eq("id", true);
  if (error) return { ok: false, error: "The setting did not save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Stars each member can give per afternoon. Stars already given stay when the number goes down;
// a member above the new number just cannot add more until they remove some.
export async function setVoteBudget(budget: number): Promise<ActionResult> {
  if (!(await requireAdmin())) return NOT_ADMIN;
  if (!Number.isInteger(budget) || budget < VOTE_BUDGET_MIN || budget > VOTE_BUDGET_MAX) {
    return { ok: false, error: `Choose a number of stars between ${VOTE_BUDGET_MIN} and ${VOTE_BUDGET_MAX}.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ vote_budget: budget }).eq("id", true);
  if (error) return { ok: false, error: "The setting did not save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
