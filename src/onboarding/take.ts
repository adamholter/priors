/**
 * Where your ranking parts from the baseline order (the benchmark consensus, or your last index): a different
 * #1, then the model you rate furthest above it. People share what says something about them, and a
 * disagreement is what gets replies; agreement is still worth a line.
 */
export function takeOn(mine: string[], baseline: string[], name: (id: string) => string, label: string) {
  const base = baseline.filter((id) => mine.includes(id));
  if (base.length < 3) return { lines: [] as string[], hook: "" };
  const at = new Map(base.map((id, i) => [id, i]));
  const lines: string[] = [];
  let hook = "";
  if (mine[0] !== base[0]) { lines.push(`Your #1 is ${name(mine[0])}. ${cap(label)} picks ${name(base[0])}.`); hook = `${cap(label)} picks ${name(base[0])}.`; }
  let rise: { id: string; by: number } | null = null;
  mine.slice(0, 8).forEach((id, i) => { const by = (at.get(id) ?? i) - i; if (by >= 2 && (!rise || by > rise.by)) rise = { id, by }; });
  const r = rise as { id: string; by: number } | null;
  if (r && r.id !== mine[0]) lines.push(`You rank ${name(r.id)} ${r.by} places higher than ${label} does.`);
  if (!lines.length) { let k = 0; while (k < base.length && mine[k] === base[k]) k++; lines.push(k >= 3 ? `Your top ${k} match ${label} exactly.` : `You agree with ${label} on the #1.`); }
  return { lines, hook };
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
