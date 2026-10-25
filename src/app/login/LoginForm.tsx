"use client";

import { useActionState, useState } from "react";
import { requestLoginLink, type LoginState } from "@/app/login/actions";
import { Icon } from "@/components/Icons";
import { Mascot } from "@/components/Mascot";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLoginLink, { status: "idle" });
  const [again, setAgain] = useState(false);
  const [firstTime, setFirstTime] = useState(false);
  const showSignup = firstTime || state.needsSignup;

  if (state.status === "sent" && !again) {
    return (
      <div className="panels" style={{ maxWidth: 520, margin: "24px auto 0" }}>
        <div className="surface panel" style={{ textAlign: "center", justifyItems: "center" }}>
          <Mascot mood="cheer" size={110} />
          <h1>Check your inbox</h1>
          <p>
            We sent a login link to <b>{state.email}</b>. Open it and you are in. The link works once, for one hour.
          </p>
          <p className="hint">Nothing after a few minutes? Check your spam folder, or send a new link.</p>
          <button className="linkbtn muted" onClick={() => setAgain(true)}>
            Use another email or send again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panels two" style={{ marginTop: 24, alignItems: "center" }}>
      <div className="empty" style={{ padding: 0 }}>
        <Mascot mood="happy" size={150} />
        <h1>Pull up a chair</h1>
        <p className="pmuted">An account lets you heart games and vote for the next afternoon. Browsing the shelf works without one.</p>
      </div>
      <form className="surface panel form" action={(fd) => { setAgain(false); return action(fd); }} noValidate>
        <h2>Log in or join</h2>
        <p className="hint">No password: we email you a link, and this browser stays logged in for weeks.</p>
        {linkError && !state.message && <p className="err" role="alert">That login link has expired or was already used. Ask for a new one below.</p>}
        <label className="lab" htmlFor="lg-email">
          Email
          <input className="inp" id="lg-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={state.fields?.email} required />
        </label>
        {showSignup ? (
          <>
            <label className="lab" htmlFor="lg-name">
              Display name
              <input className="inp" id="lg-name" name="name" autoComplete="nickname" placeholder="How the group knows you" defaultValue={state.fields?.name} maxLength={40} />
              <span className="hint">If an admin already put games under your name, use the same name to get them.</span>
            </label>
            <label className="lab" htmlFor="lg-code">
              Invite code
              <input className="inp" id="lg-code" name="code" autoComplete="off" placeholder="From the group chat" />
            </label>
          </>
        ) : (
          <button type="button" className="linkbtn" style={{ justifySelf: "start", color: "var(--card-muted)" }} onClick={() => setFirstTime(true)}>
            First time here? Add your name and invite code
          </button>
        )}
        {state.status === "error" && (
          <p className="err" role="alert">
            {state.message}
          </p>
        )}
        <button className="btn pink" type="submit" disabled={pending}>
          <Icon name="key" />
          {pending ? "Sending…" : "Email me a login link"}
        </button>
      </form>
    </div>
  );
}
