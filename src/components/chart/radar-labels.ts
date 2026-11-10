/**
 * Spoke labels for the radar: full benchmark names wrapped onto lines (never cut short), where each
 * sits, and the room they need. Shared by the page's radar (Radar.tsx) and the static SVG behind
 * exports, embeds and share cards (radar-view.ts), so no renderer has to guess a padding.
 */

const NARROW = new Set("iIjl.,:;'|!· "), SLIM = new Set("ftr-()[]/"), WIDE = new Set("mwMW@%");
/** Advance width of Inter text in px. No canvas on the server, so this is a per-class estimate that errs wide. */
export function textWidth(s: string, px: number): number {
  let em = 0;
  for (const ch of s) em += NARROW.has(ch) ? 0.3 : SLIM.has(ch) ? 0.42 : WIDE.has(ch) ? 0.92 : /[A-Z]/.test(ch) ? 0.71 : /[0-9]/.test(ch) ? 0.64 : /[a-z]/.test(ch) ? 0.6 : 0.66;
  return em * px;
}

/** A hyphenated word in pieces that may each start a line. A short piece stays with its neighbour, so "v4-AA" never ends a line on "v4-". */
function hyphenParts(word: string): string[] {
  const out: string[] = [];
  for (const part of word.split(/(?<=-)/)) { if (out.length && (part.length < 5 || out[out.length - 1].length < 5)) out[out.length - 1] += part; else out.push(part); }
  return out;
}

/** Break at spaces; a single word wider than a line breaks after its hyphens. Nothing is dropped. */
export function wrapText(s: string, px: number, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  const add = (piece: string, joiner: string) => {
    const next = line ? line + joiner + piece : piece;
    if (!line || textWidth(next, px) <= maxW) line = next; else { lines.push(line); line = piece; }
  };
  for (const word of s.trim().split(/\s+/).filter(Boolean)) {
    if (textWidth(word, px) <= maxW || !word.includes("-")) add(word, " ");
    else hyphenParts(word).forEach((part, k) => add(part, k ? "" : " "));
  }
  if (line) lines.push(line);
  return lines;
}

export interface RadarLabel { x: number; y: number; anchor: "start" | "middle" | "end"; lines: string[]; w: number; h: number; left: number }
export interface RadarLabelLayout { labels: RadarLabel[]; lineHeight: number; minX: number; maxX: number; minY: number; maxY: number }

/**
 * Labels around a radar of radius R centered on (0, 0). `y` is the first line's baseline; top labels
 * grow upward, bottom labels downward, side labels center on their spoke. The min/max box covers the
 * circle and every label, so a caller sizes its canvas from it.
 */
export function radarLabels(names: string[], { R, px, maxW, gap = 12 }: { R: number; px: number; maxW: number; gap?: number }): RadarLabelLayout {
  const n = names.length, lineHeight = +(px * 1.22).toFixed(1);
  const labels = names.map((name, i): RadarLabel => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const anchor = Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
    // A label above or below the circle has the whole width to itself; one beside it only has the margin.
    const lines = wrapText(name, px, anchor === "middle" ? maxW * 1.8 : maxW);
    const w = Math.max(0, ...lines.map((l) => textWidth(l, px))), extra = (lines.length - 1) * lineHeight;
    const x = c * (R + gap), ay = s * (R + gap);
    const y = s < -0.6 ? ay - 4 - extra : s > 0.6 ? ay + 12 : ay + 4 - extra / 2;
    return { x, y, anchor, lines, w, h: extra + px * 1.3, left: anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2 };
  });
  return {
    labels, lineHeight,
    minX: Math.min(-R, ...labels.map((l) => l.left)), maxX: Math.max(R, ...labels.map((l) => l.left + l.w)),
    minY: Math.min(-R, ...labels.map((l) => l.y - px)), maxY: Math.max(R, ...labels.map((l) => l.y - px + l.h)),
  };
}
