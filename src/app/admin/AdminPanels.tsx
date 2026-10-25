"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyImport, closeVoting, createEncounter, mergeMembers, previewImport, removeMemberCopies, setAnonymousVotes, setPlayed, setRole, type PreviewResult } from "@/app/admin/actions";
import type { ActionResult } from "@/app/actions";
import { Avatar } from "@/components/Bits";
import { Icon } from "@/components/Icons";
import { useUI } from "@/components/UI";
import type { Encounter, MemberLite, Role } from "@/lib/domain";
import { closesIn, fmtDay, fmtFull, fmtTime, plural } from "@/lib/domain";
import { nameKey, TEMPLATE_COLUMNS } from "@/lib/import";

/* ---------- import ---------- */
const EXAMPLE = ["Azul", "Aurélie", "2", "4", "45", "Family; Small", "Light", "8", "Language-independent", "", "230802", "Draft colorful tiles...", "sleeved"];

export function ImportPanel() {
  const ui = useUI();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => setPreview(await previewImport(fd)));
  }
  function apply() {
    if (!preview?.ok) return;
    start(async () => {
      const res = await applyImport(preview.rows);
      if (!res.ok) return ui.toast(res.error);
      const s = res.summary;
      ui.toast(`Imported: ${plural(s.new_games.length, "new game")}, ${s.updated_games.length} updated, ${plural(s.new_copies, "new copy", "new copies")}.`);
      setPreview(null);
    });
  }
  async function copyHeader() {
    try {
      await navigator.clipboard.writeText(TEMPLATE_COLUMNS.join("\t"));
      setCopied(true);
    } catch {
      ui.toast("Copying is blocked here. Type the column names from the table instead.");
    }
  }

  return (
    <div className="surface panel">
      <h2>Load games from Excel</h2>
      <p className="hint">One row per copy. If two friends own Azul, it appears twice with different owners; the import merges them into one game. Importing again updates games and adds copies, and never removes favorites or votes.</p>
      <label className="btn mint" style={{ justifySelf: "start" }}>
        <Icon name="upload" /> {pending ? "Reading…" : "Choose an .xlsx or .csv file"}
        <input type="file" accept=".xlsx,.csv" className="sr" onChange={onFile} disabled={pending} />
      </label>
      {preview && !preview.ok && <p className="err" role="alert">{preview.error}</p>}
      {preview?.ok && (
        <div className="importsum" role="status">
          <b>{preview.file}: {plural(preview.rows.length, "row")} ready</b>
          <span>
            {plural(preview.summary.new_games.length, "new game")}, {preview.summary.updated_games.length} updated, {plural(preview.summary.new_copies, "new copy", "new copies")}
            {preview.summary.new_members.length ? `, new owners: ${preview.summary.new_members.join(", ")}` : ""}.
          </span>
          {preview.summary.new_games.length > 0 && <span className="hint">New: {preview.summary.new_games.join(", ")}</span>}
          {preview.errors.length > 0 && (
            <>
              <span className="err">{plural(preview.errors.length, "row")} will be skipped:</span>
              <ul>{preview.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
          {preview.warnings.length > 0 && (
            <>
              <b>Check:</b>
              <ul>{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {preview.rows.length > 0 && <button className="btn pink" onClick={apply} disabled={pending}>Import into the shelf</button>}
            <button className="btn ghost" onClick={() => setPreview(null)} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}
      <details>
        <summary><b>Template columns</b></summary>
        <div className="tbl-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Column</th><th>Example</th><th>Required</th></tr></thead>
            <tbody>
              {TEMPLATE_COLUMNS.map((c, i) => (
                <tr key={c}><td><b>{c}</b></td><td>{EXAMPLE[i]}</td><td>{i < 6 ? "yes" : "no"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Types: Party, Family, Expert, Small, Cooperative, Two-player (several separated by ;). Language: FR, EN, DE, IT or Language-independent.</p>
        <p style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={copyHeader}>Copy header row</button>
          <span className="hint">{copied ? "Copied. Paste it into cell A1 of a new sheet." : "Paste it into the first row of a new sheet."}</span>
        </p>
      </details>
    </div>
  );
}

/* ---------- next afternoon ---------- */
function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EncounterPanel({ open, members, me }: { open: Encounter | null; members: MemberLite[]; me: string }) {
  const ui = useUI();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [state, action, creating] = useActionState<ActionResult | null, FormData>(createEncounter, null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [deadline, setDeadline] = useState("");
  useEffect(() => setDate(nextSaturday()), []);
  useEffect(() => {
    if (state?.ok) ui.toast("Voting is open.");
  }, [state, ui]);

  // The admin's browser turns the local date and time into an exact moment.
  const startsIso = useMemo(() => (date && time ? new Date(`${date}T${time}`).toISOString() : ""), [date, time]);
  const deadlineIso = useMemo(() => (deadline ? new Date(deadline).toISOString() : ""), [deadline]);

  if (open) {
    return (
      <div className="surface panel">
        <h2>Next afternoon</h2>
        <p>
          <b>{fmtFull(open.starts_at)}</b> at {fmtTime(open.starts_at)}, {open.place}. Voting closes {closesIn(open.voting_deadline)} ({fmtDay(open.voting_deadline)}, {fmtTime(open.voting_deadline)}).
        </p>
        {asking ? (
          <>
            <p className="err">Close voting for {fmtDay(open.starts_at)}? Stars freeze and the page moves to Past tables.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="btn pink"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await closeVoting(open.id);
                    ui.toast(res.ok ? "Voting closed. The ranking is now in Past tables." : res.error);
                    setAsking(false);
                  })
                }
              >
                Close voting
              </button>
              <button className="btn ghost" onClick={() => setAsking(false)}>Keep it open</button>
            </div>
          </>
        ) : (
          <div><button className="btn" onClick={() => setAsking(true)}>Close voting now</button></div>
        )}
        <p className="hint">Only one afternoon can be open at a time. Voting also closes by itself at the deadline.</p>
      </div>
    );
  }

  return (
    <form className="surface panel form" action={action}>
      <h2>Plan the next afternoon</h2>
      <div className="row2">
        <label className="lab" htmlFor="en-date">Date<input className="inp" id="en-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="lab" htmlFor="en-time">Start time<input className="inp" id="en-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
      </div>
      <label className="lab" htmlFor="en-place">Place<input className="inp" id="en-place" name="place" placeholder="Whose place, or where" maxLength={120} required /></label>
      <label className="lab" htmlFor="en-host">
        Host
        <select className="inp" id="en-host" name="host" defaultValue={me}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>
      </label>
      <label className="lab" htmlFor="en-dl">
        Voting closes
        <input className="inp" id="en-dl" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <span className="hint">Leave empty to close at the start of the afternoon. Closing the evening before tells owners what to bring.</span>
      </label>
      <input type="hidden" name="starts_at" value={startsIso} />
      <input type="hidden" name="voting_deadline" value={deadlineIso} />
      {state && !state.ok && <p className="err" role="alert">{state.error}</p>}
      <button className="btn pink" type="submit" disabled={creating} style={{ justifySelf: "start" }}>Open voting</button>
    </form>
  );
}

/* ---------- what did we play ---------- */
export function PlayedPanel({ encounters, candidates, others, played }: {
  encounters: Encounter[];
  candidates: Record<string, { id: string; name: string }[]>; // per encounter: games with votes
  others: { id: string; name: string }[];
  played: Record<string, string[]>;
}) {
  const ui = useUI();
  const router = useRouter();
  const [sel, setSel] = useState(encounters[0]?.id ?? "");
  const [pending, start] = useTransition();
  if (!encounters.length) {
    return <div className="surface panel"><h2>What did we play?</h2><p className="muted">No past afternoons yet.</p></div>;
  }
  const playedHere = played[sel] ?? [];
  const list = [...(candidates[sel] ?? []), ...others.filter((g) => playedHere.includes(g.id) && !(candidates[sel] ?? []).some((c) => c.id === g.id))];
  const toggle = (gameId: string, on: boolean) =>
    start(async () => {
      const res = await setPlayed(sel, gameId, on);
      if (!res.ok) ui.toast(res.error);
      router.refresh();
    });

  return (
    <div className="surface panel">
      <h2>What did we play?</h2>
      <label className="lab" htmlFor="pl-enc">
        Afternoon
        <select className="inp" id="pl-enc" value={sel} onChange={(e) => setSel(e.target.value)}>
          {encounters.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.starts_at)} {new Date(e.starts_at).getFullYear()}, {e.place}</option>)}
        </select>
      </label>
      <div style={{ display: "grid", gap: 8 }}>
        {list.length ? list.map((g) => (
          <label className="check" key={g.id}>
            <input type="checkbox" checked={playedHere.includes(g.id)} disabled={pending} onChange={(e) => toggle(g.id, e.target.checked)} /> {g.name}
          </label>
        )) : <p className="muted">No votes for this afternoon.</p>}
      </div>
      <label className="lab" htmlFor="pl-add">
        Add another game
        <select className="inp" id="pl-add" value="" disabled={pending} onChange={(e) => e.target.value && toggle(e.target.value, true)}>
          <option value="">Choose a game</option>
          {others.filter((g) => !list.some((x) => x.id === g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
    </div>
  );
}

/* ---------- members ---------- */
export interface AdminMember extends MemberLite {
  role: Role;
  email: string | null;
  has_account: boolean;
  copies: number;
}

export function MembersPanel({ members, anonymous, me }: { members: AdminMember[]; anonymous: boolean; me: string }) {
  const ui = useUI();
  const [pending, start] = useTransition();
  return (
    <div className="surface panel">
      <h2>Members</h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Games</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td><Avatar member={m} /> {m.display_name}</td>
                <td>{m.email ?? <span className="muted">no account yet</span>}</td>
                <td>
                  <select
                    className="inp"
                    style={{ height: 34, width: "auto" }}
                    aria-label={`Role of ${m.display_name}`}
                    defaultValue={m.role}
                    disabled={pending || !m.has_account}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      start(async () => {
                        const res = await setRole(m.id, role);
                        ui.toast(res.ok ? `${m.display_name} is now ${role === "admin" ? "an admin" : "a member"}.` : res.error);
                        if (!res.ok) e.target.value = m.role;
                      });
                    }}
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  {m.id === me && <span className="hint"> (you)</span>}
                </td>
                <td className="num">{m.copies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Owners from the Excel file appear here before they sign up. When they join with the same display name, their games become theirs.</p>
      <label className="check">
        <input
          type="checkbox"
          defaultChecked={anonymous}
          disabled={pending}
          onChange={(e) => {
            const on = e.target.checked;
            start(async () => {
              const res = await setAnonymousVotes(on);
              ui.toast(res.ok ? (on ? "Voter names hidden." : "Voter names shown.") : res.error);
            });
          }}
        />{" "}
        Hide voter names, show counts only
      </label>
    </div>
  );
}

/* ---------- fix members and games ---------- */
// For one person entered twice ("Aurélie" and "Aurelie") and for a wrong import.
export function FixMembersPanel({ members }: { members: AdminMember[] }) {
  const ui = useUI();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mergeAsk, setMergeAsk] = useState<{ from: AdminMember[]; into: AdminMember } | null>(null);
  const [removeAsk, setRemoveAsk] = useState<AdminMember | null>(null);
  const [fromId, setFromId] = useState("");
  const [intoId, setIntoId] = useState("");
  const [removeId, setRemoveId] = useState("");

  // Members whose names differ only by accents, capitals, spaces or punctuation.
  const groups = useMemo(() => {
    const byKey = new Map<string, AdminMember[]>();
    for (const m of members) byKey.set(nameKey(m.display_name), [...(byKey.get(nameKey(m.display_name)) ?? []), m]);
    return [...byKey.values()].filter((g) => g.length > 1);
  }, [members]);
  const byId = (id: string) => members.find((m) => m.id === id);
  const label = (m: AdminMember) => `${m.display_name} (${plural(m.copies, "game")}${m.has_account ? ", has an account" : ""})`;
  const names = (list: AdminMember[]) => list.map((m) => m.display_name).join(" and ");

  function askMerge(from: AdminMember[], into: AdminMember) {
    setRemoveAsk(null);
    setMergeAsk({ from, into });
  }
  function merge() {
    if (!mergeAsk) return;
    const { from, into } = mergeAsk;
    start(async () => {
      const done: AdminMember[] = [];
      for (const f of from) {
        const res = await mergeMembers(f.id, into.id);
        if (!res.ok) {
          ui.toast(res.error);
          break;
        }
        done.push(f);
      }
      if (done.length) ui.toast(`${names(done)} merged into ${into.display_name}.`);
      setMergeAsk(null);
      setFromId("");
      setIntoId("");
      router.refresh();
    });
  }
  function remove() {
    if (!removeAsk) return;
    const m = removeAsk;
    start(async () => {
      const res = await removeMemberCopies(m.id);
      ui.toast(res.ok ? `${plural(res.removed, "game")} of ${m.display_name} taken off the shelf.` : res.error);
      setRemoveAsk(null);
      setRemoveId("");
      router.refresh();
    });
  }

  return (
    <div className="surface panel">
      <h2>Fix members and games</h2>

      {groups.map((g) => (
        <div key={g.map((m) => m.id).join()} style={{ display: "grid", gap: 8, padding: 12, border: "2px dashed var(--card-heart)", borderRadius: 12 }}>
          <p>
            {g.map((m, i) => <span key={m.id}>{i ? (i === g.length - 1 ? " and " : ", ") : ""}<b>{m.display_name}</b></span>)} look like the same person. Which one do you keep?
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {g.map((keep) => (
              <button key={keep.id} className="btn" disabled={pending} onClick={() => askMerge(g.filter((m) => m !== keep), keep)}>
                Keep {keep.display_name}
              </button>
            ))}
          </div>
          {g.filter((m) => m.has_account).length === 1 && (
            <p className="hint">Keep the one you like best: the account of {g.find((m) => m.has_account)!.display_name} moves along.</p>
          )}
        </div>
      ))}

      <div className="form">
        <h3>Merge two members</h3>
        <p className="hint">For one person entered twice. Their games, favorites, stars and hosted afternoons move to the member you keep, games they both own become one copy, and the other member is removed.</p>
        <div className="row2">
          <label className="lab" htmlFor="mg-from">
            Remove
            <select className="inp" id="mg-from" value={fromId} onChange={(e) => setFromId(e.target.value)} disabled={pending}>
              <option value="">Choose a member</option>
              {members.map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}
            </select>
          </label>
          <label className="lab" htmlFor="mg-into">
            Keep
            <select className="inp" id="mg-into" value={intoId} onChange={(e) => setIntoId(e.target.value)} disabled={pending}>
              <option value="">Choose a member</option>
              {members.map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}
            </select>
          </label>
        </div>
        <div>
          <button
            className="btn ghost"
            disabled={pending}
            onClick={() => {
              const f = byId(fromId), k = byId(intoId);
              if (!f || !k || f === k) return ui.toast("Pick two different members.");
              askMerge([f], k);
            }}
          >
            Merge
          </button>
        </div>
      </div>

      {mergeAsk && (
        <div style={{ display: "grid", gap: 8 }} role="alertdialog" aria-label="Confirm merge">
          <p className="err">
            Merge {names(mergeAsk.from)} into {mergeAsk.into.display_name}? Their {plural(mergeAsk.from.reduce((n, m) => n + m.copies, 0), "game")}, favorites and stars move to {mergeAsk.into.display_name}, then {names(mergeAsk.from)} {mergeAsk.from.length > 1 ? "are" : "is"} removed. This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn pink" onClick={merge} disabled={pending} autoFocus>{pending ? "Merging…" : "Merge"}</button>
            <button className="btn ghost" onClick={() => setMergeAsk(null)} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}

      <div className="form">
        <h3>Take a member&apos;s games off the shelf</h3>
        <p className="hint">For a wrong import. Every copy of this member is removed from the shelf; a game disappears when nobody else owns it. Favorites and past votes stay, and importing the file again brings the games back.</p>
        <label className="lab" htmlFor="rm-who">
          Member
          <select className="inp" id="rm-who" value={removeId} onChange={(e) => setRemoveId(e.target.value)} disabled={pending}>
            <option value="">Choose a member</option>
            {members.filter((m) => m.copies > 0).map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}
          </select>
        </label>
        <div>
          <button
            className="btn ghost"
            disabled={pending}
            onClick={() => {
              const m = byId(removeId);
              if (!m) return ui.toast("Choose a member first.");
              setMergeAsk(null);
              setRemoveAsk(m);
            }}
          >
            Remove their games
          </button>
        </div>
      </div>

      {removeAsk && (
        <div style={{ display: "grid", gap: 8 }} role="alertdialog" aria-label="Confirm removal">
          <p className="err">Take {removeAsk.display_name}&apos;s {plural(removeAsk.copies, "game")} off the shelf?</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn pink" onClick={remove} disabled={pending} autoFocus>{pending ? "Removing…" : "Remove their games"}</button>
            <button className="btn ghost" onClick={() => setRemoveAsk(null)} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
