// Validation of the Excel template rows (v1 import). Pure functions, shared by the
// admin preview and the import itself.
import type { Complexity, GameType, Lang } from "@/lib/domain";

export const TEMPLATE_COLUMNS = [
  "Name", "Owner", "Min players", "Max players", "Duration (min)", "Type",
  "Complexity", "Min age", "Language", "Image URL", "BGG ID", "Short description", "Notes",
] as const;

export interface ImportRow {
  row: number;
  name: string;
  owner: string;
  min: number;
  max: number;
  duration: number;
  types: GameType[];
  complexity: Complexity | "";
  min_age: number | "";
  language: Lang | "";
  image_url: string;
  bgg_id: string;
  description: string;
  notes: string;
}

export interface ParseResult {
  rows: ImportRow[];
  errors: string[];
  warnings: string[];
}

const key = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// How the database matches people (public.name_key): accents, capitals, spaces and
// punctuation are ignored, so "Aur\u00e9lie" and "Aurelie" are the same owner.
export const nameKey = (s: string) => key(s.replace(/[\u00e6\u00c6]/g, "a").replace(/[\u0153\u0152\u00f8\u00d8]/g, "o")) || s.trim().toLowerCase();

const HEADER: Record<string, keyof RawRow> = {
  name: "name", game: "name", owner: "owner", minplayers: "min", maxplayers: "max",
  durationmin: "duration", duration: "duration", type: "types", types: "types", complexity: "complexity",
  minage: "age", age: "age", language: "lang", imageurl: "img", image: "img", bggid: "bgg", bgg: "bgg",
  shortdescription: "desc", description: "desc", notes: "notes",
};
interface RawRow { name?: string; owner?: string; min?: string; max?: string; duration?: string; types?: string; complexity?: string; age?: string; lang?: string; img?: string; bgg?: string; desc?: string; notes?: string }

const TYPE_ALIAS: Record<string, GameType> = {
  party: "party", family: "family", familial: "family", famille: "family",
  expert: "expert", strategy: "expert", expertstrategy: "expert", strategie: "expert",
  small: "small", filler: "small", smallfiller: "small",
  cooperative: "coop", coop: "coop", cooperatif: "coop",
  twoplayer: "two", twoplayers: "two", "2player": "two", "2players": "two", duo: "two", "2joueurs": "two",
};
const LANG_ALIAS: Record<string, Lang> = {
  li: "LI", languageindependent: "LI", independent: "LI", none: "LI", independant: "LI",
  fr: "FR", french: "FR", francais: "FR",
  en: "EN", english: "EN", anglais: "EN",
  de: "DE", german: "DE", deutsch: "DE", allemand: "DE",
  it: "IT", italian: "IT", italiano: "IT", italien: "IT",
};
const COMPLEXITY_ALIAS: Record<string, Complexity> = {
  light: "light", leger: "light", easy: "light",
  medium: "medium", moyen: "medium",
  heavy: "heavy", lourd: "heavy", hard: "heavy",
};

