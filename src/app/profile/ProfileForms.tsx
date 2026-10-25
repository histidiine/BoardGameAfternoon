"use client";

import { useActionState, useEffect } from "react";
import { updateDisplayName, type ActionResult } from "@/app/actions";
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
