/**
 * The three scoring methods side by side on the default mix (or the mix in `--i "<encoded index>"`): the top of each
 * ranking, how far ranks move, how long a fit takes, and a sanity check of the ECI-style score against Epoch's own index
 * (benchmark `epoch-eci`), as a rank correlation over the models both score.
 * Usage: npx tsx scripts/verify/scoring-methods.mts [--top 10] [--date YYYY-MM-DD] [--i "<encoded index>"]
 */
import { loadSnapshot, readSnapshot } from "../../src/data/load";
import { computeIndex, defaultConfig, EPOCH_ECI, selectVariants, type IndexConfig, type RankedVariant, type ScoringMethod } from "../../src/engine";
import { decodeIndex } from "../../src/lib/url";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const snapshot = (arg("date") ? await readSnapshot(arg("date")!) : await loadSnapshot())!;
const base: IndexConfig = { ...(arg("i") ? decodeIndex(arg("i")!, "i0")! : defaultConfig(snapshot)), variants: "all" };
const top = Number(arg("top") ?? 10);

const rankOf = (xs: number[]) => { const order = xs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]); const r = new Array<number>(xs.length); order.forEach(([, i], k) => (r[i] = k)); return r; };
export const spearman = (a: number[], b: number[]) => { const ra = rankOf(a), rb = rankOf(b), n = a.length; let d = 0; for (let i = 0; i < n; i++) d += (ra[i] - rb[i]) ** 2; return 1 - 6 * d / (n * (n * n - 1)); };

const run = (scoring?: ScoringMethod) => {
  const config = { ...base, scoring }, t0 = performance.now(), result = computeIndex(snapshot, config), first = performance.now() - t0;
  const t1 = performance.now();
  for (let i = 0; i < 10; i++) computeIndex(snapshot, config);
  return { result, best: selectVariants(result.ranked, "best"), first, again: (performance.now() - t1) / 10 };
};
const methods = { average: run(), irt: run("irt"), eci: run("eci") };
const name = (r: RankedVariant) => `${r.model.name}${r.variant.effort === "default" ? "" : ` ${r.variant.effort}`}`;

console.log(`Snapshot ${snapshot.date} · ${methods.average.result.benchmarks.length} benchmarks · ${methods.average.result.ranked.length} ranked variants, ${methods.average.best.length} models\n`);
console.log(`| # | Weighted average | IRT ability | ECI-style |\n| --- | --- | --- | --- |`);
for (let i = 0; i < top; i++) {
  const cell = (m: keyof typeof methods) => { const r = methods[m].best[i]; return r ? `${name(r)} ${r.score.toFixed(1)}${r.method ? ` (${r.method.range[0].toFixed(1)} to ${r.method.range[1].toFixed(1)})` : ""}` : ""; };
  console.log(`| ${i + 1} | ${cell("average")} | ${cell("irt")} | ${cell("eci")} |`);
}
const averageRank = new Map(methods.average.best.map((r) => [r.model.id, r.rank]));
for (const m of ["irt", "eci"] as const) {
  const rows = methods[m].best.filter((r) => averageRank.has(r.model.id));
  const moved = rows.map((r) => ({ r, by: averageRank.get(r.model.id)! - r.rank })).sort((a, b) => Math.abs(b.by) - Math.abs(a.by));
  const byVariant = new Map(methods.average.result.ranked.map((r) => [r.variant.id, r.score]));
  const both = methods[m].result.ranked.filter((r) => byVariant.has(r.variant.id));
  console.log(`\n${m}: rank correlation with the average ${spearman(both.map((r) => r.score), both.map((r) => byVariant.get(r.variant.id)!)).toFixed(3)} over ${both.length} variants · same top ${top}: ${methods[m].best.slice(0, top).filter((r) => (averageRank.get(r.model.id) ?? 99) <= top).length}/${top}`);
  console.log(`  biggest moves: ${moved.slice(0, 6).map(({ r, by }) => `${r.model.name} ${by > 0 ? "up" : "down"} ${Math.abs(by)} (to ${r.rank})`).join(", ")}`);
  console.log(`  fit: ${methods[m].first.toFixed(0)} ms first, ${methods[m].again.toFixed(1)} ms repeated (average method: ${methods.average.again.toFixed(1)} ms)`);
}
// Epoch's own index against each method, over variants that carry an Epoch row (a model's top variant).
const epoch = new Map(snapshot.observations.filter((o) => o.benchmarkId === EPOCH_ECI && Number.isFinite(o.value)).map((o) => [o.variantId, o.value]));
console.log("");
for (const m of ["average", "irt", "eci"] as const) {
  const both = methods[m].result.ranked.filter((r) => epoch.has(r.variant.id));
  if (both.length < 5) { console.log(`${m}: ${both.length} variants with an Epoch ECI score, too few to compare`); continue; }
  const err = m === "eci" ? ` · mean absolute difference ${(both.reduce((a, r) => a + Math.abs(r.score - epoch.get(r.variant.id)!), 0) / both.length).toFixed(1)} ECI points` : "";
  console.log(`${m} vs Epoch's ECI: rank correlation ${spearman(both.map((r) => r.score), both.map((r) => epoch.get(r.variant.id)!)).toFixed(3)} over ${both.length} variants${err}`);
}
