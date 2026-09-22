import type { FocusId } from "./focus";

/** Precomputed benchmark columns + seeded mixes for the lineup fit, per snapshot date.
 * Columns and mixes are computed with the default settings (strictness 50, estimation on,
 * calibrated effort matching) over the full model pool, best effort per model. */
export interface MixLibrary {
  date: string;
  settingsKey: string;
  /** benchmarkId -> modelId -> score in the single-benchmark index */
  columns: Record<string, Record<string, number>>;
  mixes: Record<FocusId, { weights: Record<string, number>; ranking: Record<string, number> }[]>;
}
