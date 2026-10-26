/**
 * WeirdML (Håvard Ihle). v3 (Sept 2026, live): a fully agentic suite of 11 hand-made tasks run in agent
 * harnesses (Codex CLI, Claude Code, Gemini CLI, Kimi Code, OpenCode) — read from the page's own data
 * file, /assets/data/weirdml_v3.json, so new models appear as soon as they're published. Score is the
 * leaderboard's overall effective score with its 95% interval; cost and output tokens are per run.
 * Models the site excludes for missing tasks are skipped. v2 (17 single-shot tasks, CSV) stays as
 * its own benchmark.
 */
import { parse } from "csv-parse/sync";
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { num } from "../harness";

const SITE = "https://htihle.github.io/weirdml_v2.html";
const CSV = "https://htihle.github.io/data/weirdml_data.csv";
const V3_SITE = "https://htihle.github.io/weirdml.html";
const V3_DATA = "https://htihle.github.io/assets/data/weirdml_v3.json";

type V3Model = { id: string; name: string; slug?: string; agent?: string; harnesses?: { name: string; version?: string }[]; release_date?: string; reasoning_effort?: string; synthetic?: boolean; score: number; interval?: [number, number]; mean_api_cost_usd?: number; mean_output_tokens?: number; runs?: number };
type V3Data = { schema_version: number; generated?: string; mode?: string; task_count?: number; models: V3Model[]; excluded_models?: { id: string }[] };

/** WeirdML v3 rows. A model run under several harnesses keeps its best-scoring harness (like Terminal-Bench). */
export function parseWeirdmlV3(data: V3Data): RawRow[] {
  if (data?.schema_version !== 1 || !Array.isArray(data.models)) throw new Error("WeirdML v3 data format changed (expected schema_version 1 with models[])");
  if (data.mode && data.mode !== "real") throw new Error(`WeirdML v3 data is in "${data.mode}" mode, not real results`);
  const excluded = new Set((data.excluded_models ?? []).map((m) => m.id));
  const best = new Map<string, RawRow>();
  for (const m of data.models) {
    if (m.synthetic || excluded.has(m.id) || !Number.isFinite(m.score)) continue;
    // "Kimi K3 (high, Fireworks)" → "Kimi K3"; effort comes from reasoning_effort.
    const label = m.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const effort = m.reasoning_effort && m.reasoning_effort !== "default" ? m.reasoning_effort : undefined;
    const harness = m.harnesses?.map((h) => `${h.name}${h.version ? ` ${h.version}` : ""}`).join(", ") || m.agent;
    const row: RawRow = {
      benchmarkId: "weirdml-v3", modelLabel: label, effort, value: m.score * 100, sourceUrl: V3_SITE,
      ci: m.interval ? [m.interval[0] * 100, m.interval[1] * 100] : undefined,
      costUsd: Number.isFinite(m.mean_api_cost_usd) ? m.mean_api_cost_usd : undefined,
      outputTokens: Number.isFinite(m.mean_output_tokens) ? Math.round(m.mean_output_tokens!) : undefined,
      labHint: m.slug?.split("/")[0], releaseDateHint: m.release_date || undefined, harness,
      note: `${m.name} · ${m.runs ?? "?"} runs · ${harness ?? "agent"}${data.generated ? ` · data ${data.generated.slice(0, 10)}` : ""}`,
    };
    const key = `${label}|${effort ?? ""}`;
    if (!best.has(key) || row.value > best.get(key)!.value) best.set(key, row);
  }
  return [...best.values()];
}

const source: Source = {
  id: "weirdml",
  name: "WeirdML",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [csv, v3text] = await Promise.all([ctx.fetchText(CSV), ctx.fetchText(V3_DATA)]);
    const v3 = parseWeirdmlV3(JSON.parse(v3text) as V3Data);
    if (!v3.length) throw new Error("WeirdML v3 data has no usable models");
    const recs = parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const rows: RawRow[] = [];
    for (const r of recs) {
      const acc = num(r.avg_acc);
      const internal = r.internal_model_name ?? "";
      if (acc == null || !internal) continue;
      // internal_model_name carries effort as a `:effort` suffix ("gpt-6-astra-pro:max").
      const m = internal.match(/^(.*?)(?::(none|minimal|low|medium|high|xhigh|max|default))?$/);
      const label = (m?.[1] ?? internal).trim();
      const effort = m?.[2] === "max" ? "xhigh" : m?.[2] === "default" ? undefined : m?.[2];
      const lab = r.model_slug?.split("/")[0];
      rows.push({
        benchmarkId: "weirdml-v2",
        modelLabel: label,
        effort,
        value: acc * 100,
        costUsd: num(r.cost_per_run_usd),
        sourceUrl: SITE,
        labHint: lab,
        releaseDateHint: r.release_date || undefined,
        note: `SE ±${((num(r.avg_acc_standard_error) ?? 0) * 100).toFixed(2)} · ${r["API source"] || "API"}`,
      });
    }
    rows.push(...v3);
    return {
      benchmarks: [{
        id: "weirdml-v3", name: "WeirdML v3", shortName: "WeirdML v3", sourceId: this.id, url: V3_SITE,
        description: "Fully agentic: 11 hand-made ML and data-analysis tasks run in coding-agent harnesses, where models must explore unfamiliar data and build pipelines with limited data, unspecified goals or little feedback. Overall effective score (95% interval).",
        unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 0,
      }, {
        id: "weirdml-v2", name: "WeirdML v2", sourceId: this.id, url: SITE,
        description: "17 ML tasks where models write Python pipelines from scratch (shape inference, chess winners, Kolmogorov shuffles); mean accuracy across tasks.",
        unit: "percent", higherIsBetter: true, category: "coding", eligibleForDefault: true, defaultWeight: 5,
      }],
      rows,
      raw: { "weirdml_data.csv": csv, "weirdml_v3.json": v3text },
      notes: [`v2: ${rows.length - v3.length} rows from weirdml_data.csv`, `v3: ${v3.length} rows from weirdml_v3.json`],
    };
  },
};
export default source;
