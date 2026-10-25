"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Mascot } from "@/components/Mascot";

interface UIContext {
  toast: (message: string) => void;
  nudge: (kind: "heart" | "star") => void;
}
const Ctx = createContext<UIContext>({ toast: () => {}, nudge: () => {} });
export const useUI = () => useContext(Ctx);

// Toasts and the "log in first" dialog, shared by every page.
export function UIProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [nudgeKind, setNudgeKind] = useState<"heart" | "star" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);
  const nudge = useCallback((kind: "heart" | "star") => {
    returnFocus.current = document.activeElement as HTMLElement;
    setNudgeKind(kind);
  }, []);
  const close = useCallback(() => {
    setNudgeKind(null);
    returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (!nudgeKind) return;
    dialogRef.current?.querySelector<HTMLElement>(".btn")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nudgeKind, close]);

  return (
    <Ctx.Provider value={{ toast, nudge }}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!message}>
        {message}
      </div>
      {nudgeKind && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog surface" role="dialog" aria-modal="true" aria-labelledby="nudge-title" ref={dialogRef}>
            <button className="iconbtn close" onClick={close} aria-label="Close">
              <Icon name="x" />
            </button>
            <div className="empty">
              <Mascot mood="happy" size={110} />
              <h2 id="nudge-title">{nudgeKind === "heart" ? "Log in to keep favorites" : "Log in to vote"}</h2>
              <p className="muted">
                An account keeps it to one person, one vote, and keeps your favorites on every device. It takes one
                email, no password.
              </p>
              <Link className="btn pink" href="/login" onClick={() => setNudgeKind(null)}>
                Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
