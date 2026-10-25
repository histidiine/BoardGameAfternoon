"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Complexity, GameType, GameView, Lang, VoteContext } from "@/lib/domain";
import { COMPLEXITY, DURATIONS, LANGS, TYPES, normalize, plural } from "@/lib/domain";
import { EmptyState } from "@/components/Bits";
import { GameCard } from "@/components/GameCard";
import { Icon, Px } from "@/components/Icons";

type Sort = "name" | "duration" | "votes" | "recent";

interface Filters {
  q: string;
  players: string;
  dur: string[];
  types: GameType[];
  cplx: Complexity[];
  owner: string;
  lang: Lang | "";
  age: string;
  fav: boolean;
  voted: boolean;
  never: boolean;
  sort: Sort;
}
const EMPTY: Filters = { q: "", players: "", dur: [], types: [], cplx: [], owner: "", lang: "", age: "", fav: false, voted: false, never: false, sort: "name" };

export function Shelf({ mode, games, favorites, vote, played, loggedIn }: {
  mode: "shelf" | "favorites";
  games: GameView[];
  favorites: string[];
  vote: VoteContext;
  played: string[];
  loggedIn: boolean;
}) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 1000px)").matches) setOpen(true);
  }, []);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));
  // Every filter narrows the list (AND). Game types can be stacked ("Party" + "Cooperative"
  // shows games that are both). A game has one duration and one complexity, so those are
  // one choice at a time: tapping another chip replaces the previous one.
  const toggleIn = <K extends "dur" | "types" | "cplx">(k: K, v: Filters[K][number]) =>
    setF((p) => {
      const list = p[k] as string[];
      if (list.includes(v)) return { ...p, [k]: list.filter((x) => x !== v) };
      return { ...p, [k]: k === "types" ? [...list, v] : [v] };
    });

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const playedSet = useMemo(() => new Set(played), [played]);
  const owners = useMemo(
    () => [...new Map(games.flatMap((g) => g.copies.map((c) => [c.owner.id, c.owner] as const))).values()].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [games],
  );
  const votes = (id: string) => vote.tally[id]?.votes ?? 0;
  const n = parseInt(f.players, 10);

  const list = useMemo(() => {
    const q = normalize(f.q);
    const out = games.filter((g) => {
      if (q && !normalize(g.name).includes(q)) return false;
      if (n && !(g.min_players <= n && n <= g.max_players)) return false;
      if (f.dur.length && !DURATIONS.some(([k, , fn]) => f.dur.includes(k) && fn(g.duration_min))) return false;
      if (f.types.length && !f.types.every((t) => g.types.includes(t))) return false;
      if (f.cplx.length && !(g.complexity && f.cplx.includes(g.complexity))) return false;
      if (f.owner && !g.copies.some((c) => c.owner.id === f.owner)) return false;
      if (f.lang && !g.copies.some((c) => c.language === f.lang)) return false;
      if (f.age && !((g.min_age ?? 0) <= parseInt(f.age, 10))) return false;
      if ((mode === "favorites" || f.fav) && !favSet.has(g.id)) return false;
      if (f.voted && !votes(g.id)) return false;
      if (f.never && playedSet.has(g.id)) return false;
      return true;
    });
    const by: Record<Sort, (a: GameView, b: GameView) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      duration: (a, b) => a.duration_min - b.duration_min || a.name.localeCompare(b.name),
      votes: (a, b) => votes(b.id) - votes(a.id) || a.name.localeCompare(b.name),
      recent: (a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name),
    };
    return out.sort(by[f.sort] ?? by.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, f, n, mode, favSet, playedSet, vote]);

  const activeCount = f.dur.length + f.types.length + f.cplx.length + (f.owner ? 1 : 0) + (f.lang ? 1 : 0) + (f.age ? 1 : 0) + (f.fav && mode !== "favorites" ? 1 : 0) + (f.voted ? 1 : 0) + (f.never ? 1 : 0);
  const anyFilter = activeCount > 0 || !!f.q || !!f.players;
  const stepPlayers = (d: number) => {
    const cur = parseInt(f.players, 10) || 0;
    let next = cur + d;
    if (cur === 0 && d === 1) next = 2;
    set("players", next >= 1 ? String(Math.min(next, 30)) : "");
  };
  const chip = (pressed: boolean, onClick: () => void, children: React.ReactNode, color?: GameType) => (
    <button type="button" className={`chip${color ? " t" : ""}`} aria-pressed={pressed} onClick={onClick} style={color ? { ["--tc" as string]: `var(--tg-${color})` } : undefined}>
      {color && <span className="dot" />}
      {children}
    </button>
  );

  return (
    <>
      <div className="toolbar">
        <label className="field search">
          <Icon name="search" />
          <span className="sr">Search games by name</span>
          <input id="q" type="search" placeholder="Search a game" autoComplete="off" value={f.q} onChange={(e) => set("q", e.target.value)} />
        </label>
        <div className="field stepper" role="group" aria-labelledby="pl-l">
          <span id="pl-l">We will be</span>
          <button type="button" onClick={() => stepPlayers(-1)} aria-label="One player fewer">
            {"−"}
          </button>
          <input
            id="players"
            inputMode="numeric"
            maxLength={2}
            placeholder="any"
            aria-label="Number of players"
            value={f.players}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              set("players", v && parseInt(v, 10) > 0 ? v : "");
            }}
          />
          <button type="button" onClick={() => stepPlayers(1)} aria-label="One player more">
            +
          </button>
        </div>
        <label className="field sortf">
          <span>Sort</span>
          <select id="sort" value={f.sort} onChange={(e) => set("sort", e.target.value as Sort)}>
            <option value="name">Name</option>
            <option value="duration">Duration</option>
            {vote.encounter && <option value="votes">Most votes</option>}
            <option value="recent">Recently added</option>
          </select>
        </label>
        <button type="button" className="iconbtn" aria-expanded={open} aria-controls="fpanel" style={{ height: 44 }} onClick={() => setOpen(!open)}>
          <Icon name="sliders" />
          <span>Filters</span>
          {activeCount > 0 && <span className="badge">{activeCount}</span>}
        </button>
      </div>

      <div className="surface fpanel" id="fpanel" hidden={!open}>
        <div className="fgroup">
          <span className="lbl" id="lb-dur">Duration</span>
          <div className="chips" role="group" aria-labelledby="lb-dur">
            {DURATIONS.map(([k, l]) => <span key={k}>{chip(f.dur.includes(k), () => toggleIn("dur", k), l)}</span>)}
          </div>
        </div>
        <div className="fgroup">
          <span className="lbl" id="lb-type">Game type <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>(games with every type you pick)</span></span>
          <div className="chips" role="group" aria-labelledby="lb-type">
            {TYPES.map(([k, l]) => <span key={k}>{chip(f.types.includes(k), () => toggleIn("types", k), l, k)}</span>)}
          </div>
        </div>
        <div className="fgroup">
          <span className="lbl" id="lb-cx">Complexity</span>
          <div className="chips" role="group" aria-labelledby="lb-cx">
            {COMPLEXITY.map(([k, l]) => <span key={k}>{chip(f.cplx.includes(k), () => toggleIn("cplx", k), l)}</span>)}
          </div>
        </div>
        <div className="selrow">
          <label className="sel">
            Owner
            <select id="f-owner" value={f.owner} onChange={(e) => set("owner", e.target.value)}>
              <option value="">Anyone</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="sel">
            Language
            <select id="f-lang" value={f.lang} onChange={(e) => set("lang", e.target.value as Lang | "")}>
              <option value="">Any language</option>
              {LANGS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="sel">
            Youngest player
            <select id="f-age" value={f.age} onChange={(e) => set("age", e.target.value)}>
              <option value="">Any age</option>
              {[6, 8, 10, 12, 14].map((a) => (
                <option key={a} value={a}>
                  {a} years old
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row-end">
          <div className="chips" role="group" aria-label="Show only">
            {loggedIn && mode !== "favorites" && chip(f.fav, () => set("fav", !f.fav), <><Px name="heart" on /> Only my favorites</>)}
            {vote.encounter && chip(f.voted, () => set("voted", !f.voted), <><Px name="star" on /> Only games with votes</>)}
            {chip(f.never, () => set("never", !f.never), "Never played by the group")}
          </div>
          <button type="button" className="linkbtn" style={{ color: "var(--card-muted)" }} onClick={() => setF((p) => ({ ...EMPTY, q: p.q, players: p.players, sort: p.sort }))}>
            Clear all filters
          </button>
        </div>
      </div>

      <p className="count" aria-live="polite">
        {plural(list.length, "game")}
        {n ? ` that work for ${plural(n, "player")}` : ""}
      </p>

      {list.length ? (
        <div className="grid">
          {list.map((g) => (
            <GameCard key={g.id} game={g} fav={favSet.has(g.id)} vote={vote} loggedIn={loggedIn} />
          ))}
        </div>
      ) : mode === "favorites" && !anyFilter ? (
        <EmptyState mood="sleepy" title="No favorites yet" action={<Link className="btn" href="/">Browse the shelf</Link>}>
          Tap the heart on any game and it will wait for you here.
        </EmptyState>
      ) : (
        <EmptyState mood="confused" title="No game fits all of that" action={<button className="btn" onClick={() => setF((p) => ({ ...EMPTY, sort: p.sort }))}>Clear search and filters</button>}>
          {`Try fewer filters${n ? " or another number of players" : ""}.`}
        </EmptyState>
      )}
    </>
  );
}
