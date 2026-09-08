/** Exploration may worsen a candidate. The caller keeps the best verified result separately. */
export function acceptExploration(current: number[], candidate: number[], temperature: number, random: () => number): boolean {
  for (let i = 0; i < current.length; i++) {
    const delta = candidate[i] - current[i];
    if (delta < 0) return true;
    if (delta > 0) {
      // Relative scale keeps score margins and integer ranking errors usable in the same walk.
      const scale = Math.max(1, Math.abs(current[i]), Math.abs(candidate[i]));
      return temperature > 0 && random() < Math.exp(-delta / (scale * temperature));
    }
  }
  return true;
}

/** Reheat independent rounds instead of cooling once and remaining trapped. */
export function explorationTemperature(step: number, roundLength: number): number {
  const progress = (step % roundLength) / Math.max(1, roundLength - 1);
  return 1.2 * Math.pow(.015 / 1.2, progress);
}
