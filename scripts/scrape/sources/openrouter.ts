/**
 * OpenRouter — provider-level reliability and serving metrics per model.
 * Model list: /api/v1/models (clean slugs + canonical permaslugs).
 * Stats: /api/frontend/v1/stats/<metric>?permaslug=<canonical> — JSON series
 * keyed by provider endpoint id; we aggregate across providers.
 * Model matching is strict: the slug's author prefix must map to the same
 * labId the label normalizer produces — anything else is logged and skipped.
 */
import type { Source, ScrapeResult, RawRow, Benchmark } from "../../../src/data/types";
import { normalizeLabel } from "../../../src/data/normalize";

const LIST = "https://openrouter.ai/api/v1/models";
const STATS = "https://openrouter.ai/api/frontend/v1/stats";
const PAGE = (slug: string) => `https://openrouter.ai/${slug}`;

/** OpenRouter slug author prefix -> our labId. Unmapped authors must land on "other". */
const AUTHOR_LAB: Record<string, string> = {
  openai: "openai", anthropic: "anthropic", google: "google", "x-ai": "xai",
  "meta-llama": "meta", meta: "meta", deepseek: "deepseek", mistralai: "mistral",
  moonshotai: "moonshot", qwen: "alibaba", "z-ai": "zhipu", minimax: "minimax",
  xiaomi: "xiaomi", tencent: "tencent", "tencent-hunyuan": "tencent", thinkingmachines: "thinking-machines",
};

interface ORModel { id: string; name: string; canonical_slug?: string; architecture?: { output_modalities?: string[] } }
interface SeriesPoint { x: string; y: Record<string, number | null>; volume?: Record<string, number> }

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Per-endpoint medians over the window, then median across endpoints. */
function perEndpointMedian(data: SeriesPoint[]): number | undefined {
  const byEp = new Map<string, number[]>();
  for (const p of data) for (const [ep, v] of Object.entries(p.y)) if (v != null) (byEp.get(ep) ?? byEp.set(ep, []).get(ep)!).push(v);
  return median([...byEp.values()].map((xs) => median(xs)!));
}

/** Volume-weighted mean of per-endpoint rates (error-rate series carry `volume`). */
function volumeWeightedMean(data: SeriesPoint[]): number | undefined {
  let num = 0, den = 0;
  for (const p of data) for (const [ep, v] of Object.entries(p.y)) {
    const vol = p.volume?.[ep] ?? 0;
    if (v != null && vol > 0) { num += v * vol; den += vol; }
  }
  return den ? num / den : undefined;
}

/** Mean of the daily aggregate (mean of endpoints reporting that day). */
function dailyMean(data: SeriesPoint[]): number | undefined {
  const days = data.map((p) => { const vs = Object.values(p.y).filter((v): v is number => v != null); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; }).filter((v): v is number => v != null);
  return days.length ? days.reduce((a, b) => a + b, 0) / days.length : undefined;
}

function endpointCount(data: SeriesPoint[]): number {
  const s = new Set<string>();
  for (const p of data) for (const k of Object.keys(p.y)) s.add(k);
  return s.size;
}

const BENCH = (id: string, name: string, unit: Benchmark["unit"], hib: boolean, category: Benchmark["category"], description: string): Benchmark =>
  ({ id, name, shortName: name, sourceId: "openrouter", url: "https://openrouter.ai", description, unit, higherIsBetter: hib, category, eligibleForDefault: false, defaultWeight: 0 });

