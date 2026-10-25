// Pip, the group's mascot: a meeple with a face. Colors follow the active theme.
export type Mood = "happy" | "cheer" | "sleepy" | "confused";

const EYES: Record<Mood, string> = {
  happy: '<circle cx="10.8" cy="5" r=".55"/><circle cx="13.2" cy="5" r=".55"/>',
  cheer: '<path d="M10.2 5.2q.6-.9 1.2 0M12.6 5.2q.6-.9 1.2 0" fill="none"/>',
  sleepy: '<path d="M10.2 5q.6.6 1.2 0M12.6 5q.6.6 1.2 0" fill="none"/>',
  confused: '<circle cx="10.8" cy="5" r=".55"/><circle cx="13.2" cy="4.9" r=".8" fill="none"/>',
};
const MOUTH: Record<Mood, string> = {
  happy: '<path d="M10.9 6.4q1.1 1 2.2 0" fill="none"/>',
  cheer: '<path d="M10.8 6.2h2.4q-.2 1.5-1.2 1.5t-1.2-1.5z" class="m"/>',
  sleepy: '<path d="M11.4 6.7h1.2" fill="none"/>',
  confused: '<path d="M10.9 6.8q.4-.4.75 0t.75 0 .75 0" fill="none"/>',
};
const EXTRA: Record<Mood, string> = {
  happy:
    '<g transform="rotate(14 20.8 10.2)"><rect x="18.6" y="8" width="4.4" height="4.4" rx=".9" class="d"/><circle cx="19.7" cy="9.1" r=".38" class="p"/><circle cx="20.8" cy="10.2" r=".38" class="p"/><circle cx="21.9" cy="11.3" r=".38" class="p"/></g>',
  cheer:
    '<path d="M2.5 3.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5zM21.5 1.5l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" class="s"/><path d="M20 5.5l.3.7.7.3-.7.3-.3.7-.3-.7-.7-.3.7-.3z" class="s"/>',
  sleepy: '<text x="16" y="2.6" class="z">z</text><text x="18.2" y=".6" class="z" style="font-size:2.2px">z</text>',
  confused: '<text x="16.2" y="3" class="q">?</text>',
};

function svg(mood: Mood, size: number) {
  return `<svg class="mascot" width="${size}" height="${size}" viewBox="-1 -2.5 26 26" aria-hidden="true"><g class="bob"><path class="b" d="M9 8.6C6 8.8 2.6 9.6 2.6 11.4c0 1.4 2.6 2 5 2.2L5 20.2c-.3.9.3 1.6 1.2 1.6h3.4L12 17.8l2.4 4h3.4c.9 0 1.5-.7 1.2-1.6l-2.6-6.6c2.4-.2 5-.8 5-2.2 0-1.8-3.4-2.6-6.4-2.8z"/><circle class="b" cx="12" cy="5.4" r="3.6"/><circle class="ck" cx="9.9" cy="6.3" r=".6"/><circle class="ck" cx="14.1" cy="6.3" r=".6"/><g class="f">${EYES[mood]}${MOUTH[mood]}</g>${EXTRA[mood]}</g></svg>`;
}

export function Mascot({ mood = "happy", size = 120 }: { mood?: Mood; size?: number }) {
  return <span style={{ display: "inline-block", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg(mood, size) }} />;
}
