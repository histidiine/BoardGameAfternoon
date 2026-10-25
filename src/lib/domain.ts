// Shared vocabulary of the site, safe to import from server and client code.

export type GameType = "party" | "family" | "expert" | "small" | "coop" | "two";
export type Complexity = "light" | "medium" | "heavy";
export type Lang = "LI" | "FR" | "EN" | "DE" | "IT";
export type Theme = "a" | "b" | "c";
export type Role = "member" | "admin";

export interface MemberLite {
  id: string;
  display_name: string;
  color: GameType;
}
export interface Member extends MemberLite {
  user_id: string | null;
  role: Role;
  theme: Theme;
}
export interface CopyView {
  owner: MemberLite;
  language: Lang | null;
  notes: string | null;
  available: boolean; // false: the owner cannot bring it for now
}
export interface GameView {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  min_players: number;
  max_players: number;
  duration_min: number;
  types: GameType[];
  complexity: Complexity | null;
  min_age: number | null;
  description: string | null;
  bgg_id: number | null;
  rules_video_url: string | null;
  created_at: string;
  copies: CopyView[]; // active copies only
}
// At least one owner can bring it. Games with no copy at all count as unavailable.
export const isAvailable = (g: Pick<GameView, "copies">) => g.copies.some((c) => c.available);

export const VOTE_BUDGET_MIN = 1;
export const VOTE_BUDGET_MAX = 20;
export interface Encounter {
  id: string;
  starts_at: string;
  place: string;
  host_id: string | null;
  voting_deadline: string;
  status: "open" | "closed";
  closed_at: string | null;
}
export interface TallyRow {
  votes: number;
  voterIds: string[];
}
export interface VoteContext {
  encounter: Encounter | null; // the encounter open for voting, if any
  tally: Record<string, TallyRow>;
  myVotes: string[]; // game ids the viewer starred for the open encounter
  budget: number;
  anonymous: boolean;
}

export const TYPES: [GameType, string][] = [
  ["party", "Party"],
  ["family", "Family"],
  ["expert", "Expert"],
  ["small", "Small"],
  ["coop", "Cooperative"],
  ["two", "Two-player"],
];
export const TYPE_LABEL = Object.fromEntries(TYPES) as Record<GameType, string>;

export const LANGS: [Lang, string][] = [
  ["LI", "Language-independent"],
  ["FR", "French"],
  ["EN", "English"],
  ["DE", "German"],
  ["IT", "Italian"],
];
export const LANG_LABEL = Object.fromEntries(LANGS) as Record<Lang, string>;

export const COMPLEXITY: [Complexity, string, number][] = [
  ["light", "Light", 1],
  ["medium", "Medium", 2],
  ["heavy", "Heavy", 3],
];
export const COMPLEXITY_LABEL = Object.fromEntries(COMPLEXITY.map(([k, l]) => [k, l])) as Record<Complexity, string>;

export const DURATIONS: [string, string, (d: number) => boolean][] = [
  ["lt30", "Under 30 min", (d) => d < 30],
  ["30-60", "30 to 60 min", (d) => d >= 30 && d <= 60],
  ["60-120", "1 to 2 h", (d) => d > 60 && d <= 120],
  ["gt120", "Over 2 h", (d) => d > 120],
];

export const THEMES: [Theme, string, string][] = [
  ["a", "Cozy evening", "Plum night, candy accents"],
  ["b", "Game table", "Green felt, cards like box lids"],
  ["c", "Fun fair daylight", "Light pink, plum ink"],
];
export const isTheme = (v: unknown): v is Theme => v === "a" || v === "b" || v === "c";

// All dates are shown in the group's time zone, wherever the server runs.
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "Europe/Zurich";

export const players = (g: Pick<GameView, "min_players" | "max_players">) =>
  g.min_players === g.max_players ? `${g.min_players}` : `${g.min_players}-${g.max_players}`;
export const playersLong = (g: Pick<GameView, "min_players" | "max_players">) =>
  g.min_players === g.max_players ? `${g.min_players} players` : `${g.min_players} to ${g.max_players} players`;
export function duration(d: number) {
  if (d < 90) return `${d} min`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: TIME_ZONE, ...opts });
export const fmtDay = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
export const fmtFull = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtTime = (iso: string) => fmt(iso, { hour: "2-digit", minute: "2-digit" });
export const fmtStamp = (iso: string) => ({
  day: fmt(iso, { day: "numeric" }),
  month: fmt(iso, { month: "short" }),
  year: fmt(iso, { year: "numeric" }),
});

export function closesIn(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "closed";
  const days = Math.round(ms / 86400000);
  if (days < 1) {
    const h = Math.max(1, Math.round(ms / 3600000));
    return `in ${h} hour${h > 1 ? "s" : ""}`;
  }
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
