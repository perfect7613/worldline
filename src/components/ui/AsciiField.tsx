/** Original, deterministic ASCII landscape: no canvas, animation loop, or external asset. */
export function AsciiField() {
  const rows = Array.from({ length: 26 }, (_, y) => Array.from({ length: 54 }, (_, x) => {
    const distance = Math.hypot((x - 27) * .75, y - 13);
    if (distance < 7) return " ";
    return ((x * 17 + y * 7) % 19 === 0) ? "+" : distance > 18 ? "." : ((x + y) % 4 === 0 ? ":" : " ");
  }).join("")).join("\n");
  return <pre className="entry-ascii-field" aria-hidden="true">{rows}</pre>;
}
