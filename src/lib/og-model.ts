import type { Snapshot } from "@/data/types";
import { computeIndex, defaultConfig, selectVariants } from "@/engine";
import { markColor, LIGHT_PALETTE } from "@/components/chart/theme";
import { escapeSvg } from "@/components/chart/export-frame";
import { RADAR_PALETTES, radarModelsFor, radarRows, radarSvg, type RadarSeries } from "@/components/chart/radar-view";
import { rasterize } from "./og-chart";

const ACCENT = "#2F4FB0";
const W = 1200, H = 630;

/** Where a model stands: its place in the default index, its best benchmark placements, its radar. */
const standings = new WeakMap<Snapshot, Map<string, ReturnType<typeof computeStanding>>>();
/** Memoized per loaded snapshot: link-preview metadata and the OG image both ask, and each ask re-ranks every model. */
export function modelStanding(snapshot: Snapshot, modelId: string) {
  // The id comes from the URL: only real models are remembered, so junk ids cannot grow the cache.
  if (!snapshot.models.some((m) => m.id === modelId)) return null;
  const byModel = standings.get(snapshot) ?? standings.set(snapshot, new Map()).get(snapshot)!;
  if (!byModel.has(modelId)) byModel.set(modelId, computeStanding(snapshot, modelId));
  return byModel.get(modelId)!;
}

function computeStanding(snapshot: Snapshot, modelId: string) {
  const model = snapshot.models.find((m) => m.id === modelId);
  if (!model) return null;
  const lab = snapshot.labs.find((l) => l.id === model.labId);
  const config = defaultConfig(snapshot);
  // Like the model page: when the model has too little measured data to rank, rank it with estimates.
  const strict = computeIndex(snapshot, { ...config, variants: "all" });
  const estimated = !strict.ranked.some((r) => r.model.id === modelId);
  const result = estimated ? computeIndex(snapshot, { ...config, variants: "all", strictness: 0 }) : strict;
  const best = selectVariants(result.ranked, "best");
  const at = best.findIndex((r) => r.model.id === modelId), mine = at >= 0 ? best[at] : undefined;
  // Placement on every benchmark it has a result on: its best variant against every other variant's best.
  const variants = new Map(snapshot.variants.map((v) => [v.id, v]));
  const per = new Map<string, Map<string, number>>();
  for (const o of snapshot.observations) {
    const base = o.variantId.split("~")[0], m = per.get(o.benchmarkId) ?? per.set(o.benchmarkId, new Map()).get(o.benchmarkId)!;
    const prev = m.get(base);
    if (prev == null || o.value > prev) m.set(base, o.value);
  }
  const places: { name: string; rank: number; of: number }[] = [];
  for (const b of snapshot.benchmarks) {
    const m = per.get(b.id);
    if (!m || b.proxy) continue;
    const rows = [...m.entries()].map(([id, value]) => ({ modelId: variants.get(id)?.modelId ?? id.split("@")[0], value }));
    const own = rows.filter((r) => r.modelId === modelId);
    if (!own.length) continue;
    const better = b.higherIsBetter === false ? (x: number, y: number) => x < y : (x: number, y: number) => x > y;
    const top = own.reduce((a, r) => (better(r.value, a.value) ? r : a));
    places.push({ name: b.shortName ?? b.name, rank: 1 + rows.filter((r) => better(r.value, top.value)).length, of: rows.length });
  }
  // Best placements first; among equals, the more contested benchmark.
  const standouts = places.filter((p) => p.of >= 5).sort((a, b) => a.rank - b.rank || b.of - a.of).slice(0, 3);
  let radar: { svg: string; series: RadarSeries[] } | null = null;
  if (mine) {
    const rows = radarRows(snapshot, estimated ? { ...config, strictness: 0 } : config, result.ranked, result.benchmarks);
    const { axes, models, median } = radarModelsFor(rows, result.benchmarks, "field");
    const me = models.find((m) => m.id === modelId), leader = models[0];
    if (me && axes.length >= 3) {
      const color = (labId: string) => markColor(snapshot.labs.find((l) => l.id === labId)?.color, LIGHT_PALETTE, labId);
      const series: RadarSeries[] = [{ id: me.id, name: me.name, color: color(me.labId), points: me.points }];
      if (leader && leader.id !== me.id) series.push({ id: leader.id, name: `${leader.name} (#1)`, color: leader.labId === me.labId ? RADAR_PALETTES.light.ink2 : color(leader.labId), dash: "6 5", points: leader.points });
      radar = { svg: radarSvg({ axes, series, ghost: median, norm: "field", pal: RADAR_PALETTES.light, size: 330, legend: false }), series };
    }
  }
  return { model, lab, index: config.name, place: at + 1, of: best.length, score: mine?.score, effort: mine?.variant.effort, estimated, measured: places.length, standouts, radar };
}

/** One line for link previews: rank, score and the best placements. */
export function modelDescription(s: NonNullable<ReturnType<typeof modelStanding>>): string {
  const rank = s.score != null ? `${s.model.name} ranks #${s.place} of ${s.of} on ${s.index} (${s.score.toFixed(1)}${s.effort && s.effort !== "default" ? `, best at ${s.effort}` : ""}${s.estimated ? ", with estimates" : ""}).` : `${s.model.name} isn't ranked on ${s.index} yet.`;
  const firsts = s.standouts.filter((p) => p.rank === 1).map((p) => p.name);
  const best = firsts.length ? ` #1 on ${firsts.length > 1 ? `${firsts.slice(0, -1).join(", ")} and ${firsts.at(-1)}` : firsts[0]}.` : s.standouts[0] ? ` Best placement: #${s.standouts[0].rank} of ${s.standouts[0].of} on ${s.standouts[0].name}.` : "";
  return `${rank}${best} Results on ${s.measured} benchmarks, by reasoning effort.`;
}

