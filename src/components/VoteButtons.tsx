"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { toggleFavorite, toggleVote } from "@/app/actions";
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
  on: boolean;
  count: number;
  budgetLeft: number;
  budget: number;
  loggedIn: boolean;
  big?: boolean;
  dayLabel?: string;
}

export function StarButton({ gameId, gameName, encounterId, on, count, budgetLeft, budget, loggedIn, big, dayLabel }: StarProps) {
  const ui = useUI();
  const ref = useRef<HTMLButtonElement>(null);
  const [state, setState] = useOptimistic({ on, count });
  const [, startTransition] = useTransition();

  function click() {
    if (!encounterId) return ui.toast("Voting is closed right now.");
    if (!loggedIn) return ui.nudge("star");
    const next = !state.on;
    if (next && budgetLeft <= 0) return ui.toast(`You have used your ${budget} stars. Remove one to star ${gameName}.`);
    pop(ref.current);
    if (next) confetti(ref.current);
    startTransition(async () => {
      setState({ on: next, count: state.count + (next ? 1 : -1) });
      const res = await toggleVote(encounterId, gameId, next);
      const left = budgetLeft + (next ? -1 : 1);
      ui.toast(res.ok ? (next ? `Starred ${gameName}. ${left} ${left === 1 ? "star" : "stars"} left.` : `Star removed. ${left} left.`) : res.error);
    });
  }

  const label = encounterId ? `Vote for ${gameName}, ${state.count} ${state.count === 1 ? "star" : "stars"}` : `Voting is closed for ${gameName}`;
  return (
    <button
      ref={ref}
      className={`hs star${state.on ? " on" : ""}${big ? " big" : ""}`}
      onClick={click}
      aria-pressed={state.on}
      aria-label={big ? undefined : label}
      disabled={!encounterId}
    >
      <Px name="star" on={state.on} />
      <span>
        {big
          ? state.on
            ? `Starred, ${state.count} total`
            : encounterId
              ? `Star for ${dayLabel ?? "the next table"}, ${state.count} so far`
              : "Voting is closed"
          : state.count}
      </span>
    </button>
  );
}
