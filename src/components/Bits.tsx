import type { GameType, GameView, MemberLite } from "@/lib/domain";
import { COMPLEXITY, COMPLEXITY_LABEL, TYPE_LABEL } from "@/lib/domain";
import { Mascot, type Mood } from "@/components/Mascot";

export function Avatar({ member, large }: { member?: MemberLite | null; large?: boolean }) {
  if (!member) return null;
  return (
    <span
      className={`av${large ? " lg" : ""}`}
      style={{ ["--tc" as string]: `var(--tg-${member.color})` }}
      title={member.display_name}
    >
      {[...member.display_name][0]?.toUpperCase()}
    </span>
  );
}

export function Tag({ type }: { type: GameType }) {
  return (
    <span className="tag" style={{ ["--tc" as string]: `var(--tg-${type})` }}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

function hash(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Box-lid cover: the game's picture when the Excel file has one, else a patterned lid in its type color.
export function Cover({ game, size = "card" }: { game: Pick<GameView, "id" | "name" | "types" | "complexity" | "image_url">; size?: "card" | "big" | "mid" | "thumb" }) {
  const type = game.types[0] ?? "family";
  const level = COMPLEXITY.find((c) => c[0] === game.complexity)?.[2];
  const cls = size === "card" ? "" : size;
  const pips = { 1: [5], 2: [1, 9], 3: [1, 5, 9] }[level ?? 0] ?? [];
  return (
    <div
      className={`cover ${cls} pat${hash(game.id) % 4}${game.image_url ? " has-img" : ""}`}
      style={{ ["--cv" as string]: `var(--tg-${type})` }}
    >
      {game.image_url && <img src={game.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span className="mono">{game.name}</span>
      {level && size !== "thumb" && (
        <span className="die" title={`Complexity: ${COMPLEXITY_LABEL[game.complexity!]}`} aria-label={`Complexity: ${COMPLEXITY_LABEL[game.complexity!]}`}>
          {Array.from({ length: 9 }, (_, i) => (pips.includes(i + 1) ? <i key={i} /> : <span key={i} />))}
        </span>
      )}
    </div>
  );
}

export function EmptyState({ mood, title, children, action }: { mood: Mood; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Mascot mood={mood} size={128} />
      <h2>{title}</h2>
      <p className="pmuted">{children}</p>
      {action}
    </div>
  );
}
