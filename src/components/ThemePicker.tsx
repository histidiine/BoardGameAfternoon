"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setTheme } from "@/app/actions";
import { Icon } from "@/components/Icons";
import { useUI } from "@/components/UI";
import { THEMES, type Theme } from "@/lib/domain";

// The three theme presets. Each option renders in its own theme so you see what you pick.
export function ThemeOptions({ current, onPicked }: { current: Theme; onPicked?: () => void }) {
  const ui = useUI();
  const [picked, setPicked] = useState(current);
  const [, startTransition] = useTransition();
  useEffect(() => setPicked(current), [current]);

  function pick(t: Theme) {
    setPicked(t);
    document.documentElement.dataset.skin = t;
    startTransition(async () => {
      const res = await setTheme(t);
      ui.toast(res.ok ? `Theme: ${THEMES.find((x) => x[0] === t)![1]}` : res.error);
      onPicked?.();
    });
  }

  return (
    <>
      {THEMES.map(([k, name, desc], i) => (
        <button key={k} type="button" className="skinopt" data-skin={k} aria-pressed={picked === k} onClick={() => pick(k)}>
          <span className="mini">
            <i style={{ background: "var(--heart)" }} />
            <i style={{ background: "var(--star)" }} />
            <i style={{ background: "var(--tag)" }} />
            <span style={{ fontSize: 14 }}>Aa</span>
          </span>
          <span>
            <strong>
              {String.fromCharCode(65 + i)}. {name}
            </strong>
            <br />
            <small>{desc}</small>
          </span>
        </button>
      ))}
    </>
  );
}

export function ThemeMenu({ current }: { current: Theme }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  return (
    <>
      <button ref={btn} className="iconbtn" aria-expanded={open} aria-controls="skinPop" aria-label="Change theme" onClick={() => setOpen(!open)}>
        <Icon name="palette" />
      </button>
      <div className="surface skinpop" id="skinPop" ref={pop} hidden={!open}>
        <b style={{ fontFamily: "var(--title-font)" }}>Theme</b>
        <ThemeOptions current={current} />
      </div>
    </>
  );
}
