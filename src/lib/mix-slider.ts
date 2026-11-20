/**
 * The mix's weight sliders (`WeightsPanel`). A slider's position is its own benchmark's weight, so moving one leaves every other
 * thumb where it is; the percent beside each name is that benchmark's share, and the shares are what change. (Adam, 2026-11-20:
 * the sliders used to be shares, so moving one moved them all.)
 *
 * The middle of the track is one unit, the mix's middle weight when the scale was set. Position follows the square root of the
 * weight, so the right end is four units: room to raise one benchmark well above the rest, with finer steps near the middle.
 */
export const SLIDER_MAX = 100;
const MID = SLIDER_MAX / 2;
/** How many units the right end of the track is. */
export const SLIDER_TOP = (SLIDER_MAX / MID) ** 2;

/** The unit for a mix: its middle weight, raised if needed so the largest weight still fits on the track. 10 for an empty mix. */
export function sliderUnit(weights: Record<string, number>): number {
  const v = Object.values(weights).filter((w) => w > 0).sort((a, b) => a - b);
  return v.length ? Math.max(v[Math.floor((v.length - 1) / 2)], v[v.length - 1] / SLIDER_TOP) : 10;
}
/** Where a weight sits on the track, 0 to SLIDER_MAX. */
export const toSlider = (weight: number, unit: number) => Math.min(SLIDER_MAX, Math.max(0, MID * Math.sqrt(Math.max(0, weight) / unit)));
/** The weight at a track position. The left end is 0, which takes the benchmark out of the mix. */
export const fromSlider = (position: number, unit: number) => (position <= 0 ? 0 : Number((unit * (position / MID) ** 2).toPrecision(4)));
