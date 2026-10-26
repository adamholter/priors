/**
 * Artificial Analysis results AA has announced but not yet put on its site.
 *
 * AA's launch posts carry the numbers days before /models lists the model. Each entry here stands in
 * for the site's own records, so the same code reads them, and it steps aside the moment AA lists the
 * model at any effort (AA's measured values then replace every number below). Delete an entry once its
 * model is on AA; leaving it is harmless.
 */
import { normalizeLabel } from "../../src/data/normalize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

interface PreviewEffort {
  effort: string;
  /** Intelligence Index v4.3.2. Exact only where `exact` is set; otherwise read off AA's chart. */
  index: number;
  /** Cost per Intelligence Index task, USD, read off AA's cost chart (log axis, about 5%). */
  costPerTask: number;
  exact?: boolean;
}

interface PreviewModel {
  name: string;
  slug: string;
  creator: { name: string; slug: string };
  releaseDate: string;
  source: string;
  /** Per-token list price in USD per 1M tokens. */
  price: { input: number; output: number };
  /** AA's per-evaluation results for the max effort, as AA's tweet and charts show them (rounded). */
  evals: Json;
  efforts: PreviewEffort[];
}

export const AA_PREVIEW: PreviewModel[] = [{
  name: "GPT-6.1 Terra",
  slug: "gpt-6-1-terra",
  creator: { name: "OpenAI", slug: "openai" },
  releaseDate: "2026-10-26",
  source: "AA's GPT-6.1 Terra launch thread, Oct 26 2026",
  price: { input: 1, output: 5 },
  evals: {
    omniscience: 30, omniscienceBreakdown: { accuracy: 0.49, hallucinationRate: 0.38 },
    terminalBench40: 0.556, briefcaseElo: 1402, gdpval: 1468, automationBenchPartialScore: 0.6,
    scicode: 0.55, hle: 0.46, gdpPdfAllPass: 0.29, critpt: 0.28, lcr: 0.83,
  },
  efforts: [
    { effort: "max", index: 48, costPerTask: 0.4, exact: true },
    { effort: "xhigh", index: 45.5, costPerTask: 0.19 },
    { effort: "high", index: 44, costPerTask: 0.14 },
    { effort: "medium", index: 41.5, costPerTask: 0.095 },
    { effort: "low", index: 36.5, costPerTask: 0.055 },
    { effort: "none", index: 33.5, costPerTask: 0.11 },
  ],
}];

const modelIdOf = (r: Json) => { const n = normalizeLabel(String(r.name ?? r.shortName ?? "")); return n.ok ? n.modelId : undefined; };

/** Records in the shape of AA's evaluation (`ev`) and model-table (`tbl`) rows, for models AA has not listed. */
export function pendingPreviews(listed: Json[]): { id: string; ev: Json; tbl: Json }[] {
  const have = new Set(listed.map(modelIdOf).filter(Boolean));
  const out: { id: string; ev: Json; tbl: Json }[] = [];
  for (const m of AA_PREVIEW) {
    if (have.has(modelIdOf(m))) continue;
    for (const e of m.efforts) {
      const id = `preview-${m.slug}-${e.effort}`;
      const max = e.effort === "max";
      const common = { id, slug: m.slug, name: m.name, creator: m.creator, releaseDate: m.releaseDate, effort: { slug: e.effort } };
      const previewNote = max
        ? `AA launch figures (${m.source}), rounded; not yet on artificialanalysis.ai`
        : `AA launch figures (${m.source}); index and cost read off AA's chart, approximate; not yet on artificialanalysis.ai`;
      out.push({
        id,
        // Per-evaluation results are published for the max effort only.
        ev: { ...common, previewNote, intelligenceIndex: e.index, ...(max ? m.evals : {}) },
        tbl: {
          ...common, outputModalityText: true, isReasoning: e.effort !== "none",
          intelligenceIndexCostPerTask: { cost: { total: e.costPerTask } },
          price1mBlended0To3To1: (3 * m.price.input + m.price.output) / 4,
        },
      });
    }
  }
  return out;
}
