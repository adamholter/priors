/**
 * SolidWorks-Bench (Markov, markovstudios.com/research/solidworks-bench): given only the engineering drawings and supplier STEP files of a
 * real machine, the agent models every custom part in SolidWorks, assembles the machine with working mates and saves native files. One
 * attempt per machine, high reasoning effort. The report is server-rendered. Its cost table holds each model's mean reward, cost, turns and
 * time under a short chart name ("GLM 5.3"); the cost chart's point titles give the exact model ("GLM 5.3 Flash"), which is what is matched.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { text } from "./_board";

export const SOLIDWORKS_BENCH_ID = "solidworks-bench";
const SITE = "https://www.markovstudios.com/research/solidworks-bench";
const number = (s: string | undefined) => { const n = Number((s ?? "").replace(/[$,\s]/g, "")); return s && Number.isFinite(n) ? n : undefined; };

export function parseSolidWorksBench(html: string): { rows: RawRow[]; machines?: number; updated?: string } {
  const table = html.match(/<table\b[^>]*>(?:(?!<\/table>)[\s\S])*?\$ \/ machine[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error("SolidWorks-Bench: cost table missing");
  const rowsOf = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])));
  const head = rowsOf[0] ?? [], col = (name: string) => head.indexOf(name), need = ["Model", "$ / machine", "Median turns", "Median time", "Time limit hit", "Reward"];
  for (const name of need) if (col(name) < 0) throw new Error(`SolidWorks-Bench: column ${name} missing`);
  const fullName = new Map([...html.matchAll(/<title>([^<]+)<\/title><\/circle><text\b[^>]*class="lbl"[^>]*>([^<]+)<\/text>/g)].map((m) => [text(m[2]), text(m[1])]));
  const parts = new Map<string, Record<string, number>>();
  const groups = html.slice(html.indexOf("Where the reward comes from")), end = groups.indexOf("</figure>");
  for (const g of (end > 0 ? groups.slice(0, end) : groups).split(/<span class="ml"[^>]*>/).slice(1)) {
    const name = text(g.slice(0, g.indexOf("</span>"))), found: Record<string, number> = {};
    for (const m of g.matchAll(/<span class="k"[^>]*>(Geometry|Assembly|Practice)\b[^<]*<\/span>[\s\S]*?width:([\d.]+)%/g)) found[m[1].toLowerCase()] = +Number(m[2]).toFixed(2);
    parts.set(name, found);
  }
  const page = text(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")), effort = page.match(/reasoning effort (none|minimal|low|medium|high|xhigh|max) for every model/i)?.[1]?.toLowerCase();
  if (!effort) throw new Error("SolidWorks-Bench: the report no longer states one reasoning effort");
  const machines = number(html.match(/(\d+) machines ·/)?.[1]), rows: RawRow[] = [];
  for (const r of rowsOf.slice(1)) {
    const short = r[col("Model")], reward = number(r[col("Reward")]);
    if (!short || reward == null) continue;
    const label = fullName.get(short);
    if (!label) throw new Error(`SolidWorks-Bench: no exact model name for ${short}`);
    const hours = number(r[col("Median time")]?.replace(/\s*h$/, "")), limitHits = number(r[col("Time limit hit")]), turns = number(r[col("Median turns")]);
    rows.push({
      benchmarkId: SOLIDWORKS_BENCH_ID, modelLabel: label, effort, value: +(reward * 100).toFixed(1), sourceUrl: SITE, costUsd: number(r[col("$ / machine")]),
      ...(hours != null ? { durationSec: Math.round(hours * 3600) } : {}), steps: turns,
      note: `Mean reward over ${machines ?? "?"} machines, one attempt each; cost is mean API list price per machine, time and turns are medians; hit the time limit on ${limitHits ?? "?"}`,
      details: { reward, medianTurns: turns, medianHours: hours, timeLimitHits: limitHits, ...parts.get(short) },
    });
  }
  return { rows, machines, updated: html.match(/datetime="(\d{4}-\d{2}-\d{2})/)?.[1] };
}

const source: Source = {
  id: "solidworks-bench", name: "SolidWorks-Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE), { rows, machines, updated } = parseSolidWorksBench(html);
    if (rows.length < 5) throw new Error(`SolidWorks-Bench: only ${rows.length} models`);
    return {
      benchmarks: [{
        id: SOLIDWORKS_BENCH_ID, name: "SolidWorks-Bench", shortName: "SolidWorks", sourceId: this.id, url: SITE, unit: "percent", higherIsBetter: true, category: "agentic", categories: ["agentic", "science", "vision"],
        normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0, ...(updated ? { lastUpdated: updated } : {}),
        description: `Mechanical design in SolidWorks: from drawings of ${machines ?? "real"} machines, model every custom part and assemble the machine with working mates. Mean reward over geometry, assembly function and CAD practice.`,
      }],
      rows, raw: { "report.html": html }, notes: [`${rows.length} models over ${machines ?? "?"} machines`],
    };
  },
};
export default source;
