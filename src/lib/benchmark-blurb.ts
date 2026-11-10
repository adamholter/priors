/**
 * A benchmark's description for a place that already shows its name (a tooltip, a key): the
 * "Name: " opening many descriptions carry is dropped, and `max` keeps whole sentences up to
 * about that many characters. The full description stays on the benchmark's own page.
 */
export function benchmarkBlurb(name: string, description: string | undefined, max?: number): string {
  let text = (description ?? "").trim();
  const lead = text.match(/^([^:]{2,60}):\s+(?=\S)/);
  // Only when the opening repeats the name ("AA-Briefcase: …" under "AA-Briefcase v1.1"); "… Index (-100..100): …" says something new.
  if (lead && name.toLowerCase().startsWith(lead[1].toLowerCase())) text = text.slice(lead[0].length).replace(/^[a-z]/, (c) => c.toUpperCase());
  if (!max || text.length <= max) return text;
  const sentences = text.split(/(?<=[.?!])\s+(?=[A-Z(])/);
  let out = sentences[0];
  for (const s of sentences.slice(1)) { if (out.length + 1 + s.length > max) break; out += ` ${s}`; }
  if (out.length <= max * 1.3) return out;
  // One very long sentence: cut at a word and say so.
  return `${out.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:(]$/, "")}…`;
}