const source: Source = {
  id: "openrouter",
  name: "OpenRouter",
  url: "https://openrouter.ai",
  async scrape(ctx): Promise<ScrapeResult> {
    const raw: Record<string, string> = {};
    const list = await ctx.fetchJson<{ data: ORModel[] }>(LIST);
    raw["models.json"] = JSON.stringify(list.data).slice(0, 400_000);

    // ---- strict slug -> modelId matching ---------------------------------
    type Target = { slug: string; permaslug: string; label: string; modelId: string };
    const targets = new Map<string, Target>();
    const skipped: string[] = [];
    for (const m of list.data) {
      if (m.id.includes(":")) continue; // :free / :exacto derivatives
      if (m.id.startsWith("~")) continue; // alias slugs
      if (!m.architecture?.output_modalities?.includes("text")) continue;
      const author = m.id.split("/")[0];
      const n = normalizeLabel(m.name);
      if (!n.ok) { skipped.push(`${m.id} (${m.name})`); continue; }
      const expected = AUTHOR_LAB[author];
      if (expected && n.labId !== expected) { skipped.push(`LAB MISMATCH ${m.id} (${m.name}) -> ${n.labId}, want ${expected}`); continue; }
      if (!expected && n.labId !== "other") { skipped.push(`UNMAPPED AUTHOR ${m.id} (${m.name}) -> ${n.labId}`); continue; }
      const permaslug = m.canonical_slug ?? m.id;
      const prev = targets.get(n.modelId);
      if (prev && prev.slug.split("/")[1].length <= m.id.split("/")[1].length) continue;
      targets.set(n.modelId, { slug: m.id, permaslug, label: m.name, modelId: n.modelId });
    }
    ctx.log(`matched ${targets.size} models, ${skipped.length} skipped`);

    // ---- stats endpoints per model ----------------------------------------
    const rows: RawRow[] = [];
    const unknown: string[] = [];
    const j = <T>(u: string) => ctx.fetchJson<T>(u).catch(() => undefined);
    const entries = [...targets.values()];
    const CONC = 6;
    for (let i = 0; i < entries.length; i += CONC) {
      await Promise.all(entries.slice(i, i + CONC).map(async (t) => {
        const q = `permaslug=${encodeURIComponent(t.permaslug)}`;
        const [up, tps, lat, toolErr] = await Promise.all([
          j<{ data?: SeriesPoint[] }>(`${STATS}/uptime-comparison?${q}&timeRange=7d`),
          j<{ data?: SeriesPoint[] }>(`${STATS}/throughput-comparison?perfWorkload=text_generation&${q}&timeRange=3d&variant=standard`),
          j<{ data?: SeriesPoint[] }>(`${STATS}/latency-comparison?perfWorkload=text_generation&${q}&timeRange=3d&variant=standard`),
          j<{ data?: SeriesPoint[] }>(`${STATS}/tool-call-error-rate?${q}&timeRange=3d`),
        ]);
        const url = PAGE(t.slug);
        const mk = (benchmarkId: string, value: number | undefined, extra?: Partial<RawRow>) => {
          if (value == null || !Number.isFinite(value)) return;
          rows.push({ benchmarkId, modelLabel: t.label, value: +value.toFixed(4), sourceUrl: url, ...extra });
        };
        const upData = up?.data ?? [];
        if (!upData.length && !tps?.data?.length) { unknown.push(t.permaslug); return; }
        mk("openrouter-uptime", dailyMean(upData));
        mk("openrouter-providers", endpointCount(upData.length ? upData : (tps?.data ?? [])));
        mk("openrouter-tps", perEndpointMedian(tps?.data ?? []));
        const latMs = perEndpointMedian(lat?.data ?? []);
        mk("openrouter-latency", latMs == null ? undefined : latMs / 1000);
        mk("openrouter-tool-errors", volumeWeightedMean(toolErr?.data ?? []));
        raw[`stats-${t.permaslug.replace("/", "_")}.json`] = JSON.stringify({ uptime: upData.slice(-14), throughput: (tps?.data ?? []).slice(-48), latency: (lat?.data ?? []).slice(-48), toolErrors: (toolErr?.data ?? []).slice(-48) }).slice(0, 300_000);
      }));
      ctx.log(`${Math.min(i + CONC, entries.length)}/${entries.length}`);
    }

    return {
      benchmarks: [
        BENCH("openrouter-uptime", "Uptime (7d)", "percent", true, "reliability", "Mean provider uptime over the trailing week on OpenRouter — share of time endpoints can serve the model."),
        { ...BENCH("openrouter-providers", "Provider count", "count", true, "reliability", "Number of OpenRouter providers serving the model — a redundancy measure."), proxy: true },
        BENCH("openrouter-tps", "Provider throughput", "count", true, "speed", "Median provider output throughput in tokens per second across OpenRouter endpoints (3d)."),
        BENCH("openrouter-latency", "Provider latency", "seconds", false, "speed", "Median provider latency across OpenRouter endpoints, in seconds (3d)."),
        BENCH("openrouter-tool-errors", "Tool-call error rate", "percent", false, "reliability", "Volume-weighted mean tool-call error rate across OpenRouter providers (3d)."),
      ],
      rows, raw,
      notes: [...(skipped.length ? [`skipped ${skipped.length}: ${skipped.slice(0, 30).join("; ")}`] : []), ...(unknown.length ? [`no stats: ${unknown.slice(0, 30).join("; ")}`] : [])],
    };
  },
};
export default source;