// rows: one object per spreadsheet row, keyed by the header text of each column.
export function parseRows(input: Record<string, unknown>[]): ParseResult {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  input.forEach((r, i) => {
    const n = i + 2; // row 1 holds the headers
    const o: RawRow = {};
    for (const [k, v] of Object.entries(r)) {
      const field = HEADER[key(k)];
      if (field) o[field] = String(v ?? "").trim();
    }
    if (!Object.values(o).some(Boolean)) return; // blank line

    const missing = ([["name", "Name"], ["owner", "Owner"], ["min", "Min players"], ["max", "Max players"], ["duration", "Duration (min)"], ["types", "Type"]] as const)
      .filter(([k]) => !o[k])
      .map(([, label]) => label);
    if (missing.length) {
      errors.push(`Row ${n}${o.name ? ` (${o.name})` : ""}: missing ${missing.join(", ")}.`);
      return;
    }
    const label = `Row ${n} (${o.name})`;
    const min = Number.parseInt(o.min!, 10);
    const max = Number.parseInt(o.max!, 10);
    const duration = Number.parseInt(o.duration!, 10);
    if (!(min >= 1 && max >= min && max <= 99 && duration >= 1 && duration <= 1440)) {
      errors.push(`${label}: players and duration must be whole numbers, with max players at least min players.`);
      return;
    }
    if (o.name!.length > 120 || o.owner!.length > 40) {
      errors.push(`${label}: the name (120 characters) or owner (40 characters) is too long.`);
      return;
    }

    const types: GameType[] = [];
    for (const t of o.types!.split(/[;,/+]+/).map((s) => s.trim()).filter(Boolean)) {
      const a = TYPE_ALIAS[key(t)];
      if (a) {
        if (!types.includes(a)) types.push(a);
      } else warnings.push(`${label}: type "${t}" is not on the list and was skipped.`);
    }
    if (!types.length) {
      errors.push(`${label}: no known game type. Use Party, Family, Expert, Small, Cooperative or Two-player.`);
      return;
    }

    let complexity: Complexity | "" = "";
    if (o.complexity) {
      complexity = COMPLEXITY_ALIAS[key(o.complexity)] ?? "";
      if (!complexity) warnings.push(`${label}: complexity "${o.complexity}" should be Light, Medium or Heavy. Left empty.`);
    }
    let language: Lang | "" = "";
    if (o.lang) {
      language = LANG_ALIAS[key(o.lang)] ?? "";
      if (!language) warnings.push(`${label}: language "${o.lang}" not recognized. Left empty.`);
    }
    let min_age: number | "" = "";
    if (o.age) {
      const a = Number.parseInt(o.age, 10);
      if (a >= 0 && a <= 99) min_age = a;
      else warnings.push(`${label}: minimum age "${o.age}" is not a number. Left empty.`);
    }
    let bgg_id = "";
    if (o.bgg) {
      const b = Number.parseInt(o.bgg.replace(/\D/g, ""), 10);
      if (b > 0) bgg_id = String(b);
      else warnings.push(`${label}: BGG ID "${o.bgg}" is not a number. Left empty.`);
    }
    let image_url = "";
    if (o.img) {
      if (/^https?:\/\//i.test(o.img)) image_url = o.img;
      else warnings.push(`${label}: the image link must start with http:// or https://. Left empty.`);
    }
    const description = (o.desc ?? "").slice(0, 600);
    if ((o.desc ?? "").length > 600) warnings.push(`${label}: description shortened to 600 characters.`);
    const notes = (o.notes ?? "").slice(0, 200);

    rows.push({ row: n, name: o.name!, owner: o.owner!, min, max, duration, types, complexity, min_age, language, image_url, bgg_id, description, notes });
  });

  return { rows, errors, warnings };
}

export interface ImportSummary {
  new_games: string[];
  updated_games: string[];
  new_members: string[];
  new_copies: number;
}

// Predicts what an import will do, mirroring public.import_games in the database.
export function previewSummary(
  rows: ImportRow[],
  existing: { games: { name: string; bgg_id: number | null }[]; members: string[]; copies: { game: string; owner: string }[] },
): ImportSummary {
  const norm = (s: string) => s.trim().toLowerCase();
  const games = existing.games.map((g) => ({ name: g.name, bgg: g.bgg_id ? String(g.bgg_id) : "" }));
  const members = new Set(existing.members.map(nameKey));
  const copies = new Set(existing.copies.map((c) => `${norm(c.game)}|${nameKey(c.owner)}`));
  const out: ImportSummary = { new_games: [], updated_games: [], new_members: [], new_copies: 0 };
  for (const r of rows) {
    if (!members.has(nameKey(r.owner))) {
      members.add(nameKey(r.owner));
      out.new_members.push(r.owner);
    }
    let g = (r.bgg_id && games.find((x) => x.bgg === r.bgg_id)) || games.find((x) => norm(x.name) === norm(r.name));
    if (!g) {
      g = { name: r.name, bgg: r.bgg_id };
      games.push(g);
      out.new_games.push(r.name);
    } else if (!out.new_games.includes(g.name) && !out.updated_games.includes(g.name)) {
      out.updated_games.push(g.name);
    }
    const k = `${norm(g.name)}|${nameKey(r.owner)}`;
    if (!copies.has(k)) {
      copies.add(k);
      out.new_copies++;
    }
  }
  return out;
}
