import { describe, expect, it } from "vitest";
import { parseHoneyBench } from "./sources/honeybench";

const env = (id: string, task: string, hacks: number, runs: number, score: number) =>
  `<li data-environment="${id}" data-kind="coverage-exploit"><div class="m__scoreRow"><span class="m__scoreLabelText">${task}</span><small class="m__runCount">${hacks} / ${runs} runs</small><span class="m__plotTrack" data-score="${score}" data-max="100"></span></div></li>`;
const model = (name: string, shown: string, score: number, extra = "", envs = "") =>
  `<li><details class="m__model" name="model-breakdown"><summary aria-label="${name}, overall hack rate ${shown}% of scored runs (0.0% attacking the infrastructure), ${extra}80% confidence interval 9.1–15.4%, environment breakdown"><span class="m__score">${shown}%</span><span class="m__plotTrack" data-score="${score}" data-max="100"><span class="m__plotRange" data-lower="9.1" data-upper="15.4"></span></span></summary><div class="m__breakdown"><ul>${envs}</ul></div></details></li>`;
const page = (title: string, models: string[]) =>
  `<h1 class="t__pageTitle">${title}</h1><ul class="m__leaderboard" aria-label="Overall model rankings">${models.join("")}</ul><section id="by-task">${env("neural-recovery", "Elsewhere", 9, 9, 100)}</section>`;
const five = [
  model("Fable 5.2", "11.9", 11.931818181818182, "", env("neural-recovery", "Glioblastoma dosing", 1, 10, 10) + env("beat-stockfish", "Beat Stockfish", 0, 10, 0)),
  model("Opus 5.5", "31.8", 31.85, "35.2% counting 4.8% of runs refused as hacks, "),
  model("GLM-5.3", "76.8", 76.76),
  model("Muse Spark Open", "85.6", 99),
  model("Grok 4.7", "85.1", 85.13),
];

describe("HoneyBench parser", () => {
  it("reads every model's summary, with the unrounded rate, interval, refusals and environments", () => {
    const { benchmark, rows } = parseHoneyBench(page("HoneyBench v0.2", five));
    expect(benchmark).toMatchObject({ id: "honeybench-v0.2", name: "HoneyBench v0.2", unit: "percent", higherIsBetter: false, category: "safety", defaultWeight: 0, eligibleForDefault: false });
    expect(rows.map((r) => r.modelLabel)).toEqual(["Fable 5.2", "Opus 5.5", "GLM-5.3", "Muse Spark Open", "Grok 4.7"]);
    expect(rows[0]).toMatchObject({ benchmarkId: "honeybench-v0.2", value: 11.931818181818182, ci: [9.1, 15.4] });
    expect(rows[0].details).toMatchObject({ infrastructureAttackPct: 0, environments: { "neural-recovery": { task: "Glioblastoma dosing", value: 10, hacks: 1, runs: 10 }, "beat-stockfish": { value: 0 } } });
    expect(Object.keys(rows[0].details!.environments as object)).toHaveLength(2); // the by-task section after the board is not read
    expect(rows[1].details).toMatchObject({ refusedPct: 4.8, countingRefusalsPct: 35.2 });
    expect(rows[1].note).toContain("35.2%");
    expect(rows[3].value).toBe(85.6); // a bar that disagrees with the printed rate loses to it
  });
  it("takes the id from the page's version", () => {
    expect(parseHoneyBench(page("HoneyBench v0.3", five)).benchmark.id).toBe("honeybench-v0.3");
  });
  it("fails visibly when the board or the version is missing", () => {
    expect(() => parseHoneyBench(page("HoneyBench", five))).toThrow();
    expect(() => parseHoneyBench(page("HoneyBench v0.2", five.slice(0, 2)))).toThrow();
  });
});
