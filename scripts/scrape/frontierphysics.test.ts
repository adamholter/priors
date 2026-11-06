import { describe, expect, it } from "vitest";
import { parseFrontierPhysics } from "./sources/frontierphysics";

const agent = (o: object) => JSON.stringify(o);
const bundle = `(e,a,t)=>{a.exports=JSON.parse('{"tasks":99,"date":"2020-01-01"}')},48160,(e,a,t)=>{a.exports=JSON.parse('{"source":{"date":"2026-11-04"},"tasks":56,"trialsPerTask":3,"agents":[${[
  agent({ rank: 1, id: "opus", model: "Claude Opus 5.5", baseModel: "Claude Opus 5.5", provider: "anthropic", harness: "Claude Code", effort: "max", overall: { avg3: 27.4, ci: 6.7, pass3: 44.6 }, verifier: { avg3: 45.8, ci: 7.5, pass3: 62.5 }, score: { mean: 26, ci: 6.4 }, passes: 46, rollouts: 168, tasksSolved: 25, cost: { perRollout: 26.95, estimated: false }, minutes: { perRollout: 146.6 }, steps: { perRollout: 219.3 }, outputTokens: { perRollout: 381550.8 } }),
  agent({ rank: 3, model: "GPT-6 Astra (xhigh)", baseModel: "GPT-6 Astra", provider: "openai", harness: "Codex", effort: "xhigh", overall: { avg3: 19.6, ci: 6 }, cost: { perRollout: 19.21 } }),
  agent({ rank: 20, model: "Grok 4.6", baseModel: "Grok 4.6", harness: "Grok Build", effort: null, overall: { avg3: 2.4, ci: 3 }, cost: { perRollout: 9.36, estimated: true } }),
  agent({ rank: 27, model: "Broken" }),
].join(",")}]}')}`;

describe("FrontierPhysics parser", () => {
  it("reads the bundled leaderboard: overall pass, CI, effort, harness and per-rollout cost", () => {
    const r = parseFrontierPhysics(bundle);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ modelLabel: "Claude Opus 5.5", effort: "max", value: 27.4, ci: [20.7, 34.1], costUsd: 26.95, harness: "Claude Code", labHint: "anthropic", steps: 219.3, outputTokens: 381550.8 });
    expect(r.rows[0].durationSec).toBeCloseTo(146.6 * 60);
    expect(r.rows[0].details).toMatchObject({ verifierPass: 45.8, pass3: 44.6, rubricScore: 26, passes: 46, rollouts: 168 });
    expect(r.rows[1]).toMatchObject({ modelLabel: "GPT-6 Astra", effort: "xhigh", value: 19.6 });
    expect(r.rows[2].effort, "a null effort stays unknown").toBeUndefined();
    expect(r.rows[2].ci).toEqual([0, 5.4]);
    expect(r.rows[2].note).toMatch(/cost estimated/);
    expect(r.benchmarks[0]).toMatchObject({ id: "frontierphysics", unit: "percent", lastUpdated: "2026-11-04", defaultWeight: 0 });
    expect(r.benchmarks[0].description).toMatch(/56 tasks .* 3 trials each/);
  });
  it("fails visibly when the bundle shape changes", () => {
    expect(() => parseFrontierPhysics("const a=1")).toThrow(/not found/);
    expect(() => parseFrontierPhysics(`"agents":[{"rank":1,"model":"A"}]`)).toThrow(/no usable rows/);
  });
});