/** Split a name over at most two lines near the middle space. */
function nameLines(name: string, max: number): string[] {
  if (name.length <= max) return [name];
  const spaces = [...name.matchAll(/ /g)].map((m) => m.index!);
  if (!spaces.length) return [name];
  const cut = spaces.reduce((a, i) => (Math.abs(i - name.length / 2) < Math.abs(a - name.length / 2) ? i : a));
  return [name.slice(0, cut), name.slice(cut + 1)];
}

/**
 * The model's share card (1200×630): name, lab and release on the left with its index score, rank and
 * best benchmark placements; its strengths radar against the index leader and the field median on the right.
 */
export function renderModelCard(snapshot: Snapshot, modelId: string): Buffer | null {
  const s = modelStanding(snapshot, modelId);
  if (!s) return null;
  const pal = RADAR_PALETTES.light, e = escapeSvg;
  const labColor = markColor(s.lab?.color, LIGHT_PALETTE, s.lab?.id);
  const lines = nameLines(s.model.name, 17), size = lines.length > 1 || s.model.name.length > 14 ? 60 : 72;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${pal.bg}"/>`];
  let y = 84;
  out.push(`<circle cx="70" cy="${y - 6}" r="7" fill="${labColor}"/><text x="88" y="${y}" font-family="JetBrains Mono" font-size="17" fill="${pal.grey}">${e([s.lab?.name, s.model.releaseDate && `released ${s.model.releaseDate}`].filter(Boolean).join(" · "))}</text>`);
  y += size + 18;
  for (const l of lines) { out.push(`<text x="62" y="${y}" font-family="Newsreader" font-size="${size}" fill="${pal.ink}">${e(l)}</text>`); y += size * 1.04; }
  if (s.score != null) {
    y += 82;
    out.push(`<text x="64" y="${y}" font-family="JetBrains Mono" font-weight="500" font-size="92" fill="${ACCENT}">${s.score.toFixed(1)}</text>`);
    out.push(`<text x="330" y="${y - 44}" font-family="Inter" font-weight="500" font-size="26" fill="${pal.ink}">#${s.place} of ${s.of} models</text>`);
    out.push(`<text x="330" y="${y - 12}" font-family="Inter" font-size="19" fill="${pal.grey}">${e(`${s.index}${s.effort && s.effort !== "default" ? ` · best at ${s.effort}` : ""}`)}</text>`);
    if (s.estimated) out.push(`<text x="330" y="${y + 16}" font-family="Inter" font-size="16" fill="${pal.grey}">includes estimates</text>`);
  } else {
    y += 50;
    out.push(`<text x="64" y="${y}" font-family="Inter" font-size="22" fill="${pal.ink2}">Measured on ${s.measured} benchmarks</text>`);
  }
  y += 52;
  for (const p of s.standouts) {
    out.push(`<text x="64" y="${y}" font-family="JetBrains Mono" font-weight="500" font-size="20" fill="${ACCENT}">#${p.rank}<tspan dx="8" font-weight="400" font-size="15" fill="${pal.grey}">of ${p.of}</tspan></text><text x="196" y="${y}" font-family="Inter" font-size="20" fill="${pal.ink}">${e(p.name.length > 30 ? `${p.name.slice(0, 29)}…` : p.name)}</text>`);
    y += 34;
  }
  if (s.radar) {
    const open = s.radar.svg.match(/<svg[^>]*>/)![0], rw = Number(open.match(/width="([\d.]+)/)![1]), rh = Number(open.match(/height="([\d.]+)/)![1]);
    const k = Math.min(560 / rw, 470 / rh), x = W - 40 - rw * k, ry = 40;
    out.push(s.radar.svg.replace(/<svg[^>]*>/, `<svg x="${x.toFixed(1)}" y="${ry}" width="${(rw * k).toFixed(1)}" height="${(rh * k).toFixed(1)}" viewBox="0 0 ${rw} ${rh}">`));
    // Legend under the radar.
    const label = (n: string) => (n.length > 26 ? `${n.slice(0, 25)}…` : n);
    const total = s.radar.series.reduce((a, sr) => a + 48 + label(sr.name).length * 8, 0) + 26 + 96;
    let lx = Math.min(x + 90, W - 40 - total);
    const ly = ry + rh * k + 22;
    for (const sr of s.radar.series) {
      out.push(`<line x1="${lx}" y1="${ly - 5}" x2="${lx + 24}" y2="${ly - 5}" stroke="${sr.color}" stroke-width="2.5" stroke-linecap="round"${sr.dash ? ` stroke-dasharray="${sr.dash}"` : ""}/><text x="${lx + 32}" y="${ly}" font-family="Inter" font-size="15" fill="${pal.ink2}">${e(label(sr.name))}</text>`);
      lx += 48 + label(sr.name).length * 8;
    }
    out.push(`<rect x="${lx}" y="${ly - 11}" width="18" height="10" rx="2" fill="${pal.ghost}" stroke="${pal.grey}" stroke-dasharray="2 2"/><text x="${lx + 26}" y="${ly}" font-family="Inter" font-size="15" fill="${pal.grey}">Field median</text>`);
  }
  out.push(`<text x="64" y="${H - 34}" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">${e(`mypriors.com/models/${s.model.id} · ${snapshot.date}`)}</text>`);
  out.push(`<text x="${W - 50}" y="${H - 32}" text-anchor="end" font-family="Newsreader" font-size="36" fill="${pal.ink}">pr<tspan fill="${ACCENT}">i</tspan>ors</text>`);
  out.push("</svg>");
  return rasterize(out.join(""), pal.bg);
}
