/**
 * Dates a benchmark's publisher changed what its number means, so values on either side are not comparable.
 * Anything drawn over time, or next to an older snapshot, says so. `date` is the first Priors snapshot on the new method.
 */
export interface SeriesBreak { date: string; benchmarkIds: string[]; note: string; url: string }

/** AA's changelog dates it Nov 3. The Nov 3 snapshot still has the old values, and Nov 4 is the first with the new ones. */
export const AA_PERFORMANCE_V3: SeriesBreak = {
  date: "2026-11-04", benchmarkIds: ["aa-output-speed", "aa-ttft"],
  note: "Artificial Analysis changed how it measures speed in Performance Benchmarking v3.0.0. Values before Nov 4, 2026 are not comparable with later ones.",
  url: "https://artificialanalysis.ai/methodology/performance-benchmarking",
};

export const SERIES_BREAKS: SeriesBreak[] = [AA_PERFORMANCE_V3];

export function breaksFor(benchmarkIds: Iterable<string>): SeriesBreak[] {
  const ids = new Set(benchmarkIds);
  return SERIES_BREAKS.filter((b) => b.benchmarkIds.some((id) => ids.has(id)));
}

/** Whether a snapshot's AA speed values use the v3.0.0 method. No date means today's data. */
export const onAaPerformanceV3 = (date?: string) => !date || date >= AA_PERFORMANCE_V3.date;
