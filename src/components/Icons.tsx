// Icon set: rounded outline icons, plus the pixel heart and star (the one pixel nod in the design).

const PX: Record<"heart" | "star", string[]> = {
  heart: [".XX...XX.", "XXXX.XXXX", "XXXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X...."],
  star: ["....X....", "...XXX...", "...XXX...", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "..XXXXX..", ".XX...XX.", "XX.....XX"],
};

// Filled cells, or only the border cells for the outline version.
function pxPath(rows: string[], outline: boolean) {
  const H = rows.length;
  const W = rows[0].length;
  const on = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && rows[y][x] === "X";
  let d = "";
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      if (outline && on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
      d += `M${x} ${y}h1v1h-1z`;
    }
  return d;
}

const PIXEL_SYMBOLS = (Object.keys(PX) as ("heart" | "star")[])
  .map((k) => {
    const r = PX[k];
    const vb = `0 0 ${r[0].length} ${r.length}`;
    return `<symbol id="px-${k}" viewBox="${vb}"><path d="${pxPath(r, false)}"/></symbol><symbol id="px-${k}-o" viewBox="${vb}"><path d="${pxPath(r, true)}"/></symbol>`;
  })
  .join("");

const SYMBOLS = `<symbol id="i-meeple" viewBox="0 0 24 24"><path d="M9 8.6C6 8.8 2.6 9.6 2.6 11.4c0 1.4 2.6 2 5 2.2L5 20.2c-.3.9.3 1.6 1.2 1.6h3.4L12 17.8l2.4 4h3.4c.9 0 1.5-.7 1.2-1.6l-2.6-6.6c2.4-.2 5-.8 5-2.2 0-1.8-3.4-2.6-6.4-2.8"/><circle cx="12" cy="5.4" r="3.2"/></symbol>
    <symbol id="i-hourglass" viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M7 3c0 5 5 6.2 5 9s-5 4-5 9M17 3c0 5-5 6.2-5 9s5 4 5 9"/><path d="M9.5 18.5h5"/></symbol>
    <symbol id="i-die" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></symbol>
    <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
    <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14c2 .7 3.5 3 3.5 6"/></symbol>
    <symbol id="i-shelf" viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="8" rx="1.5"/><rect x="12" y="7" width="9" height="5" rx="1.5"/><rect x="4" y="14" width="10" height="6" rx="1.5"/><rect x="16" y="14" width="5" height="6" rx="1.5"/></symbol>
    <symbol id="i-ticket" viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z"/><path d="M15 6v12" stroke-dasharray="2 2"/></symbol>
    <symbol id="i-palette" viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.8-1 1.3-2-.6-1.2.2-2.5 1.6-2.5h1.8a3.8 3.8 0 0 0 3.8-3.8C20.5 7.2 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.3" r="1.2" fill="currentColor"/><circle cx="15" cy="7.8" r="1.2" fill="currentColor"/></symbol>
    <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/></symbol>
    <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></symbol>
    <symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="14" r="4"/><path d="m11 11 8.5-8.5M16 6l2.5 2.5M14 8l2 2"/></symbol>`;

// Rendered once in the root layout; icons reference it with <use href="#...">.
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs dangerouslySetInnerHTML={{ __html: SYMBOLS + PIXEL_SYMBOLS }} />
    </svg>
  );
}

export type IconName =
  | "meeple" | "hourglass" | "die" | "search" | "sliders" | "x" | "check" | "cal" | "pin" | "home" | "clock"
  | "users" | "shelf" | "ticket" | "palette" | "user" | "upload" | "back" | "link" | "key";

export function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function Px({ name, on }: { name: "heart" | "star"; on: boolean }) {
  return (
    <svg className="px" aria-hidden="true">
      <use href={`#px-${name}${on ? "" : "-o"}`} />
    </svg>
  );
}
