/** Pure helpers for the header of a benchmark's page: what a long description closes to, and how dates and signed points read. */

/** Boards with fewer models than this get their count marked: 3 models is not 186. (MIN_MODELS in history.ts, which a client file cannot import.) */
export const THIN_BOARD = 8;

const STOP = new Set(["a", "an", "the", "of", "to", "by", "in", "on", "at", "for", "and", "or", "that", "each", "from", "with", "as", "is", "are", "its", "it", "than", "then", "so", "which", "where", "whose", "into", "per", "one", "any"]);

/**
 * Where a long description stops when closed: after a whole sentence when one fits, else at the last clause or word before the limit,
 * never on a connective. `mid` is true when the cut falls inside a sentence (an ellipsis marks it). Null when the text fits as it is.
 */
export function shorten(text: string, max: number): { lead: string; rest: string; mid: boolean } | null {
  if (text.length <= max * 1.2) return null;
  const ends = [...text.matchAll(/[.!?]+(?=\s|$)/g)].map((m) => m.index! + m[0].length);
  if (ends[0] != null && ends[0] <= max * 1.35) {
    let end = ends[0];
    for (const e of ends.slice(1)) { if (e > max) break; end = e; }
    if (end >= text.trimEnd().length) return null;
    return { lead: text.slice(0, end), rest: text.slice(end), mid: false };
  }
  const head = text.slice(0, max);
  const clause = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(": "), head.lastIndexOf(" ("));
  const end = clause >= max * 0.45 ? clause : head.lastIndexOf(" ");
  const words = text.slice(0, end).replace(/[,;:\s]+$/, "").split(" ");
  while (words.length > 4 && STOP.has(words[words.length - 1].toLowerCase())) words.pop();
  const lead = words.join(" ");
  return { lead, rest: text.slice(lead.length), mid: true };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 4", with the year only when it is not the reference date's. Anything that is not a date comes back as it was. */
export function shortDay(iso: string, ref: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m || +m[2] < 1 || +m[2] > 12) return iso;
  return `${MONTHS[+m[2] - 1]} ${+m[3]}${m[1] === ref.slice(0, 4) ? "" : `, ${m[1]}`}`;
}

/** Points with their sign, a real minus rather than a hyphen, and a decimal only when there is one. */
export function signedPoints(n: number): string {
  const a = Math.abs(n);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${a % 1 ? a.toFixed(1) : a}`;
}
