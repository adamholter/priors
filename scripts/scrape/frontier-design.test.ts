import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { FRONTIER_DESIGN_ID, parseFrontierDesign, readDesignBoard, readDesignRubric, type DesignBoard, type DesignRubric } from "./sources/frontier-design";

const board: DesignBoard = { board: { overall: { votes: 100, reviewers: 5, standings: [
  { name: "Gestalt", org: "Gestalt", ranked: true, elo: 1931, cost: null },
  { name: "Human golden", golden: true, ranked: true, elo: 1739 },
  { name: "Claude Fable 5.2", org: "Anthropic", ranked: true, games: 683, rate: 0.7291, elo: 1713, eloLo: 1678, eloHi: 1747, cost: 127.22, costLowerBound: true },
  { name: "GPT-6 Astra", org: "OpenAI", ranked: true, games: 449, rate: 0.66, elo: 1638, eloLo: 1600, eloHi: 1670, cost: 7.33, costLowerBound: false },
  { name: "GLM-5.3 Prime", org: "Z.ai", ranked: true, elo: 1403, cost: 8.64, costLowerBound: false },
  { name: "Too New", ranked: false, elo: 1500 },
] } } };
const rubric: DesignRubric = { meta: { source: "Frontier Design Scorecard, 2026-11-18", n_tasks: 33 }, models: [
  { id: "claude-fable-5.2", name: "Claude Fable 5.2", rubric: 83.8, clanker: 31.4, rollouts: 33, landing_pages: 24 },
  { id: "gpt-6-astra-ultra", name: "GPT 6 Astra Ultra", rubric: 78.7, clanker: 41.4, rollouts: 26, landing_pages: 19 },
  { id: "glm-5.3-prime", name: "GLM 5.3 Prime", rubric: 59, clanker: 24.5, rollouts: 27, landing_pages: 20 },
  { id: "golden", name: "Designer reference", reference: true, rubric: 73.6, clanker: 0.9 },
] };

describe("Frontier Design Benchmark", () => {
  const { rows, benchmarks, skipped } = parseFrontierDesign(board, rubric), of = (id: string) => rows.filter((r) => r.benchmarkId === id);
  it("keeps real models and leaves out the human reference, the stealth entry and unranked rows", () => {
    expect(of(FRONTIER_DESIGN_ID).map((r) => [r.modelLabel, r.value])).toEqual([["Claude Fable 5.2", 1713], ["GPT-6 Astra", 1638], ["GLM-5.3 Prime", 1403]]);
    expect(skipped).toEqual(["Gestalt", "Too New"]);
  });
  it("joins the scorecard's spelling to the panel's names and marks Astra's ultra run", () => {
    expect(of(`${FRONTIER_DESIGN_ID}-critique`).map((r) => [r.modelLabel, r.value, r.effort])).toEqual([["Claude Fable 5.2", 83.8, undefined], ["GPT-6 Astra", 78.7, "ultra"], ["GLM-5.3 Prime", 59, undefined]]);
    expect(of(`${FRONTIER_DESIGN_ID}-slop`).map((r) => r.value)).toEqual([31.4, 41.4, 24.5]);
    expect(benchmarks.find((b) => b.id === `${FRONTIER_DESIGN_ID}-slop`)).toMatchObject({ higherIsBetter: false, variantOf: FRONTIER_DESIGN_ID, lastUpdated: "2026-11-18" });
  });
  it("gives a cost only when it is a full figure for the model itself", () => {
    expect(of(FRONTIER_DESIGN_ID).map((r) => r.costUsd)).toEqual([undefined, 7.33, undefined]);
  });
  it("reads both data files", () => {
    expect(readDesignBoard(`window.FDB_OURS = ${JSON.stringify(board)};`).board.overall.votes).toBe(100);
    expect(readDesignRubric(`(function () {\n  const DATA = ${JSON.stringify(rubric)};\n  const x = {};\n})();`).models).toHaveLength(4);
    expect(() => readDesignRubric("nothing here")).toThrow(/rubric file changed/);
  });
  it("reads the minified object-literal files the site ships now", () => {
    const minify = (v: unknown) => JSON.stringify(v).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:").replace(/:true\b/g, ":!0").replace(/:false\b/g, ":!1");
    expect(readDesignBoard(`window.FDB_OURS=${minify(board)};`).board.overall.votes).toBe(100);
    expect(readDesignRubric(`(function(){const fe=${minify(rubric)};const e={a:1};})();`).models).toEqual(rubric.models);
  });
  it("resolves the names the site uses", () => {
    for (const r of of(FRONTIER_DESIGN_ID)) expect(normalizeLabel(r.modelLabel, r.labHint).ok, r.modelLabel).toBe(true);
  });
});
