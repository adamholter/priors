import type { Benchmark, Snapshot } from "@/data/types";
import { computeIndex, selectVariants, type RankedVariant } from "@/engine";
import { markColor, LIGHT_PALETTE } from "@/components/chart/theme";
import { escapeSvg } from "@/components/chart/export-frame";
import { RADAR_PALETTES } from "@/components/chart/radar-view";
import { benchmarkIndex, benchmarkSnapshot, benchmarkView, hasOwnCost } from "./benchmark-page";
import { rasterize } from "./og-chart";

const ACCENT = "#2F4FB0";
const W = 1200, H = 630;

/** A benchmark's published value, the way its page prints it. */
export function formatBenchValue(b: Pick<Benchmark, "unit">, v: number) {
  if (b.unit === "percent") return `${v.toFixed(1)}%`;
  if (b.unit === "usd") return `$${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2)}`;
  if (b.unit === "seconds") return `${v.toFixed(v >= 10 ? 0 : 1)}s`;
  return v.toFixed(b.unit === "elo" ? 0 : 1);
}
const usd = (v: number) => v === 0 ? "free" : `$${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(v >= 0.1 ? 2 : 3)}`;
const label = (r: RankedVariant) => `${r.model.name}${r.variant.effort && r.variant.effort !== "default" ? ` ${r.variant.effort}` : ""}`;

/** Who leads a benchmark and what the leaders cost: its page's own ranking (published results only), best effort per model. */
const standings = new WeakMap<Snapshot, Map<string, ReturnType<typeof computeStanding>>>();
export function benchmarkStanding(snapshot: Snapshot, benchmarkId: string) {
  if (!snapshot.benchmarks.some((b) => b.id === benchmarkId)) return null;
  const byId = standings.get(snapshot) ?? standings.set(snapshot, new Map()).get(snapshot)!;
  if (!byId.has(benchmarkId)) byId.set(benchmarkId, computeStanding(snapshot, benchmarkId));
  return byId.get(benchmarkId)!;
}

