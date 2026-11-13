/**
 * Penalty Bench (wenhaochai.com/blogs/penalty-bench.html, Wenhao Chai): can an AI agent referee? 101 penalty incidents from the
 * 2026 season; each agent, in its own CLI, says penalty or no penalty, scored against expert verdicts. The page embeds its
 * leaderboard as JSON (`const LEADER=[...]`): accuracy with a 95% interval. Two rows are human baselines (the referee on the
 * pitch, and with VAR); they go in the description, not in the rows. The author calls it "not super seriously"; it is never in a
 * default mix. Tests do not state reasoning effort, so each row files under the model's default.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const PENALTY_ID = "penaltybench";
const SITE = "https://wenhaochai.com/blogs/penalty-bench.html";

type Leader = { name: string; vendor?: string; harness?: string; acc: number; n?: number; ci?: [number, number] };
const r1 = (x: number) => Math.round(x * 10) / 10;

export function parsePenaltyBench(html: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const m = /const LEADER=(\[[\s\S]*?\]);/.exec(html);
  if (!m) throw new Error("Penalty Bench: LEADER data not found");
  const list = JSON.parse(m[1]) as Leader[];
  const referees = list.filter((x) => x.vendor === "referee");
  const rows: RawRow[] = list.filter((x) => x.vendor !== "referee" && x.name && Number.isFinite(x.acc)).map((x) => ({
    benchmarkId: PENALTY_ID, modelLabel: x.name, effortUnstated: true, labHint: x.vendor, harness: x.harness || undefined, value: r1(x.acc), sourceUrl: SITE,
    ...(x.ci ? { ci: [r1(x.ci[0]), r1(x.ci[1])] as [number, number] } : {}),
    note: `${Math.round((x.acc * (x.n ?? 101)) / 100)} of ${x.n ?? 101} clips right${x.harness ? `; ${x.harness}` : ""}`,
  }));
  if (rows.length < 5) throw new Error(`Penalty Bench: ${rows.length} models; page changed?`);
  const baseline = referees.map((x) => `${x.name.replace(/^Referee,?\s*/i, "the referee ")} ${r1(x.acc)}%`).join(", ");
  return {
    benchmarks: [{
      id: PENALTY_ID, name: "Penalty Bench", sourceId: PENALTY_ID, url: SITE,
      description: `Can an AI agent referee? 101 penalty incidents from the 2026 football season; the agent decides penalty or no penalty, scored against expert verdicts. Accuracy with a 95% interval.${baseline ? ` Human baselines: ${baseline}.` : ""} The author calls it a not-so-serious small bench. By Wenhao Chai.`,
      unit: "percent", higherIsBetter: true, category: "vision", normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    notes: [`${rows.length} models, ${referees.length} referee baselines`],
  };
}

const source: Source = {
  id: PENALTY_ID, name: "Penalty Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    return { ...parsePenaltyBench(html), raw: { "penalty-bench.html": html } };
  },
};
export default source;
