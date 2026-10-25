"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { setStars, toggleFavorite } from "@/app/actions";
import { MAX_STARS_PER_GAME } from "@/lib/domain";
import { Px } from "@/components/Icons";
import { useUI } from "@/components/UI";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pop(el: HTMLElement | null) {
  if (!el || reduceMotion()) return;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  setTimeout(() => el.classList.remove("pop"), 450);
}

function confetti(el: HTMLElement | null) {
  if (!el || reduceMotion()) return;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const colors = ["var(--star)", "var(--heart)", "var(--tag)", "var(--tg-expert)"];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "cf";
    const a = Math.random() * Math.PI * 2;
    const d = 34 + Math.random() * 46;
    s.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 24}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

export function HeartButton({ gameId, gameName, on, loggedIn, big }: { gameId: string; gameName: string; on: boolean; loggedIn: boolean; big?: boolean }) {
  const ui = useUI();
  const ref = useRef<HTMLButtonElement>(null);
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [, startTransition] = useTransition();

  function click() {
    if (!loggedIn) return ui.nudge("heart");
    const next = !optimistic;
    pop(ref.current);
    startTransition(async () => {
      setOptimistic(next);
      const res = await toggleFavorite(gameId, next);
      ui.toast(res.ok ? (next ? `${gameName} is in your favorites` : `Removed ${gameName} from your favorites`) : res.error);
    });
  }

  return (
    <button ref={ref} className={`hs heart${optimistic ? " on" : ""}${big ? " big" : ""}`} onClick={click} aria-pressed={optimistic} aria-label={big ? undefined : `Favorite: ${gameName}`}>
      <Px name="heart" on={optimistic} />
      {big && <span>{optimistic ? "In my favorites" : "Add to favorites"}</span>}
    </button>
  );
}

export interface StarProps {
  gameId: string;
  gameName: string;
  encounterId: string | null; // null when no encounter is open for voting
  mine: number; // stars the viewer gave this game: 0, 1 or 2
  count: number; // total stars of the game
  budgetLeft: number;
  budget: number;
  loggedIn: boolean;
  big?: boolean;
  dayLabel?: string;
}

const starWord = (n: number) => `${n} ${n === 1 ? "star" : "stars"}`;

// Each tap goes 0 -> 1 -> 2 -> 0 stars. Without a star left for a second one, 1 -> 0.
export function StarButton({ gameId, gameName, encounterId, mine, count, budgetLeft, budget, loggedIn, big, dayLabel }: StarProps) {
  const ui = useUI();
  const ref = useRef<HTMLButtonElement>(null);
  const [state, setState] = useOptimistic({ mine, count });
  const [, startTransition] = useTransition();
  const left = budgetLeft - (state.mine - mine); // stars left, counting a tap still on its way

  function click() {
    if (!encounterId) return ui.toast("Voting is closed right now.");
    if (!loggedIn) return ui.nudge("star");
    const cur = state.mine;
    if (cur === 0 && left <= 0) return ui.toast(`You have used your ${budget} stars. Remove one to star ${gameName}.`);
    const next = cur === 0 ? 1 : cur < MAX_STARS_PER_GAME && left > 0 ? cur + 1 : 0;
    const leftAfter = Math.max(0, left - (next - cur));
    pop(ref.current);
    if (next > cur) confetti(ref.current);
    startTransition(async () => {
      setState({ mine: next, count: state.count + next - cur });
      const res = await setStars(encounterId, gameId, next);
      if (!res.ok) return ui.toast(res.error);
      ui.toast(
        next === 0
          ? cur === 1 && left <= 0
            ? `Star removed from ${gameName}. You had no star left for a second one. ${starWord(leftAfter)} left.`
            : `Stars removed from ${gameName}. ${starWord(leftAfter)} left.`
          : next === 1
            ? `Starred ${gameName}. ${starWord(leftAfter)} left.${leftAfter > 0 ? " Tap again to give it a second star." : ""}`
            : `${next} stars for ${gameName}. ${starWord(leftAfter)} left. Tap again to remove them.`,
      );
    });
  }

  const on = state.mine > 0;
  const label = encounterId
    ? `Stars for ${gameName}: ${state.count} in total${on ? `, ${state.mine} from you` : ""}. Each tap adds a star, up to ${MAX_STARS_PER_GAME}, then removes them.`
    : `Voting is closed for ${gameName}`;
  return (
    <button
      ref={ref}
      className={`hs star${on ? " on" : ""}${state.mine > 1 ? " two" : ""}${big ? " big" : ""}`}
      onClick={click}
      aria-pressed={on}
      aria-label={label}
      title={encounterId ? `${state.mine} of ${MAX_STARS_PER_GAME} stars from you` : undefined}
      disabled={!encounterId}
    >
      <Px name="star" on={on} />
      {state.mine > 1 && <Px name="star" on />}
      <span aria-hidden={!big || undefined}>
        {big
          ? on
            ? `${state.mine} from you, ${state.count} total${state.mine < MAX_STARS_PER_GAME ? ". Tap for one more" : ""}`
            : encounterId
              ? `Star for ${dayLabel ?? "the next table"}, ${state.count} so far`
              : "Voting is closed"
          : state.count}
      </span>
    </button>
  );
}
