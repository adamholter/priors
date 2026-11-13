/**
 * Khalil Bench (khalil-bench.adamholter.chatgpt.site), Adam's joke benchmark: what @kamkmgamer replied to Adam's model test
 * posts, each verdict mapped to a severity from yuck (-2) to really cool (+2) and scored (severity + 2) / 4 x 100. The site
 * publishes `data.json`; `board` holds one row per model with its mean score and verdict count. One person's reactions to a few
 * posts per model, so it is never in a default mix, carries no quality score (NOT_SERIOUS in src/onboarding/quality.ts) and is
 * only found by looking for it. Tests do not record reasoning effort, so every row files under the model's default.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { LIVE_NOTE } from "../../../src/data/catalog";

export const KHALIL_ID = "khalilbench";
const SITE = "https://khalil-bench.adamholter.chatgpt.site/";

type Board = { model?: string; n?: number; score?: number; mean_severity?: number; worst?: number; best?: number };
type Data = { meta?: { built_at_et?: string; counts?: { all_posts?: number }; scale?: { severity: number; word: string }[] }; board?: Board[];
  /** Every verdict; `product` names something rated that is not a model (Intersects, added on request), shown unranked. */
  rows?: { product?: string | null; s?: number | null }[] };

export function parseKhalilBench(json: Data): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const rows: RawRow[] = [];
  for (const b of json.board ?? []) {
    if (!b.model || typeof b.score !== "number" || !Number.isFinite(b.score) || b.score < 0 || b.score > 100) continue;
    rows.push({
      benchmarkId: KHALIL_ID, modelLabel: b.model, effortUnstated: true, value: b.score, sourceUrl: SITE,
      note: `${b.n ?? "?"} verdict${b.n === 1 ? "" : "s"}, from ${b.worst ?? "?"} to ${b.best ?? "?"} on the -2 (yuck) to +2 (really cool) scale`,
      details: { verdicts: b.n, meanSeverity: b.mean_severity, worst: b.worst, best: b.best },
    });
  }
  if (rows.length < 5) throw new Error(`Khalil Bench: ${rows.length} scored models; data.json changed?`);
  const updated = json.meta?.built_at_et?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  // Products are not models, so they cannot be rows; the site lists them on its board unranked, tagged "app", and so does the description.
  const byProduct = new Map<string, number[]>();
  for (const r of json.rows ?? []) if (r.product && typeof r.s === "number") byProduct.set(r.product, [...(byProduct.get(r.product) ?? []), r.s]);
  const word = (sev: number) => [...(json.meta?.scale ?? [])].sort((a, b) => Math.abs(a.severity - sev) - Math.abs(b.severity - sev))[0]?.word;
  const products = [...byProduct].map(([name, sevs]) => { const mean = sevs.reduce((a, b) => a + b, 0) / sevs.length; return `${name} (${word(mean) ?? "rated"}, ${Math.round(((mean + 2) / 4) * 100)} points)`; });
  return {
    benchmarks: [{
      id: KHALIL_ID, name: "Khalil Bench", shortName: "Khalil", sourceId: KHALIL_ID, url: SITE,
      description: `Not a serious benchmark: what one X user, @kamkmgamer, replied to Adam Holter's model test posts. Each reply is mapped to a verdict from yuck to really cool and scored 0 to 100; a model's score is the mean of its verdicts, often just one or two.${products.length ? `${LIVE_NOTE}Also rated, not models, so unranked as on the Khalil Bench site: ${products.join(", ")}.` : ""}`,
      unit: "score", higherIsBetter: true, category: "preference", normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: false, defaultWeight: 0, ...(updated ? { lastUpdated: updated } : {}),
    }],
    rows,
    notes: [`${rows.length} models${products.length ? `, ${products.length} unranked product${products.length === 1 ? "" : "s"} (${[...byProduct.keys()].join(", ")})` : ""}${json.meta?.counts?.all_posts ? ` from ${json.meta.counts.all_posts} posts read` : ""}${updated ? `, built ${updated}` : ""}`],
  };
}

const source: Source = {
  id: KHALIL_ID, name: "Khalil Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(`${SITE}data.json`);
    return { ...parseKhalilBench(JSON.parse(text) as Data), raw: { "data.json": text } };
  },
};
export default source;