function computeStanding(full: Snapshot, benchmarkId: string) {
  const snapshot = benchmarkSnapshot(full, benchmarkId);
  const benchmark = snapshot.benchmarks.find((b) => b.id === benchmarkId)!;
  const ranked = computeIndex(snapshot, benchmarkIndex(snapshot, benchmarkId), benchmarkView(snapshot, benchmarkId)).ranked;
  if (!ranked.length) return null;
  const best = selectVariants(ranked, "best");
  const raw = (r: RankedVariant) => r.values[0]?.raw;
  const leaders = best.slice(0, 6).map((r) => ({ r, value: raw(r) }));
  const api = new Map(snapshot.observations.filter((o) => o.benchmarkId === benchmarkId && o.costUsd != null).map((o) => [o.variantId, o.costUsd!]));
  // The leader's cost both ways, when the benchmark measures cost and the leader's lab has a plan.
  const costed = hasOwnCost(snapshot, benchmarkId) ? ranked.filter((r) => r.costUsd != null && api.has(r.variant.id)) : [];
  const leadCost = costed.find((r) => r.variant.id === best[0].variant.id && r.costPlan) ?? costed.find((r) => r.costPlan);
  return {
    benchmark, ranked, best, leaders, costed, api,
    models: new Set(ranked.map((r) => r.model.id)).size,
    lead: leadCost && leadCost.costPlan ? { r: leadCost, api: api.get(leadCost.variant.id)!, sub: leadCost.costUsd!, plan: leadCost.costPlan.plan } : undefined,
    host: (() => { try { return new URL(benchmark.url).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
  };
}

/** One paragraph for link previews: the leaders with published values, coverage, and the leader's cost on a plan versus the API. */
export function benchmarkDescription(s: NonNullable<ReturnType<typeof benchmarkStanding>>): string {
  const b = s.benchmark, top = s.leaders.slice(0, 3).filter((x) => x.value != null);
  const leads = top.length ? `${label(top[0].r)} leads at ${formatBenchValue(b, top[0].value!)}${top.length > 1 ? `, then ${top.slice(1).map((x) => `${label(x.r)} ${formatBenchValue(b, x.value!)}`).join(", ")}` : ""}.` : "";
  const cost = s.lead ? ` On ${s.lead.plan}, ${label(s.lead.r)} costs ${usd(s.lead.sub)} per task, not ${usd(s.lead.api)} at API prices.` : "";
  return `${b.name}: ${leads} ${s.models} models.${cost}`.replace(/\s+/g, " ").trim();
}

function fit(text: string, max: number) { return text.length > max ? `${text.slice(0, max - 1)}…` : text; }

/**
 * The benchmark's share card (1200×630): its name and source, the top models with their published values as bars on
 * the left; on the right, score against subscription cost per task when the benchmark measures cost (the leader's
 * API price beside it), else more of the leaderboard.
 */
export function renderBenchmarkCard(full: Snapshot, benchmarkId: string): Buffer | null {
  const s = benchmarkStanding(full, benchmarkId);
  if (!s) return null;
  const pal = RADAR_PALETTES.light, e = escapeSvg, b = s.benchmark;
  const color = (r: RankedVariant) => markColor(full.labs.find((l) => l.id === r.model.labId)?.color, LIGHT_PALETTE, r.model.labId);
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${pal.bg}"/>`];
  const split = s.lead && s.costed.length >= 4;
  const leftW = split ? 560 : W - 128;
  out.push(`<text x="64" y="74" font-family="JetBrains Mono" font-size="17" fill="${pal.grey}">${e([b.category.charAt(0).toUpperCase() + b.category.slice(1), s.host, `${s.models} models`].filter(Boolean).join(" · "))}</text>`);
  const name = b.name, size = name.length > 30 ? 46 : name.length > 20 ? 56 : 66;
  out.push(`<text x="62" y="${84 + size}" font-family="Newsreader" font-size="${size}" fill="${pal.ink}">${e(fit(name, split ? 26 : 44))}</text>`);
  // Leaderboard bars: length from the page's score, the label the published value.
  // Bars span the field, lowest to highest score: Elo boards sit near 1500 for everyone, so lengths from zero would all look equal.
  const rows = s.leaders.slice(0, 6), max = Math.max(...s.ranked.map((r) => r.score)), min = Math.min(...s.ranked.map((r) => r.score));
  let y = 84 + size + 64;
  const barX = 64 + (split ? 200 : 290), barW = leftW - (barX - 64) - 110;
  rows.forEach((x, i) => {
    out.push(`<text x="64" y="${y}" font-family="JetBrains Mono" font-size="16" fill="${pal.grey}">${i + 1}</text><text x="92" y="${y}" font-family="Inter" font-size="20" fill="${pal.ink}">${e(fit(label(x.r), split ? 15 : 26))}</text>`);
    out.push(`<rect x="${barX}" y="${y - 15}" width="${barW}" height="16" rx="2" fill="${pal.ghost}"/><rect x="${barX}" y="${y - 15}" width="${(Math.max(0.03, max > min ? (x.r.score - min) / (max - min) : 1) * barW).toFixed(1)}" height="16" rx="2" fill="${color(x.r)}"/>`);
    out.push(`<text x="${barX + barW + 100}" y="${y}" text-anchor="end" font-family="JetBrains Mono" font-weight="500" font-size="20" fill="${pal.ink}">${e(x.value != null ? formatBenchValue(b, x.value) : x.r.score.toFixed(1))}</text>`);
    y += 46;
  });
  if (split && s.lead) {
    // Score vs subscription cost per task, log x, every measured variant; the leader ringed and named.
    const px0 = 700, px1 = W - 64, py0 = 150, py1 = 430;
    const costs = s.costed.map((r) => Math.max(r.costUsd!, 0)), paid = costs.filter((c) => c > 0);
    const lo = Math.log10(Math.max(1e-3, (paid.length ? Math.min(...paid) : 0.01) / 2)), hi = Math.log10(Math.max(...paid, 0.1) * 1.6);
    const ys = s.costed.map((r) => r.score), ylo = Math.min(...ys), yhi = Math.max(...ys), pad = (yhi - ylo || 1) * 0.08;
    // Free plans get their own column at the left edge: a log axis has no zero.
    const free = costs.some((c) => c === 0), fx0 = free ? px0 + 64 : px0;
    const X = (c: number) => c <= 0 ? px0 : fx0 + (Math.log10(Math.max(c, 10 ** lo)) - lo) / (hi - lo) * (px1 - fx0);
    const Y = (v: number) => py1 - (v - (ylo - pad)) / (yhi - ylo + 2 * pad) * (py1 - py0);
    out.push(`<text x="${px0}" y="${py0 - 46}" font-family="Inter" font-weight="500" font-size="22" fill="${pal.ink}">Score vs subscription cost per task</text>`);
    out.push(`<text x="${px0}" y="${py0 - 20}" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">plan prices where the lab has one (Real API Pricing)</text>`);
    out.push(`<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${pal.hair}" stroke-width="1.5"/>`);
    if (free) out.push(`<line x1="${px0}" y1="${py0}" x2="${px0}" y2="${py1}" stroke="${pal.hair}" stroke-dasharray="4 4"/><text x="${px0}" y="${py1 + 24}" text-anchor="middle" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">free</text>`);
    for (let p = Math.ceil(lo); p <= Math.floor(hi); p++) {
      const x = X(10 ** p);
      if (free && x < px0 + 56) continue; // too close to "free" to read
      out.push(`<line x1="${x}" y1="${py0}" x2="${x}" y2="${py1}" stroke="${pal.ring}" stroke-width="1"/><text x="${x}" y="${py1 + 24}" text-anchor="middle" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">${e(p >= 0 ? `$${10 ** p}` : `$${(10 ** p).toFixed(-p)}`)}</text>`);
    }
    for (const r of s.costed) if (r !== s.lead.r) out.push(`<circle cx="${X(r.costUsd!).toFixed(1)}" cy="${Y(r.score).toFixed(1)}" r="6" fill="${color(r)}" fill-opacity="0.85"/>`);
    const lx = X(s.lead.sub), ly = Y(s.lead.r.score);
    out.push(`<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="10" fill="${color(s.lead.r)}" stroke="${pal.ink}" stroke-width="2.5"/>`);
    // The leader's price, named under the chart where no mark can sit on it.
    out.push(`<text x="${px0}" y="${py1 + 66}" font-family="Inter" font-size="19" fill="${pal.ink2}">${e(`${label(s.lead.r)} on ${s.lead.plan}`)}</text>`);
    out.push(`<text x="${px0}" y="${py1 + 98}" font-family="JetBrains Mono" font-weight="500" font-size="26" fill="${ACCENT}">${e(usd(s.lead.sub))}<tspan dx="10" font-weight="400" font-size="18" fill="${pal.grey}">${e(`per task · ${usd(s.lead.api)} at API prices`)}</tspan></text>`);
  }
  out.push(`<text x="64" y="${H - 34}" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">${e(`mypriors.com/benchmarks/${b.id} · ${full.date}`)}</text>`);
  out.push(`<text x="${W - 50}" y="${H - 32}" text-anchor="end" font-family="Newsreader" font-size="36" fill="${pal.ink}">pr<tspan fill="${ACCENT}">i</tspan>ors</text>`);
  out.push("</svg>");
  return rasterize(out.join(""), pal.bg);
}
