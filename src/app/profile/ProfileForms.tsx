"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { updateDisplayName, updateMyCopy, type ActionResult } from "@/app/actions";
import { useUI } from "@/components/UI";

export function NameForm({ name, email }: { name: string; email: string | null }) {
  const ui = useUI();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateDisplayName, null);
  useEffect(() => {
    if (state?.ok) ui.toast("Name saved.");
  }, [state, ui]);
  return (
    <form className="surface panel form" action={action}>
      <h2>You</h2>
      <label className="lab" htmlFor="pf-name">
        Display name
        <input className="inp" id="pf-name" name="name" defaultValue={name} autoComplete="nickname" maxLength={40} required />
      </label>
      {email && (
        <label className="lab" htmlFor="pf-email">
          Email
          <input className="inp" id="pf-email" value={email} disabled />
          <span className="hint">Your login address.</span>
        </label>
      )}
      {state && !state.ok && (
        <p className="err" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
        Save name
      </button>
    </form>
  );
}

export interface MyGame {
  gameId: string;
  slug: string;
  name: string;
  available: boolean;
  notes: string | null;
  language: string | null;
  coOwners: number; // other members who own the same game
}

// One row per game I own: read view, and an edit form for the name, availability and comment.
export function MyGameRow({ game, cover, startOpen }: { game: MyGame; cover: React.ReactNode; startOpen: boolean }) {
  const ui = useUI();
  const [editing, setEditing] = useState(startOpen);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateMyCopy.bind(null, game.gameId), null);
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ui.toast(`${game.name} saved.`);
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useEffect(() => {
    if (editing && !startOpen) firstField.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  const id = `mg-${game.gameId}`;

  return (
    <li id={`game-${game.slug}`} style={{ alignItems: "flex-start", flexWrap: "wrap", scrollMarginTop: 80 }}>
      {cover}
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <Link href={`/games/${game.slug}`}>
          <b>{game.name}</b>
        </Link>
        <div className="hint">
          {game.available ? "Available" : <b style={{ color: "var(--card-heart)" }}>Not available right now</b>}
          {game.language ? ` · ${game.language}` : ""}
          {game.notes ? ` · ${game.notes}` : ""}
        </div>
      </div>
      {!editing && (
        <button type="button" className="btn ghost" style={{ padding: "6px 12px", fontSize: 14 }} onClick={() => setEditing(true)} aria-label={`Edit ${game.name}`}>
          Edit
        </button>
      )}
      {editing && (
        <form className="form" action={action} style={{ flexBasis: "100%", paddingTop: 4 }}>
          <label className="lab" htmlFor={`${id}-name`}>
            Game name
            <input ref={firstField} className="inp" id={`${id}-name`} name="name" defaultValue={game.name} maxLength={120} required />
            {game.coOwners > 0 && (
              <span className="hint">
                {game.coOwners === 1 ? "One other member owns" : `${game.coOwners} other members own`} this game too: the name changes for everyone.
              </span>
            )}
          </label>
          <label className="check">
            <input type="checkbox" name="available" defaultChecked={game.available} /> Available, I can bring it
          </label>
          <label className="lab" htmlFor={`${id}-notes`}>
            Comment
            <input className="inp" id={`${id}-notes`} name="notes" defaultValue={game.notes ?? ""} maxLength={200} placeholder="Lent to Marc until December, sleeved, one tile missing…" />
          </label>
          {state && !state.ok && (
            <p className="err" role="alert">
              {state.error}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button className="btn ghost" type="button" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
