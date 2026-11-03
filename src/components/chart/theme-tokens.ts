/** Chart styling with no dependency on ECharts itself, so pages can use lab colors and option builders without downloading it. `theme.ts` adds the library. */
export const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
export const MONO = "var(--font-jetbrains), 'JetBrains Mono', Menlo, monospace";
export * from "./palette";
import { DARK_PALETTE, LIGHT_PALETTE, textSize, type ChartPalette } from "./palette";

/**
 * Axis labels (rotated bar categories, long tick text) are laid out against fixed grid margins, so a
 * long first label used to run past the canvas edge and get clipped. Every grid merges this: the plot
 * shrinks just enough that axis labels stay inside the canvas, and keeps its margins otherwise.
 */
export const CONTAIN_AXIS_LABELS = { outerBounds: { left: 10, right: 4, top: 2, bottom: 4 }, outerBoundsContain: "all" as const };

/**
 * Series labels (point names on scatters) are not part of the grid, so outerBounds can't hold them.
 * This labelLayout flips a label to the left of its mark when it would cross the right edge, and
 * nudges it down when it would cross the top. `width` is read at layout time (charts resize).
 */
export function insideLabels(width: () => number | undefined, opts: { moveOverlap?: boolean } = {}) {
  return (p: { rect: { x: number; y: number; width: number; height: number }; labelRect: { x: number; y: number; width: number; height: number } }) => {
    const w = width(), r = p.labelRect, out: Record<string, unknown> = { hideOverlap: true, ...(opts.moveOverlap === false ? {} : { moveOverlap: "shiftY" }) };
    if (w && r.x + r.width > w - 4) { out.x = p.rect.x - 6; out.align = "right"; }
    if (r.y < 2) out.y = 2 + r.height / 2;
    return out;
  };
}

/** HearingBench's magma ends: the cool purple a spectrogram starts from and the warm peach it peaks at. */
const SPECTRO_COOL = "#8F2A81", SPECTRO_HOT = "#FDB07B";
const mixHex = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
export type MarkFill = string | { type: "linear"; x: number; y: number; x2: number; y2: number; colorStops: { offset: number; color: string }[] } | { type: "radial"; x: number; y: number; r: number; colorStops: { offset: number; color: string }[] };
/**
 * A mark's fill. Flat lab color by default; under `fill: "spectrogram"` (HearingBench) the lab color
 * becomes a heat ramp like a spectrogram band: it starts deep (pulled toward magma purple) at the
 * bar's base, holds the lab's own color through the middle, and burns toward peach at the tip, with
 * faint harmonic bands along the way. Scatter dots glow hot at the center. Labs stay recognizable.
 */
export function markFill(c: string, pal: ChartPalette, dir: "up" | "right" | "dot" = "up"): MarkFill {
  const stops = spectrogramStops(c, pal);
  if (!stops) return c;
  if (dir === "dot") return { type: "radial", x: 0.38, y: 0.36, r: 0.7, colorStops: [{ offset: 0, color: stops.at(-1)!.color }, { offset: 0.45, color: c }, { offset: 1, color: stops[0].color }] };
  return dir === "up" ? { type: "linear", x: 0, y: 1, x2: 0, y2: 0, colorStops: stops } : { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: stops };
}
/** The same fill as a CSS background (HTML ranking bars), left to right. */
export function markFillCss(c: string, pal: ChartPalette): string {
  const stops = spectrogramStops(c, pal);
  return stops ? `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`).join(", ")})` : c;
}
/** The same fill as an SVG <linearGradient> (left to right) for hand-built export SVGs; undefined when flat. */
export function markFillSvg(id: string, c: string, pal: ChartPalette): string | undefined {
  const stops = spectrogramStops(c, pal);
  return stops && `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops.map((s) => `<stop offset="${s.offset.toFixed(3)}" stop-color="${s.color}"/>`).join("")}</linearGradient>`;
}
function spectrogramStops(c: string, pal: ChartPalette): { offset: number; color: string }[] | undefined {
  if (pal.style?.fill !== "spectrogram" || !/^#[0-9a-f]{6}$/i.test(c)) return undefined;
  const deep = mixHex(mixHex(c, SPECTRO_COOL, 0.45), pal.dark ? "#000000" : "#1D1730", 0.25), hot = mixHex(mixHex(c, "#FFFFFF", 0.42), SPECTRO_HOT, 0.18);
  const at = (t: number) => t < 0.5 ? mixHex(deep, c, t / 0.5) : mixHex(c, hot, (t - 0.5) / 0.5);
  // Harmonic banding: alternate brighter and dimmer stripes, tighter toward the hot end, as overtones crowd together.
  const stops: { offset: number; color: string }[] = [], N = 9, pos = (i: number) => 1 - (1 - i / N) ** 1.35;
  for (let i = 0; i <= N; i++) {
    stops.push({ offset: pos(i), color: at(pos(i)) });
    if (i < N) stops.push({ offset: pos(i + 0.5), color: mixHex(at(pos(i + 0.5)), pal.dark ? "#000000" : "#FFFFFF", pal.dark ? 0.16 : 0.12) });
  }
  return stops;
}

/** A lab color pushed toward the palette's neutral: how non-highlighted marks recede. */
export function dimColor(color: string | undefined, pal: ChartPalette, amount = 0.72) {
  const neutral = pal.dark ? "#55554F" : "#C4C3BB", c = color && /^#[0-9a-f]{6}$/i.test(color) ? color : neutral;
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), a = p(c), b = p(neutral);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("");
}

export const markLabel = (pal: ChartPalette) => ({ show: true, position: "right" as const, formatter: "{b}", fontSize: 11.5, color: pal.ink, opacity: 1, distance: 7, textBorderColor: pal.bg, textBorderWidth: 3 });

/** A palette's ECharts theme and the name it registers under. `showGrid`: the viewer's Background grid choice, when they made one (`useChartGrid`). */
export function themeSpec(pal: ChartPalette, fonts?: { sans?: string; mono?: string }, showGrid = !pal.style?.gridOff) {
  const sans = fonts?.sans ?? pal.fonts?.sans ?? SANS, mono = fonts?.mono ?? pal.fonts?.mono ?? MONO, grid = pal.style?.grid === "dotted" ? "dotted" : "solid";
  const t = textSize(pal), name = `priors-${[pal.ink, pal.grey, pal.hair, pal.tipBg, sans, mono, grid, showGrid ? "" : "nogrid", t === 1 ? "" : t].join("").replace(/[^a-z0-9]/gi, "")}`;
  const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: pal.grey, fontFamily: mono, fontSize: 11 * t } }, splitLine = { show: showGrid, lineStyle: { color: pal.hair, type: grid } };
  return { name, theme: {
      backgroundColor: "transparent",
      textStyle: { fontFamily: sans, color: pal.ink },
      categoryAxis: { ...axis, splitLine: { show: false } },
      valueAxis: { ...axis, splitLine },
      logAxis: { ...axis, splitLine },
      timeAxis: { ...axis, splitLine },
      tooltip: { confine: true, backgroundColor: pal.tipBg, borderColor: pal.tipBorder, borderWidth: 1, textStyle: { color: pal.ink, fontSize: 12 * t, fontFamily: sans }, extraCssText: "box-shadow:none;border-radius:4px;padding:8px 10px" },
  } };
}
