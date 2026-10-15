/**
 * AA-Robotics (Artificial Analysis), https://artificialanalysis.ai/articles/aa-robotics
 *
 * A model in a coding-agent harness drives a 6-axis robot arm through tabletop tasks. There is no
 * evaluation page or data manifest yet: the results ship inside the article's page bundle as
 *   - the model list:  {id:"gpt-6-astra",name:"GPT-6 Astra",creatorName:"OpenAI",...,harness:"Codex"}
 *   - the task list:   {id:"press-red-button",name:"Press the red button",shortName:...}
 *   - the score map:   {"gpt-6-astra":{"press-red-button":100,...},...}  (0-100 per task)
 * The published score is the mean over tasks. The effort is read from the article text
 * ("... all at the high effort setting"). If AA adds an /evaluations page, the AA source announces it.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

const ORIGIN = "https://artificialanalysis.ai";
const PAGE = `${ORIGIN}/articles/aa-robotics`;

export const ROBOTICS: Benchmark = {
  id: "aa-robotics", name: "AA-Robotics", shortName: "AA-Robotics", sourceId: "aa-robotics", url: PAGE,
  description: "AA-Robotics: a model in its lab's coding-agent harness directly controls a 6-axis robot arm (5 joints and a gripper) through everyday tabletop tasks such as pressing a button, pouring a drink and writing \"hello world\". Mean score per task (0 to 100, partial credit for progress).",
  normalization: { kind: "linear", min: 0, max: 100 },
  unit: "score", higherIsBetter: true, category: "agentic", versionPolicy: { kind: "fresh" }, defaultWeight: 0,
};

const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

/** Parse the article bundle (JS) plus article text into rows. Exported for tests. */
export function parseRobotics(bundle: string, articleText: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const models = new Map<string, { name: string; lab: string; harness?: string }>();
  for (const m of bundle.matchAll(/\{id:"([a-z0-9-]+)",name:"([^"]+)",creatorName:"([^"]+)"[^{}]*\}/g)) {
    models.set(m[1], { name: m[2], lab: m[3], harness: m[0].match(/harness:"([^"]+)"/)?.[1] });
  }
  const tasks = new Set([...bundle.matchAll(/\{id:"([a-z0-9-]+)",name:"[^"]+",shortName:"[^"]+",instruction:/g)].map((m) => m[1]));
  if (!tasks.size) throw new Error("AA-Robotics task list not found in the article bundle");
  // The score map is plain JSON: model id -> { task id -> 0..100 }.
  let scores: Record<string, Record<string, number>> | undefined;
  for (const m of bundle.matchAll(/\{"[a-z0-9-]+":\{"[a-z0-9-]+":-?[\d.]+(?:,"[a-z0-9-]+":-?[\d.]+)*\}(?:,"[a-z0-9-]+":\{"[a-z0-9-]+":-?[\d.]+(?:,"[a-z0-9-]+":-?[\d.]+)*\})*\}/g)) {
    const candidate = JSON.parse(m[0]) as Record<string, Record<string, number>>;
    const entries = Object.entries(candidate);
    if (entries.length && entries.every(([id, t]) => models.has(id) && Object.keys(t).every((k) => tasks.has(k)))) { scores = candidate; break; }
  }
  if (!scores) throw new Error("AA-Robotics score map not found in the article bundle");
  const effortWord = articleText.match(/at the (\w+) effort setting/i)?.[1]?.toLowerCase();
  const effort = effortWord && EFFORTS.has(effortWord) ? effortWord : undefined;
  const rows: RawRow[] = [];
  for (const [id, perTask] of Object.entries(scores)) {
    const values = [...tasks].map((t) => perTask[t]);
    if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) continue; // not every task run
    const model = models.get(id)!;
    rows.push({
      benchmarkId: ROBOTICS.id, modelLabel: model.name, effort, labHint: model.lab, harness: model.harness, sourceUrl: PAGE,
      value: values.reduce((a, b) => a + b, 0) / values.length,
      details: { perTask },
    });
  }
  if (!rows.length) throw new Error("AA-Robotics has no model with every task scored");
  return { benchmarks: [ROBOTICS], rows, notes: [`${rows.length} models, ${tasks.size} tasks${effort ? `, ${effort} effort` : ""}`] };
}

const source: Source = {
  id: "aa-robotics", name: "AA-Robotics · Artificial Analysis", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE);
    // Page-specific client chunks are listed in the RSC payload; the results live in one of them.
    const chunks = [...new Set([...html.matchAll(/static\/chunks\/[^"\\\s]*?page-[a-f0-9]+\.js/g)].map((m) => m[0]))];
    const raw: Record<string, string> = { "article.html": html };
    let lastError: unknown = new Error("no page chunks found on the AA-Robotics article");
    const text = html.replace(/<[^>]+>/g, " ").replace(/\\"/g, '"');
    for (const chunk of chunks) {
      const js = await ctx.fetchText(`${ORIGIN}/_next/${chunk}`);
      if (!js.includes("creatorName") || !js.includes("instruction:")) continue;
      try {
        const result = parseRobotics(js, text);
        raw["bundle.js"] = js;
        return { ...result, raw };
      } catch (e) { lastError = e; }
    }
    throw lastError;
  },
};
export default source;
