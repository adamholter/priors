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
  /** Offline fits for specific lineups (the default and popular ones), verified under their own settings. */
  fits?: LibraryFit[];
}

export interface LibraryFit {
  lineup: string[];
  focus: FocusId;
  weights: Record<string, number>;
  settings: { strictness: number; estimateMissing: boolean; effortMatching: "calibrated" | "strict" | "nearest" };
  exact: boolean;
  fitScore: number;
}
