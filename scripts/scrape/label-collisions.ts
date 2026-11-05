import { EFFORT_WORDS, normalizeLabel } from "../../src/data/normalize";

/**
 * How a new model gets filed under an old one without anyone seeing: a family rule matches "SWE-2" and ignores the "Flash" after it.
 * A row can then land on the base model's row, where the build's keep-first dedupe drops it (Flash's max row), or sit on the base model
 * unnoticed (Flash's low row). Both are reported here. Benchmarks that list several runs of one model have plenty of differently named
 * rows, so a report needs a tier word in the name. Old merges stay reported too, so the job records what exists as a baseline and notifies
 * only on a line it has not seen: a new label, on any model, however old its base.
 */
export interface LabeledRow { benchmarkId: string; variantId: string; harness?: string; label: string; value: number }
export interface LabelCollision { benchmarkId: string; variantId: string; dropped: string; kept: string }

/** Words that name a different model or tier, never an effort. "Max" and "Ultra" are efforts as often as tiers, so they say nothing. */
const TIER_WORD = /\b(flashx|flash|fast|turbo|lite|mini|nano|spark|instant|omni|air|plus|pro|small|large|vision|multi-agent|deep think)\b/g;
const tierWords = (label: string) => new Set(normalizeLabel(label).cleaned.replace(/\b\d+(\.\d+)?\s*[bk]\b/g, " ").match(TIER_WORD) ?? []);
const sameWords = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((w) => b.has(w));
const EFFORTS = new RegExp(`\\b(${Object.keys(EFFORT_WORDS).sort((a, b) => b.length - a.length).join("|")})\\b`, "g");

/** Rows the keep-first dedupe would drop where two differently tiered labels landed on one benchmark and variant with different values. */
export function labelCollisions(rows: LabeledRow[]): LabelCollision[] {
  const first = new Map<string, LabeledRow>(), out = new Map<string, LabelCollision>();
  for (const r of rows) {
    const k = `${r.benchmarkId}|${r.variantId}|${r.harness ?? ""}`, kept = first.get(k);
    if (!kept) { first.set(k, r); continue; }
    if (kept.value === r.value || sameWords(tierWords(kept.label), tierWords(r.label))) continue;
    out.set(`${k}|${r.label}`, { benchmarkId: r.benchmarkId, variantId: r.variantId, dropped: r.label, kept: kept.label });
  }
  return [...out.values()];
}

/** Labels naming a tier their model's own name and id do not have ("swe-2 flash" on `swe-2`): the same merge, before any row collides. */
export function swallowedTiers(models: { id: string; name: string; aliases: string[] }[]): { modelId: string; label: string; word: string }[] {
  return models.flatMap((m) => {
    const own = `${m.id} ${m.name}`.toLowerCase().replace(/-/g, " ");
    return m.aliases.flatMap((label) => {
      // Text in brackets is usually the source's own note: a harness, a configuration, an effort.
      const word = [...tierWords(label.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(EFFORTS, " "))].find((w) => !own.includes(w));
      return word ? [{ modelId: m.id, label, word }] : [];
    });
  });
}
